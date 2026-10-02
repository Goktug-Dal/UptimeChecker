namespace Backend.Api.Models;

public class Ping{
    public long Id {get; set;}


    public int ServerId {get; set;}
    public Server? Server{get; set;}


    public int StatusCode {get; set;}
    public int ResponseTimeMs{get; set;} // go + get back
    public bool IsSuccess{get; set;}
    public string? ErrMessage{get; set;}
    public DateTime CheckedAt{get; set;} = DateTime.UtcNow;
}