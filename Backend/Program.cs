using System.Threading.RateLimiting;
using Backend.Api.Context;
using Backend.Api.Hubs;
using Backend.Api.Models;
using Backend.Api.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;



var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

//database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "https://uptime-checker-red.vercel.app")
            .WithMethods("GET", "POST", "DELETE", "PUT")
            .AllowAnyHeader()
            .AllowCredentials(); // Essential for SignalR WebSockets
    });
});



builder.Services.AddHttpClient("Pinger", client =>{
    client.Timeout = TimeSpan.FromSeconds(5);
    client.DefaultRequestVersion = System.Net.HttpVersion.Version11;
    client.DefaultVersionPolicy = HttpVersionPolicy.RequestVersionOrLower;
    //need these 3 for general linking
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    client.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
    client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
}).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    AllowAutoRedirect = false,
    PooledConnectionLifetime = TimeSpan.FromMinutes(10),
    PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),  
    EnableMultipleHttp2Connections = true
});

builder.Services.AddSingleton<IPingerService, PingerService>();



builder.Services.AddHostedService<CheckerService>();
builder.Services.AddHostedService<CleanerService>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("StrictIpLimit", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions{
            PermitLimit = 15,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
    });
    });
});

builder.Services.Configure<HostOptions>(opts =>
{
    opts.ShutdownTimeout = TimeSpan.FromSeconds(3); // 30 -> 3sec
});




var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    if(!db.Servers.Any(s => s.IsDefault))
    {
        db.Servers.AddRange(
            new Server {Name = "Cloudflare", Url = "https://cloudflare.com", IntervalSeconds = 10, IsDefault = true, IsUp = true},
            new Server {Name = "Linkedin", Url = "https://linkedin.com", IntervalSeconds = 10, IsDefault = true, IsUp = true},
            new Server {Name = "Github", Url = "https://github.com", IntervalSeconds = 10, IsDefault = true, IsUp = true}
        );
        db.SaveChanges();
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("ReactApp");
app.UseRateLimiter();

app.MapServerEndPoints();//endpoints
app.MapHub<ServerStatusHub>("/hubs/server-status"); //signalr

app.Run();




// var summaries = new[]
// {
//     "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
// };

// app.MapGet("/weatherforecast", () =>
// {
//     var forecast =  Enumerable.Range(1, 5).Select(index =>
//         new WeatherForecast
//         (
//             DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
//             Random.Shared.Next(-20, 55),
//             summaries[Random.Shared.Next(summaries.Length)]
//         ))
//         .ToArray();
//     return forecast;
// })
// .WithName("GetWeatherForecast");

// app.Run();

// record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
// {
//     public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
// }
