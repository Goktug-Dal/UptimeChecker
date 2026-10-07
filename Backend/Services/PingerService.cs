using System.Diagnostics;
using System.Net.Http;
using Backend.Api.Dtos;

namespace Backend.Api.Services;

public interface IPingerService{
    Task<ProbeResult> PingAsync(string url, CancellationToken cancellationToken = default);
}

public class PingerService : IPingerService
{
    private readonly IHttpClientFactory httpFact;

    public PingerService(IHttpClientFactory httpFactory)
    {
        httpFact = httpFactory;
    }
    public async Task<ProbeResult> PingAsync(string url, CancellationToken cancellationToken = default)
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

            if(response.StatusCode == System.Net.HttpStatusCode.MethodNotAllowed)
            {
                using var getRequest = new HttpRequestMessage(HttpMethod.Get, url);
                using var getResponse = await client.SendAsync(
                    getRequest,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken
                );

                timer.Stop();
                int getCode = (int)getResponse.StatusCode;
                bool isGetSuccess = getCode >= 200 && getCode < 400;

                return new ProbeResult(
                    StatusCode: getCode,
                    ResponseTimeMs: (int)timer.ElapsedMilliseconds,
                    IsSuccess: isGetSuccess,
                    ErrMessage: isGetSuccess? null: $"HTTP {getCode} {getResponse.ReasonPhrase}"
                );
            }

            timer.Stop();
            int statusCode = (int)response.StatusCode;
            bool isSuccess = statusCode >= 200 && statusCode < 400;

            return new ProbeResult(
                StatusCode: statusCode,
                ResponseTimeMs: (int) timer.ElapsedMilliseconds,
                IsSuccess: isSuccess,
                ErrMessage: isSuccess ? null : $"HTTP {statusCode} {response.ReasonPhrase}"
            );
        }
        catch(TaskCanceledException){
            timer.Stop();
            return new ProbeResult(
                StatusCode: 0,
                ResponseTimeMs: (int) timer.ElapsedMilliseconds,
                IsSuccess: false,
                ErrMessage: "Request timed out"
            );
        }
        catch(Exception e){
            timer.Stop();
            return new ProbeResult(
                StatusCode: 0,
                ResponseTimeMs: (int) timer.ElapsedMilliseconds,
                IsSuccess: false,
                ErrMessage: e.Message
            );
        }// may add finally for extra stuff later 
    }

}

