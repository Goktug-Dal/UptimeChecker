using System.Diagnostics;
using System.Net.Http;

namespace Backend.Api.Services;

public interface IPingerService{
    Task<PingResult> PingAsync(string url, CancellationToken cancellationToken = default);
}

public class PingerService : IPingerService
{
    private readonly IHttpClientFactory httpFact;

    public PingerService(IHttpClientFactory httpFactory)
    {
        httpFact = httpFactory;
    }
    public async Task<PingResult> PingAsync(string url, CancellationToken cancellationToken = default)
    {
        var client = httpFact.CreateClient("Pinger");
        var timer = Stopwatch.StartNew();   

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Head, url);
            using var response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken
            );

            timer.Stop();

            return new PingResult(
                StatusCode: (int) response.StatusCode,
                ResponseTimeMs: (int) timer.ElapsedMilliseconds,
                IsSuccess: response.IsSuccessStatusCode,
                ErrMessage: null
            );
        }
        catch(TaskCanceledException){
            timer.Stop();
            return new PingResult(
                StatusCode: 0,
                ResponseTimeMs: (int) timer.ElapsedMilliseconds,
                IsSuccess: false,
                ErrMessage: "Request timed out"
            );
        }
        catch(Exception e){
            timer.Stop();
            return new PingResult(
                StatusCode: 0,
                ResponseTimeMs: (int) timer.ElapsedMilliseconds,
                IsSuccess: false,
                ErrMessage: e.Message
            );
        }// may add finally for extra stuff later 
    }

}

