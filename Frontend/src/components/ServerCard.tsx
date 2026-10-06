import React, { useEffect, useState } from 'react';
import type { Server } from '../types/monitor';
import { Play, Trash2, Loader2 } from 'lucide-react';

interface Props {
  server: Server;
  onDelete: (id: number) => void;
  onPing: (id: number) => Promise<void>;
}

const SLOTS = 10;

function timeAgo(iso?: string, now: number = Date.now()): string {
  if (!iso) return 'not checked yet';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const Thumb: React.FC<{ host: string; label: string }> = ({ host, label }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="thumb" aria-hidden="true">
      {failed ? (
        label.charAt(0).toUpperCase()
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

export const ServerCard: React.FC<Props> = ({ server, onDelete, onPing }) => {
  const [isPinging, setIsPinging] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const handleManualPing = async () => {
    setIsPinging(true);
    try {
      await onPing(server.id);
    } finally {
      setIsPinging(false);
    }
  };

  const host = hostOf(server.url);
  const label = server.name || host;

  // pingLogs arrive newest-first; draw oldest -> newest
  const recent = (server.pingLogs || []).slice(0, SLOTS);
  const chrono = [...recent].reverse();
  const emptySlots = SLOTS - chrono.length;
  const maxMs = Math.max(100, ...recent.map((p) => p.responseTimeMs));

  const successes = recent.filter((p) => p.isSuccess).length;
  const uptime = recent.length ? Math.round((successes / recent.length) * 100) : null;

  const latest = recent[0];
  const lastChecked = latest?.checkedAt ?? server.lastCheckedAt;
  const lastError = !server.isUp && latest?.errMessage ? latest.errMessage : null;

  return (
    <li className="row">
      <Thumb host={host} label={label} />

      <div style={{ minWidth: 0 }}>
        <div className="row__name">{label}</div>
        <div className="row__meta">
          <a href={server.url} target="_blank" rel="noreferrer">
            {host}
          </a>
          <span className="dot" />
          <span>every {server.intervalSeconds}s</span>
          <span className="dot" />
          <span>{uptime === null ? 'no data yet' : `${uptime}% uptime`}</span>
          <span className="dot" />
          <span>{timeAgo(lastChecked, now)}</span>
        </div>
        {lastError && <div className="row__error">{lastError}</div>}
      </div>

      <div className="spark" aria-label="Recent latency">
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`e-${i}`} className="spark__bar spark__bar--empty" />
        ))}
        {chrono.map((ping, i) => {
          const h = Math.max(12, Math.min(100, (ping.responseTimeMs / maxMs) * 100));
          const isNewest = i === chrono.length - 1;
          return (
            <div
              key={ping.id}
              title={`${ping.statusCode} · ${ping.responseTimeMs}ms · ${new Date(
                ping.checkedAt
              ).toLocaleTimeString()}`}
              className={`spark__bar ${ping.isSuccess ? '' : 'spark__bar--fail'} ${
                isNewest ? 'spark__bar--new' : ''
              }`}
              style={{ ['--h' as string]: `${h}%` }}
            />
          );
        })}
      </div>

      <div className="row__stat">
        <div className="row__latency">{server.lastResponseTimeMs} ms</div>
        <span className={`badge ${server.isUp ? '' : 'badge--down'}`}>
          <i />
          {server.isUp ? 'Operational' : 'Failing'}
        </span>
      </div>

      <div className="row__actions">
        <button
          className="icon-btn"
          onClick={handleManualPing}
          disabled={isPinging}
          title="Ping now"
          aria-label={`Ping ${label} now`}
        >
          {isPinging ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
        </button>
        <button
          className="icon-btn icon-btn--danger"
          onClick={() => onDelete(server.id)}
          title="Delete target"
          aria-label={`Delete ${label}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
};
