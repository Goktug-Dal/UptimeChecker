using Backend.Api.Context;
using Backend.Api.Models;
using Backend.Api.Services;
using Microsoft.EntityFrameworkCore;

public class CheckerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPingerService _pingerService;

    public CheckerService(IServiceScopeFactory scopeFactory, IPingerService pingerService){
        _scopeFactory = scopeFactory;
        _pingerService = pingerService;
    }
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using (var scope = _scopeFactory.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTime.UtcNow;

                var dueServers = await db.Servers.Where(s => s.IsActive && s.NextCheckTime <= now)
                    .ToListAsync(stoppingToken);

                
                foreach (var server in dueServers)
                {
                    
                    var result = await _pingerService.PingAsync(server.Url, stoppingToken);

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

                    server.IsUp = result.IsSuccess;
                    server.LastResponseTimeMs = result.ResponseTimeMs;
                    server.LastCheckedAt = DateTime.UtcNow;
                    server.NextCheckTime = DateTime.UtcNow.AddSeconds(server.IntervalSeconds);
                }


                await db.SaveChangesAsync(stoppingToken);   
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}