using Microsoft.AspNetCore.Mvc;
namespace Backend.Api.Dtos;

public record PingResult(
  long Id,
  int StatusCode,
  int ResponseTimeMs,
  bool IsSuccess,
  string? ErrMessage,
  DateTime CheckedAt
);