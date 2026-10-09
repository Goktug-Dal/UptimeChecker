using Microsoft.AspNetCore.SignalR;

namespace Backend.Api.Hubs;

public class ServerStatusHub : Hub
{
    public async Task JoinSession(string sessionId)
    {
        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, sessionId.Trim());
        }
    }

    public async Task LeaveSession(string sessionId)
    {
        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId.Trim());
        }
    }
}