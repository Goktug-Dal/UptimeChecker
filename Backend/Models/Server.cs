namespace Backend.Api.Models;

public class Server{
    public int Id {get; set;}
    public required string Url {get; set;}
    public string? Name {get; set;}

    

    public int IntervalSeconds{get; set;} = 60;
    public DateTime NextCheckTime{get; set;} = DateTime.UtcNow;
    public bool IsActive {get; set;} = true;

    public bool IsUp{get; set;} = true;
    public int LastResponseTimeMs {get; set;}
    public DateTime? LastCheckedAt{get; set;}


    public bool IsDefault{get; set;} = false;
    public string? SessionId {get; set;}
    public DateTime CreatedAt {get; set;} = DateTime.UtcNow;


    public List<Ping> PingLogs{get; set;} = new();
}