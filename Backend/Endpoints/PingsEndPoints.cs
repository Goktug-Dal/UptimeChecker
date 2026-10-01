using System.Timers;
using System.Net.Http;

public static class PingsEndPoints
{
    //static System.Diagnostics.Stopwatch timer = new System.Timers.Timer(1000);
    
    const string GetEndPointName = "GetPings";
    public static void MapPingsEndPoints(this WebApplication app)
    {
        
    }

    // public static void Pinger(async, string url)
    // {
    //     HttpClient html_link = new HttpClient();
    //     HttpResponseMessage response = await html_link.GetAsync("s");
    //     timer.Start();
    //     string result = await response.Content.ReadAsStringAsync();
    
    //     timer.Stop();
    //     // return timer, result
    // }
}