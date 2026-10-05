namespace Backend.Api.Dtos;

public record UpdateServerDto(
    string Url,
    string? Name,
    int IntervalSeconds,
    bool IsActive
);