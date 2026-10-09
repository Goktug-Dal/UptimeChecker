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

using System.Net;
using System.Net.Sockets;
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
                    server.PingLogs.OrderByDescending(p => p.CheckedAt).Take(20)
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

        //get this server id pings
        app.MapGet("/servers/{id:int}/pings", async (int id, [FromQuery] string? sessionId,AppDbContext dbContext) =>{
            var server = await dbContext.Servers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            if(server is null)
            {
                return Results.NotFound(new { error = $"Server with ID {id} not found." });
            }

            if(!server.IsDefault && server.SessionId != sessionId)
            {
                return Results.Forbid();
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

            if(await IsRestrictedHostAsync(uriResult.Host))
            {
                return Results.BadRequest(new { error = "Monitoring local, internal, or private infrastructure addresses is prohibited." });
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
        app.MapDelete("/servers/{id:int}", async (int id, [FromQuery] string? sessionId,AppDbContext dbContext) =>
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
        app.MapPost("/servers/{id:int}/ping", async (int id,  [FromQuery] string? sessionId,AppDbContext dbContext, IPingerService pinger, IHubContext<ServerStatusHub> hubContext)=>
        {
            var server = await dbContext.Servers.FindAsync(id);
            if(server is null)
            {
                return Results.NotFound(new { error = $"Server with ID {id} not found."});
            }

            if(!server.IsDefault && server.SessionId != sessionId)
            {
                return Results.Forbid();
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

            var payload = new {
                serverId = server.Id,
                isUp = server.IsUp,
                lastResponseTimeMs = server.LastResponseTimeMs,
                ping = pingResult
            };

            if (server.IsDefault)
            {
                await hubContext.Clients.All.SendAsync("ServerStatusUpdated", payload);
            }
            else if (!string.IsNullOrWhiteSpace(server.SessionId))
            {
                await hubContext.Clients.Group(server.SessionId).SendAsync("ServerStatusUpdated", payload);
            }
        

            return Results.Ok(pingResult);
        }).RequireRateLimiting("StrictIpLimit");


        //Update a server
        app.MapPut("/servers/{id:int}", async (int id, [FromQuery]string? sessionId,[FromBody] UpdateServerDto dto,AppDbContext dbContext) =>
        {
            if (string.IsNullOrWhiteSpace(dto.Url) || 
                dto == null)
            {
                return Results.BadRequest(new { error = "A valid URL is required." });
            }

            var rawUrl = dto.Url.Trim();
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

            if (await IsRestrictedHostAsync(uriResult.Host))
            {
                return Results.BadRequest(new { error = "Monitoring local, internal, or private infrastructure addresses is prohibited." });
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


            server.Url = rawUrl;
            server.Name = string.IsNullOrWhiteSpace(dto.Name) ? uriResult.Host : dto.Name.Trim();
            server.IntervalSeconds = Math.Clamp(dto.IntervalSeconds > 0 ? dto.IntervalSeconds : 10, 5, 300);
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

    private static async Task<bool> IsRestrictedHostAsync(string host)
    {
        if(host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) return true;

        try{
            var address = await Dns.GetHostAddressesAsync(host);
            foreach(var ip in address)
            {
                if(IPAddress.IsLoopback(ip)) return true;
                if(ip.IsIPv6SiteLocal || ip.IsIPv6LinkLocal) return true;

                var bytes = ip.GetAddressBytes();
                if(ip.AddressFamily == AddressFamily.InterNetwork)
                {
                    if (bytes[0] == 10) return true;                                       // 10.0.0.0/8
                    if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;  // 172.16.0.0/12
                    if (bytes[0] == 192 && bytes[1] == 168) return true;                  // 192.168.0.0/16
                    if (bytes[0] == 169 && bytes[1] == 254) return true;                  // 169.254.0.0/16
                    if (bytes[0] == 127) return true;                                      // 127.0.0.0/8
                    if (bytes[0] == 0) return true;
                }else if(ip.AddressFamily == AddressFamily.InterNetworkV6)
                {
                    if (bytes[0] == 0xfc || bytes[0] == 0xfd) return true;
                }
            }
            return false;
        }catch
        {
            return true;
        }

    }
}