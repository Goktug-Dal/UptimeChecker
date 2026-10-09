using Backend.Api.Context;
using Backend.Api.Models;
using Backend.Api.Services;

using Backend.Api.Dtos;

using Microsoft.EntityFrameworkCore;


using Microsoft.AspNetCore.SignalR;
using Backend.Api.Hubs;

public class CheckerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPingerService _pingerService;

    private readonly IHubContext<ServerStatusHub> _hubContext;
    private readonly ILogger<CheckerService> _logger;

    private DateTime _lastCleanupTime = DateTime.MinValue;

    public CheckerService(IServiceScopeFactory scopeFactory, IPingerService pingerService, IHubContext<ServerStatusHub> hubContext, ILogger<CheckerService> logger){
        _scopeFactory = scopeFactory;
        _pingerService = pingerService;
        _hubContext = hubContext;
        _logger = logger;
    }
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Checkerservice started");
        while (!stoppingToken.IsCancellationRequested)
        {
            try {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    if(DateTime.UtcNow - _lastCleanupTime > TimeSpan.FromHours(24))
                        {
                        var oneDayLimit = DateTime.UtcNow.AddDays(-1);
                        var deletedCount = await db.Pings.Where(p => p.CheckedAt < oneDayLimit).ExecuteDeleteAsync(stoppingToken);
                        if(deletedCount > 0){
                            _logger.LogInformation("Deleted {Count} pings", deletedCount);
                        }
                        _lastCleanupTime = DateTime.UtcNow;
                        }
                    var now = DateTime.UtcNow;
                    var dueServers = await db.Servers.Where(s => s.IsActive && s.NextCheckTime <= now)
                        .ToListAsync(stoppingToken);
 

                    foreach (var server in dueServers)
                    {   
                        try{
                        
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

                        var pingPayload = new
                        {
                            ServerId = server.Id,
                            IsUp = server.IsUp,
                            LastResponseTimeMs = server.LastResponseTimeMs,
                            Ping = new PingResult(
                                log.Id,
                                log.StatusCode,
                                log.ResponseTimeMs,
                                log.IsSuccess,
                                log.ErrMessage,
                                log.CheckedAt)
                        };

                        if (server.IsDefault)
                        {
                            await _hubContext.Clients.All.SendAsync("ServerStatusUpdated", pingPayload, stoppingToken);
                        }
                        else if (!string.IsNullOrEmpty(server.SessionId))
                        {
                            await _hubContext.Clients.Group(server.SessionId).SendAsync("ServerStatusUpdated", pingPayload, stoppingToken);
                        }
                    }
                        catch(Exception ex) when (!stoppingToken.IsCancellationRequested)
                            {
                                _logger.LogWarning(ex, "Failed ping cycle for server ID {ServerId} ({Url}). Rescheduling.", server.Id, server.Url);
                                server.NextCheckTime = DateTime.UtcNow.AddSeconds(Math.Max(server.IntervalSeconds, 15));
                                await db.SaveChangesAsync(stoppingToken);
                            }
                    }
            }
            catch(Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation(ex,"Unhandled exception in CheckerService execution loop.");
            }

            await Task.Delay(1000, stoppingToken);
    }
    }
}