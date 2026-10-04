namespace Backend.Api.Dtos;

public record CreateServerDto(
    string Url,
    string? Name,
    int? IntervalSeconds

);