using System.Timers;
using System.Net.Http;
using Backend.Api.Context;
using Microsoft.EntityFrameworkCore;

using Backend.Api.Dtos;

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


        
    }
}