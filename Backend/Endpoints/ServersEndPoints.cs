using System.Timers;
using System.Net.Http;
using Backend.Api.Context;
using Microsoft.EntityFrameworkCore;

using Backend.Api.Dtos;
using Backend.Api.Models;

public static class ServersEndPoints
{
    public static void MapGameEndPoints(this WebApplication app){
        //Get All Servers
        app.MapGet("/servers", async (AppDbContext dbContext) => await
            dbContext.Servers.AsNoTracking().Select(server =>   
                new ServerResult(
                    server.Id,
                    server.Url,
                    server.Name ?? string.Empty,
                    server.IntervalSeconds,
                    server.IsActive,
                    server.IsUp,
                    server.LastResponseTimeMs,
                    server.PingLogs.OrderByDescending(p => p.CheckedAt).Take(10)
                    .Select(p => new PingResult(
                        p.Id,
                        p.StatusCode,
                        p.ResponseTimeMs,
                        p.IsSuccess,
                        p.ErrMessage!,
                        p.CheckedAt
                    )).ToList()
                    )).ToListAsync());

        //get this server with id last 50 ping
        app.MapGet("/servers/{id:int}/pings", async (int id, AppDbContext dbContext) =>{
            var Ping = await dbContext.Servers.AnyAsync(s => s.Id == id); // for conversion

            if (!Ping){
                return Results.NotFound(new { error = $"Server with {id} does not exist or could not be found"});
            }

            var pings = await dbContext.Pings.AsNoTracking()
            .Where(p => p.ServerId == id)
            .OrderByDescending(p => p.CheckedAt)
            .Take(50)
            .Select(p => new PingResult(
                p.Id,
                p.StatusCode,
                p.ResponseTimeMs,
                p.IsSuccess,
                p.ErrMessage,
                p.CheckedAt
            )).ToListAsync();

            return Results.Ok(pings);
        });






        //Post a server
        app.MapPost("/servers", async (CreateServerDto newServer, AppDbContext dbContext) =>{
            if(string.IsNullOrWhiteSpace(newServer.Url)
            || !Uri.TryCreate(newServer.Url, UriKind.Absolute, out var uriResult)
            ||(uriResult.Scheme != Uri.UriSchemeHttp && uriResult.Scheme != Uri.UriSchemeHttps)){
                return Results.BadRequest(new {error = "A valid HTTP or HTTPS required"});
            }            
            
            var server = new Server
            {
                Url = newServer.Url.Trim(),
                Name = string.IsNullOrWhiteSpace(newServer.Name) ? uriResult.Host: newServer.Name.Trim(),
                IntervalSeconds = newServer.IntervalSeconds is > 0 ? newServer.IntervalSeconds.Value : 60,
                IsActive = true,
                IsUp = true,
                NextCheckTime = DateTime.UtcNow
            };

            dbContext.Servers.Add(server);
            await dbContext.SaveChangesAsync();

            return Results.Created($"/servers/{server.Id}",
            new ServerResult(
                server.Id,
                server.Url,
                server.Name,
                server.IntervalSeconds,
                server.IsActive,
                server.IsUp,
                server.LastResponseTimeMs,
                new List<PingResult>()
            ));
        });
    }
}