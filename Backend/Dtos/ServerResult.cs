using Microsoft.AspNetCore.Mvc;
namespace Backend.Api.Dtos;

public record ServerResult(
  int Id,
  string Url,
  string Name,
  int IntervalSeconds,
  bool IsActive,
  bool IsUp,
  int LastResponseTimeMs,
  List<PingResult> PingLogs
);