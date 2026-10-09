# Uptime Checker

A real time server monitoring sandbox that tracks Uptime of servers.

## Links

- **GitHub:** [UptimeChecker](https://github.com/Goktug-Dal/UptimeChecker)
- **LinkedIn:** [Göktuğ Dal](https://www.linkedin.com/in/goktug-dal-48733832b/)
- **Backend:** Coming soon
- **Live Demo:** Coming soon

## Features

- Continuous health checks with configurable intervals
- Real-time status and latency updates via SignalR
- Guest sessions for custom monitors
- SSRF protection against internal network targets
- Automatic cleanup of ping records older than 24 hours

## Tech Stack

- **Backend:** .NET, C#, Minimal APIs
- **Real-Time:** ASP.NET Core SignalR
- **Database:** PostgreSQL, Entity Framework Core
- **Frontend:** React, TypeScript, Tailwind CSS

## Getting Started

### Prerequisites

- .NET SDK matching the backend target framework
- PostgreSQL 14+
- Node.js 18+

### 1. Configure the Database

Set your PostgreSQL connection string in `Backend/appsettings.json` or through the `ConnectionStrings__DefaultConnection` environment variable.

### 2. Run the Backend

```bash
cd Backend
dotnet ef database update
dotnet run
```

See [`Backend/README.md`](Backend/README.md) for backend configuration and setup details.

### 3. Run the Frontend

Open a separate terminal:

```bash
cd Frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

See [`Frontend/README.md`](Frontend/README.md) for frontend setup and API integration details.
