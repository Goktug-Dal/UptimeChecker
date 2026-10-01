namespace Backend.Api.Services;

public record PingResult(
  int StatusCode,
  int ResponseTimeMs,
  bool IsSuccess,
  string? ErrMessage
);