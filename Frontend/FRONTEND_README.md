# Uptime Checker — Frontend

A real-time website and API availability monitoring dashboard built with **React, TypeScript, and SignalR**.

## Project Links

- **GitHub:** [UptimeChecker](https://github.com/Goktug-Dal/UptimeChecker)
- **LinkedIn:** [Göktuğ Dal](https://www.linkedin.com/in/goktug-dal-48733832b/)
- **Backend:** Coming soon
- **Live Demo:** Coming soon

## Features

- **Real-time monitoring:** Track availability and response times through SignalR WebSockets.
- **Custom monitors:** Add HTTP/HTTPS endpoints with automatic URL normalization.
- **Configurable intervals:** Choose between 10, 15, 30, and 60-second probe intervals.
- **Quick-add presets:** Quickly monitor IMDb, GitHub, and Amazon.
- **Latency charts:** View the latest 15 probe results in sparkline charts.
- **Historical logs:** Inspect detailed ping results in a telemetry table.
- **Drag-and-drop reordering:** Organize monitors with order persistence in local storage.
- **Guest session isolation:** Separate user-created monitors by session, with automatic cleanup when a tab closes.
- **Protected system monitors:** Prevent deletion of core demo monitors.

## Tech Stack

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Development server and build tool |
| `@microsoft/signalr` | Real-time communication |
| `lucide-react` | Icons |
| CSS | Styling and layout |

## Project Structure

```text
Frontend/
├── public/
│   └── logo.png
├── src/
│   ├── components/
│   │   └── ServerCard.tsx
│   ├── hooks/
│   │   └── useSignalR.ts
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── monitor.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm, pnpm, or yarn
- A running instance of the [backend](#project-links)

### Installation

**1. Navigate to the frontend directory**

```bash
cd Frontend
```

**2. Install dependencies**

```bash
npm install
```

**3. Add the application logo**

Ensure `logo.png` exists at `Frontend/public/logo.png`.

**4. Start the development server**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The backend must also be running and accessible at `http://localhost:5119`.

## API Integration

### REST API

Implemented in `src/services/api.ts`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/servers?sessionId={sid}` | Fetch monitors for the session |
| `POST` | `/servers?sessionId={sid}` | Add a monitor |
| `PUT` | `/servers/{id}?sessionId={sid}` | Update monitor settings |
| `DELETE` | `/servers/{id}?sessionId={sid}` | Delete a custom monitor |
| `POST` | `/servers/{id}/ping?sessionId={sid}` | Trigger an immediate ping |
| `POST` | `/sessions/{sid}/cleanup` | Clean up session monitors |

### SignalR

Implemented in `src/hooks/useSignalR.ts`.

- **Hub URL:** `http://localhost:5119/hubs/server-status`
- **Session management:** Calls `JoinSession(sessionId)` on connection and reconnection.
- **Real-time events:** Receives `ServerStatusUpdated` events containing ping results and monitor status changes.

Dont forget to run the backend for fullstack! 