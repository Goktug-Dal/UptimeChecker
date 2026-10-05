namespace Backend.Api.Dtos;


//half of pingresult
public record ProbeResult(
    int StatusCode,
    int ResponseTimeMs,
    bool IsSuccess,
    string? ErrMessage
);