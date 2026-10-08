using Backend.Api.Context;
using Microsoft.EntityFrameworkCore;

namespace Backend.Api.Services;

public class CleanerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CleanerService> _logger;

    public CleanerService(IServiceProvider serviceProvider, ILogger<CleanerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var sandboxThreshold = DateTime.UtcNow.AddHours(-2); //2 hours later from now on
                var expiredServers = await db.Servers.Where(s => !s.IsDefault && s.CreatedAt < sandboxThreshold).ToListAsync(stoppingToken);

                if (expiredServers.Any())
                {
                    db.Servers.RemoveRange(expiredServers);
                    await db.SaveChangesAsync(stoppingToken);
                    _logger.LogInformation("Deleted expired sandbox monitors");
                }


                var retentionThreshold = DateTime.UtcNow.AddHours(-24); // get last 24hours

                int deletedLogs = await db.Pings.Where(p => p.CheckedAt < retentionThreshold).ExecuteDeleteAsync(stoppingToken);

                if(deletedLogs > 0)
                {
                    _logger.LogInformation("Destroyed old ping records");
                }
            }
            catch(Exception ex)
            {
                _logger.LogInformation(ex, "Error occurred during Cleaner Service");
            }

            //per 30 minutes
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }

    






}