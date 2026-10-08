using System.Timers;
using System.Net.Http;
using Backend.Api.Context;
using Microsoft.EntityFrameworkCore;

using Backend.Api.Dtos;
using Backend.Api.Models;
using Backend.Api.Services;

using Microsoft.AspNetCore.SignalR;
using Backend.Api.Hubs;
using Microsoft.AspNetCore.Mvc;

public static class ServersEndPoints
{
    public static void MapServerEndPoints(this WebApplication app){
        //Get All Servers
        app.MapGet("/servers", async ([FromQuery]string? sessionId, AppDbContext dbContext) => {
            var query = dbContext.Servers.AsNoTracking().Where(s => s.IsDefault|| (sessionId != null && s.SessionId == sessionId));
            return await query.Select(server => 
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
                    )).ToListAsync();
                });

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
        app.MapPost("/servers", async ([FromBody]CreateServerDto newServer,[FromQuery] string? sessionId, AppDbContext dbContext) =>{
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                return Results.BadRequest(new { error = "Session identifier is required." });
            }

            var totalServers = await dbContext.Servers.CountAsync();
            if(totalServers >= 20)
            {
                return Results.BadRequest(new { error = "Global limit reached (20 monitors max). Try again later." });
            }


            // max 5 at a time
            var sessionCount = await dbContext.Servers.CountAsync(s => s.SessionId == sessionId);
            if(sessionCount >= 5)
            {
                return Results.BadRequest(new { error = "Sandbox limit reached. Max 5 custom targets per session." });
            }

            if (newServer == null || string.IsNullOrWhiteSpace(newServer.Url))
            {
                return Results.BadRequest(new { error = "Target URL is required." });
            }   
            var rawUrl = newServer.Url.Trim();
            if (!rawUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !rawUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                rawUrl = "https://" + rawUrl;
            }

            if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uriResult) ||
            (uriResult.Scheme != Uri.UriSchemeHttp && uriResult.Scheme != Uri.UriSchemeHttps))
            {
                return Results.BadRequest(new { error = "A valid HTTP or HTTPS URL is required." });
            }

            //anti abuse
            if(uriResult.IsLoopback || uriResult.Host.Equals("localhost",StringComparison.OrdinalIgnoreCase) ||
                uriResult.Host.StartsWith("192.168.") || uriResult.Host.StartsWith("10.") ||
                uriResult.Host.StartsWith("172.16.")
            )
            {
                return Results.BadRequest(new { error = "Monitoring local or internal addresses is disabled." });
            }

            int userInterval = newServer.IntervalSeconds.HasValue && newServer.IntervalSeconds.Value > 0 ? newServer.IntervalSeconds.Value: 10;

            
            var server = new Server
            {
                Url = rawUrl,
                Name = string.IsNullOrWhiteSpace(newServer.Name) ? uriResult.Host: newServer.Name.Trim(),
                IntervalSeconds = Math.Clamp(userInterval, 5, 300),
                IsActive = true,
                IsUp = true,
                IsDefault = false,
                SessionId = sessionId,
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
        }).RequireRateLimiting("StrictIpLimit");    


        //Delete a server
        app.MapDelete("/servers/{id:int}", async (int id, string? sessionId,AppDbContext dbContext) =>
        {
            var server = await dbContext.Servers.FindAsync(id);

            if(server is null)
            {
                return Results.NotFound(new { error = $"Server with ID {id} not found."});
            }

            if (server.IsDefault)
            {
                return Results.BadRequest(new { error = "Core demo monitors cannot be deleted." });
            }

            if(server.SessionId != sessionId)
            {
                return Results.Forbid();
            }

            dbContext.Servers.Remove(server);
            await dbContext.SaveChangesAsync();

            return Results.NoContent();
        });


        //Post a ping to a specific server
        app.MapPost("/servers/{id:int}/ping", async (int id, AppDbContext dbContext, IPingerService pinger, IHubContext<ServerStatusHub> hubContext)=>
        {
            var server = await dbContext.Servers.FindAsync(id);
            if(server is null)
            {
                return Results.NotFound(new { error = $"Server with ID {id} not found."});
            }

            //call a ping
            var res = await pinger.PingAsync(server.Url); // with this url

            var ping = new Ping
            {
                ServerId = server.Id,
                StatusCode = res.StatusCode,
                ResponseTimeMs = res.ResponseTimeMs,
                IsSuccess = res.IsSuccess,
                ErrMessage = res.ErrMessage,
                CheckedAt = DateTime.UtcNow
            };

            dbContext.Pings.Add(ping); // add to ping db

            server.IsUp = res.IsSuccess;
            server.LastResponseTimeMs = res.ResponseTimeMs;
            server.NextCheckTime = DateTime.UtcNow.AddSeconds(server.IntervalSeconds);

            await dbContext.SaveChangesAsync();

            var pingResult = new PingResult(
                ping.Id,
                ping.StatusCode,
                ping.ResponseTimeMs,
                ping.IsSuccess,
                ping.ErrMessage,
                ping.CheckedAt
            );

            await hubContext.Clients.All.SendAsync("ServerStatusUpdated", new
            {
                serverId = server.Id,
                isUp = server.IsUp,
                lastResponseTimeMs = server.LastResponseTimeMs,
                ping = pingResult
            });

            return Results.Ok(pingResult);
        }).RequireRateLimiting("StrictIpLimit");


        //Update a server
        app.MapPut("/servers/{id:int}", async (int id, string? sessionId,UpdateServerDto dto,AppDbContext dbContext) =>
        {
            if (string.IsNullOrWhiteSpace(dto.Url) || 
                !Uri.TryCreate(dto.Url, UriKind.Absolute, out var uriResult) ||
                (uriResult.Scheme != Uri.UriSchemeHttp && uriResult.Scheme != Uri.UriSchemeHttps))
            {
                return Results.BadRequest(new { error = "A valid HTTP or HTTPS URL is required." });
            }

            var server = await dbContext.Servers.FindAsync(id);
            if (server is null)
            {
                return Results.NotFound(new { error = $"Server with ID {id} not found." });
            }

            if (server.IsDefault)
            {
                return Results.BadRequest(new { error = "Core demo monitors cannot be modified." });
            }

            if(server.SessionId != sessionId)
            {
                return Results.Forbid();
            }


            server.Url = dto.Url.Trim();
            server.Name = string.IsNullOrWhiteSpace(dto.Name) ? uriResult.Host : dto.Name.Trim();
            server.IntervalSeconds = dto.IntervalSeconds;
            server.IsActive = dto.IsActive;


            if(server.IsActive && server.NextCheckTime > DateTime.UtcNow)
            {
                server.NextCheckTime = DateTime.UtcNow;
            }

            await dbContext.SaveChangesAsync();

            return Results.NoContent();
        });



        app.MapPost("/sessions/{sessionId}/cleanup", async (string sessionId, AppDbContext dbContext) =>
        {
            var targets = await dbContext.Servers.Where(s => s.SessionId == sessionId && !s.IsDefault).ToListAsync();

            if (targets.Any())
            {
                dbContext.Servers.RemoveRange(targets);
                await dbContext.SaveChangesAsync();
            }
            return Results.Ok();
        });
    }
}