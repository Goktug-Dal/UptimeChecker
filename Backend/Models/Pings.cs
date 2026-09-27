namespace Backend.Api.Models;

public class Pings{
    public long Id {get; set;}


    public int MonitorId {get; set;}
    public Servers? Server{get; set;}


    public int StatusCode {get; set;}
    public int ResponseTimeMs{get; set;} // go + get back
    public bool IsSucess{get; set;}
    public string? ErrMessage{get; set;}
    public DateTime CheckedAt{get; set;} = DateTime.UtcNow;
}