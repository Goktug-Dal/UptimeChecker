using Backend.Api.Context;
using Backend.Api.Models;
using Backend.Api.Services;

using Backend.Api.Dtos;

using Microsoft.EntityFrameworkCore;


using Microsoft.AspNetCore.SignalR;
using Backend.Api.Hubs;
using Microsoft.OpenApi;

public class CheckerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPingerService _pingerService;

    private readonly IHubContext<ServerStatusHub> _hubContext;

    private DateTime _lastCleanupTime = DateTime.MinValue;

    public CheckerService(IServiceScopeFactory scopeFactory, IPingerService pingerService, IHubContext<ServerStatusHub> hubContext){
        _scopeFactory = scopeFactory;
        _pingerService = pingerService;
        _hubContext = hubContext;
    }
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var pinger = scope.ServiceProvider.GetRequiredService<IPingerService>();
                    var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ServerStatusHub>>();

                    var now = DateTime.UtcNow;

                    var dueServers = await db.Servers.Where(s => s.IsActive && s.NextCheckTime <= now)
                        .ToListAsync(stoppingToken);

                    foreach (var server in dueServers)
                    {
                        
                        var result = await _pingerService.PingAsync(server.Url, stoppingToken);

                        server.LastCheckedAt = DateTime.UtcNow;
                        server.NextCheckTime = DateTime.UtcNow.AddSeconds(server.IntervalSeconds);
                        server.LastResponseTimeMs = result.ResponseTimeMs;
                        server.IsUp = result.IsSuccess;

                        var log = new Ping
                        {
                            ServerId = server.Id,
                            StatusCode = result.StatusCode,
                            ResponseTimeMs = result.ResponseTimeMs,
                            IsSuccess = result.IsSuccess,
                            ErrMessage = result.ErrMessage,
                            CheckedAt = DateTime.UtcNow
                        };

                        db.Pings.Add(log);
                        await db.SaveChangesAsync(stoppingToken);

                        await _hubContext.Clients.All.SendAsync("ServerStatusUpdated", new {
                            ServerId = server.Id,
                            IsUp = server.IsUp,
                            LastResponseTimeMs = server.LastResponseTimeMs,
                            Ping = new PingResult(
                                log.Id,
                                log.StatusCode,
                                log.ResponseTimeMs,
                                log.IsSuccess,
                                log.ErrMessage,
                                log.CheckedAt
                            )},stoppingToken);

                        if(DateTime.UtcNow - _lastCleanupTime > TimeSpan.FromHours(24))
                        {
                            var Limit = DateTime.UtcNow.AddDays(-14);

                            await db.Pings.Where(p => p.CheckedAt < Limit).ExecuteDeleteAsync(stoppingToken);

                            _lastCleanupTime = DateTime.UtcNow;
                        }
                    }
                }
            catch(Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                Console.WriteLine(ex);
            }

            await Task.Delay(1000, stoppingToken);
    }
    }
}