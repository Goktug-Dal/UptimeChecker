# Uptime Checker – Backend
A server that can monitor if other websites are working.

# Links
GitHub: https://github.com/Goktug-Dal/UptimeChecker

LinkedIn: [Göktuğ Dal](https://www.linkedin.com/in/goktug-dal-48733832b)

Backend: Coming soon

Live Demo: Coming soon

## 1. Local Setup

### Requirements

- .NET SDK matching the project's target framework
- PostgreSQL 14+
- Entity Framework Core CLI (`dotnet-ef`)

### Installation

**1. Clone the repository**

```bash
git clone <repository-url>
cd <project-directory>
```

**2. Configure the database**

Make sure PostgreSQL is running and create a database named `uptimedb`.

Configure the connection string in `appsettings.json` or through environment variables. See [Configuration Settings](#7-configuration-settings).

**3. Apply database migrations**

```bash
dotnet ef database update
```

**4. Run the application**

```bash
dotnet run
```

The backend is now running at the URL shown in the terminal.

### Database Migrations

After making database schema changes, create and apply a migration:

```bash
dotnet ef migrations add <MigrationName>
dotnet ef database update
```

## 2. Core Components

- **CheckerService (`BackgroundService`)**: Checks active monitors when they are due, saves ping results to PostgreSQL, schedules future checks, and removes ping records older than 24 hours.
- **ServersEndpoints (Minimal API)**: Handles monitor CRUD operations, manual ping requests, and session cleanup.
- **ServerStatusHub (SignalR)**: Sends real-time status updates while isolating sessions.
- **AppDbContext (EF Core)**: Manages database operations and server-to-ping relationships, with indexes for faster queries.

## 3. Security

### SSRF Protection

Submitted URLs are validated using DNS resolution to help prevent requests to internal networks.

Blocked address ranges include:

- **Private IPv4:** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- **Link-local and cloud metadata:** `169.254.0.0/16`
- **Loopback:** `127.0.0.0/8`, `localhost`, `::1`
- **IPv6 unique-local:** `fc00::/7`

Only HTTP and HTTPS URLs are allowed.

### Session Isolation

- Default demo monitors cannot be modified or deleted by users.
- Custom monitors require a `sessionId` for ownership checks.
- Custom monitor updates are broadcast only to the corresponding SignalR session group.
- Default monitor updates are broadcast to all clients.

## 4. Data Retention

Ping records older than 24 hours are automatically deleted to prevent unlimited database growth.

```csharp
var oneDayLimit = DateTime.UtcNow.AddDays(-1);

await db.Pings
    .Where(p => p.CheckedAt < oneDayLimit)
    .ExecuteDeleteAsync(stoppingToken);
```

Only records in the `Pings` table are deleted. Server records and default demo monitors remain intact.

## 5. API Endpoints

### Monitor Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/servers` | Lists default and session-owned monitors |
| `GET` | `/servers/{id}/pings` | Retrieves up to 50 historical ping records |
| `POST` | `/servers` | Creates a monitor |
| `PUT` | `/servers/{id}` | Updates a custom monitor |
| `DELETE` | `/servers/{id}` | Deletes a custom monitor |

Custom monitor creation, updates, and deletion require a `sessionId`. Listing monitors and retrieving ping history accept an optional `sessionId`.

**Create a monitor**

`POST /servers?sessionId={sessionId}`

```json
{
  "url": "https://api.example.com",
  "name": "Production API",
  "intervalSeconds": 15
}
```

**Update a monitor**

`PUT /servers/{id}?sessionId={sessionId}`

```json
{
  "url": "https://api.example.com",
  "name": "Production API (Updated)",
  "intervalSeconds": 30,
  "isActive": true
}
```

### Manual Diagnostics and Cleanup

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/servers/{id}/ping` | Runs an immediate ping and broadcasts the result |
| `POST` | `/sessions/{sessionId}/cleanup` | Deletes custom monitors belonging to a session |

Creating monitors and triggering manual pings are rate-limited.

### Common Responses

- `200 OK` — Request completed successfully.
- `201 Created` — Monitor created.
- `204 No Content` — Update or deletion completed.
- `400 Bad Request` — Invalid input or prohibited operation.
- `403 Forbidden` — Access denied.
- `404 Not Found` — Monitor not found.

## 6. Real-Time Updates (SignalR)

**Hub URL:** `/hubs/server-status`

### Client Methods

- `JoinSession(sessionId)` — Subscribes to updates for a session.
- `LeaveSession(sessionId)` — Unsubscribes from session updates.

### Server Event

`ServerStatusUpdated` is sent when a ping completes.

Example payload:

```json
{
  "serverId": 4,
  "isUp": true,
  "lastResponseTimeMs": 54,
  "ping": {
    "id": 892,
    "statusCode": 200,
    "responseTimeMs": 54,
    "isSuccess": true,
    "errMessage": null,
    "checkedAt": "2026-10-09T15:45:00.123Z"
  }
}
```

## 7. Configuration Settings

The application can be configured through `appsettings.json` or environment variables. Environment variables use double underscores (`__`) to represent nested configuration keys.

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string | `Host=localhost;Port=5432;Database=uptimedb;Username=postgres;Password=your-password` |
| `Logging__LogLevel__Default` | Default application logging level | `Information` |
| `Logging__LogLevel__Microsoft.AspNetCore` | ASP.NET Core logging level | `Warning` |

### Example `appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=uptimedb;Username=postgres;Password=your-password"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

**Configuration notes:**

- Replace `your-password` with your PostgreSQL password at connection string.
- Use the database host and credentials appropriate for your environment.
- In production, store credentials in environment variables or a secret manager rather than committing them to source control.
- Environment variables override corresponding values from `appsettings.json` by default.

For full experience run : npm run dev , on frontend to get the fullstack.
