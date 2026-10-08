import React, { useEffect, useState } from 'react';
import type { Server } from '../types/monitor';
import {
  Play,
  Trash2,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';

interface Props {
  server: Server;
  onDelete: (id: number) => void;
  onPing: (id: number) => Promise<void>;
  onUpdateInterval?: (id: number, newInterval: number) => Promise<void>;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

// 2-bar horizontal drag handle replacing the 6 dots (:::)
const DragHandleIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="4" y1="16" x2="20" y2="16" />
  </svg>
);

const SLOTS = 15;

function timeAgo(iso?: string, now: number = Date.now()): string {
  if (!iso) return 'Not checked yet';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function ensureAbsoluteUrl(rawUrl: string): string {
  if (!rawUrl) return '#';
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function getFaviconDomain(host: string): string {
  const clean = host.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (clean.includes('whatsapp.com')) return 'whatsapp.com';
  if (clean.includes('github.com')) return 'github.com';
  if (clean.includes('cloudflare.com') || clean === '1.1.1.1') return 'cloudflare.com';

  const parts = clean.split('.');
  if (parts.length > 2 && !clean.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return parts.slice(-2).join('.');
  }
  return clean;
}

function getDisplayName(server: Server): string {
  const host = hostOf(server.url).toLowerCase();
  const name = (server.name || '').trim();

  if (host.includes('whatsapp') && (!name || name.toLowerCase().includes('youtube'))) {
    return 'WhatsApp Web';
  }

  if (name) return name;

  if (host.includes('web.whatsapp.com') || host.includes('whatsapp.com')) {
    return 'WhatsApp Web';
  }
  if (host.includes('github.com')) return 'GitHub';
  if (host.includes('cloudflare.com') || host === '1.1.1.1') return 'Cloudflare';

  return host;
}

const Thumb: React.FC<{ host: string; label: string }> = ({ host, label }) => {
  const favDomain = getFaviconDomain(host);
  const [imgSrc, setImgSrc] = useState(
    `https://www.google.com/s2/favicons?domain=${favDomain}&sz=64`
  );
  const [hasError, setHasError] = useState(false);

  const isWhatsApp = favDomain.includes('whatsapp');
  const fallbackBg = isWhatsApp ? '#25d366' : '#3b82f6';

  const handleError = () => {
    if (!imgSrc.includes('duckduckgo')) {
      setImgSrc(`https://icons.duckduckgo.com/ip3/${favDomain}.ico`);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="card-thumb" aria-hidden="true">
      {hasError ? (
        <span
          className="card-thumb__letter"
          style={{ backgroundColor: fallbackBg, color: '#fff' }}
        >
          {label.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img src={imgSrc} alt="" onError={handleError} />
      )}
    </div>
  );
};

export const ServerCard: React.FC<Props> = ({
  server,
  onDelete,
  onPing,
  onUpdateInterval,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging = false,
}) => {
  const [isPinging, setIsPinging] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const handleIntervalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    if (!onUpdateInterval || val === server.intervalSeconds) return;
    setIsUpdatingInterval(true);
    try {
      await onUpdateInterval(server.id, val);
    } finally {
      setIsUpdatingInterval(false);
    }
  };

  const handleManualPing = async () => {
    setIsPinging(true);
    try {
      await onPing(server.id);
    } finally {
      setIsPinging(false);
    }
  };

  const host = hostOf(server.url);
  const label = getDisplayName(server);

  const recent = (server.pingLogs || []).slice(0, SLOTS);
  const chrono = [...recent].reverse();
  const emptySlots = Math.max(0, SLOTS - chrono.length);
  const maxMs = Math.max(100, ...recent.map((p) => p.responseTimeMs || 0));

  const successes = recent.filter((p) => p.isSuccess).length;
  const uptime = recent.length ? Math.round((successes / recent.length) * 100) : null;

  const avgMs = recent.length
    ? Math.round(recent.reduce((sum, p) => sum + (p.responseTimeMs || 0), 0) / recent.length)
    : server.lastResponseTimeMs || 0;

  const baselinePercent = Math.min(90, Math.max(15, (avgMs / maxMs) * 100));

  const latest = recent[0];
  const lastChecked = latest?.checkedAt ?? server.lastCheckedAt;
  const lastError = !server.isUp && latest?.errMessage ? latest.errMessage : null;

  const latency = server.lastResponseTimeMs ?? 0;
  const latencyClass =
    latency <= 100 ? 'stat-latency--fast' : latency <= 300 ? 'stat-latency--normal' : 'stat-latency--slow';

  return (
    <li
      className={`dd-card ${server.isUp ? 'dd-card--ok' : 'dd-card--down'} ${
        isDragging ? 'dd-card--dragging' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Top Header of Card with Clean Drag Handle */}
      <div className="dd-card__header">
        <div className="dd-card__header-left">
          <div
            className="dd-card__drag-handle"
            title="Drag to reorder monitor"
            aria-label="Drag to reorder monitor"
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <DragHandleIcon />
          </div>

          <Thumb host={host} label={label} />
          <div className="dd-card__info">
            <div className="dd-card__title-row">
              <h3 className="dd-card__name" title={label}>{label}</h3>
              <a
                href={ensureAbsoluteUrl(server.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="dd-card__outlink"
                title={`Visit ${ensureAbsoluteUrl(server.url)}`}
              >
                <ArrowUpRight size={13} />
              </a>
            </div>
            <div className="dd-card__host-row">
              <span className="dd-card__host">{host}</span>
              <span className="dd-card__dot">•</span>
              <span>{timeAgo(lastChecked, now)}</span>
            </div>
          </div>
        </div>

        {/* Downdetector Status Pill */}
        <div className="dd-card__status-pill">
          {server.isUp ? (
            <span className="dd-status-tag dd-status-tag--ok">
              <CheckCircle2 size={13} />
              No problems detected
            </span>
          ) : (
            <span className="dd-status-tag dd-status-tag--down">
              <AlertTriangle size={13} />
              Possible problems
            </span>
          )}
        </div>
      </div>

      {/* Error Callout if Down */}
      {lastError && (
        <div className="dd-card__error-banner" title={lastError}>
          <AlertTriangle size={13} />
          <span>{lastError}</span>
        </div>
      )}

      {/* Downdetector Probe Timeline Chart */}
      <div className="dd-card__chart-section">
        <div className="dd-chart-top">
          <span className="dd-chart-top__label">
            <Activity size={12} />
            Probe Timeline ({SLOTS} checks)
          </span>
          <span className="dd-chart-top__avg">
            Avg: <strong>{avgMs} ms</strong>
          </span>
        </div>

        <div className="dd-sparkline" aria-label={`Latency timeline for ${label}`}>
          {/* Baseline dotted line */}
          <div
            className="dd-sparkline__baseline"
            style={{ bottom: `${baselinePercent}%` }}
            title={`Average baseline: ${avgMs}ms`}
          />

          {/* Empty slot placeholders */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="dd-sparkline__bar dd-sparkline__bar--empty" />
          ))}

          {/* Probe bars */}
          {chrono.map((ping, i) => {
            const h = Math.max(12, Math.min(100, ((ping.responseTimeMs || 0) / maxMs) * 100));
            const isNewest = i === chrono.length - 1;
            const formattedTime = new Date(ping.checkedAt).toLocaleTimeString();
            const tooltip = `${ping.isSuccess ? '200 OK' : 'FAIL'}: ${ping.responseTimeMs}ms (${formattedTime})`;

            return (
              <div
                key={`${server.id}-slot-${i}-${ping.id ?? 'log'}-${ping.checkedAt ?? ''}`}
                className={`dd-sparkline__bar ${
                  ping.isSuccess ? 'dd-sparkline__bar--ok' : 'dd-sparkline__bar--fail'
                } ${isNewest ? 'dd-sparkline__bar--newest' : ''}`}
                style={{ height: `${h}%` }}
                title={tooltip}
                tabIndex={0}
              >
                <span className="dd-sparkline__tooltip">{tooltip}</span>
              </div>
            );
          })}
        </div>

        <div className="dd-chart-bottom">
          <span>{SLOTS} probes ago</span>
          <span className="dd-chart-bottom__mid">baseline {avgMs}ms</span>
          <span>Latest probe</span>
        </div>
      </div>

      {/* Card Footer: Latency, Uptime & Actions */}
      <div className="dd-card__footer">
        <div className="dd-card__metrics">
          <div className="metric-item">
            <span className="metric-label">Latency</span>
            <span className={`metric-value ${latencyClass}`}>
              {server.lastResponseTimeMs ?? 0} <small>ms</small>
            </span>
          </div>

          <div className="metric-item">
            <span className="metric-label">Uptime</span>
            <span className={`metric-value ${uptime !== null && uptime < 100 ? 'text-amber' : 'text-green'}`}>
              {uptime === null ? '—' : `${uptime}%`}
            </span>
          </div>
        </div>

        <div className="dd-card__actions">
          {/* Interval Selector */}
          <div className="dd-interval-badge" title="Check interval">
            <span className="dd-interval-label">Every:</span>
            {!(server.isDefault ?? (server as any).IsDefault) && onUpdateInterval ? (
              <select
                className="dd-interval-select"
                value={server.intervalSeconds || 15}
                onChange={handleIntervalChange}
                disabled={isUpdatingInterval}
                title="Change check frequency"
              >
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            ) : (
              <span className="dd-interval-static">{server.intervalSeconds || 15}s</span>
            )}
          </div>

          <button
            type="button"
            className="dd-action-btn dd-action-btn--ping"
            onClick={handleManualPing}
            disabled={isPinging}
            title="Probe endpoint now"
          >
            {isPinging ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            <span>{isPinging ? 'Pinging…' : 'Ping'}</span>
          </button>

          <button
            type="button"
            className={`dd-action-btn dd-action-btn--logs ${showLogs ? 'dd-action-btn--active' : ''}`}
            onClick={() => setShowLogs(!showLogs)}
            title="Toggle recent probe telemetry"
          >
            {showLogs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>Logs</span>
          </button>

          {!(server.isDefault ?? (server as any).IsDefault) && (
            <button
              type="button"
              className="dd-action-btn dd-action-btn--delete"
              onClick={() => onDelete(server.id)}
              title="Delete this monitor"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Telemetry Drawer */}
      {showLogs && (
        <div className="dd-card__logs-drawer">
          <div className="logs-drawer__title">
            <span>Recent Telemetry Logs</span>
            <span className="logs-count">{recent.length} records</span>
          </div>

          {recent.length === 0 ? (
            <p className="logs-empty">No telemetry collected yet for this endpoint.</p>
          ) : (
            <div className="logs-table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>HTTP Code</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((log, idx) => (
                    <tr key={`${server.id}-row-${idx}-${log.id ?? 'log'}-${log.checkedAt ?? ''}`}>
                      <td>
                        <span className={`log-pill ${log.isSuccess ? 'log-pill--ok' : 'log-pill--fail'}`}>
                          {log.isSuccess ? 'OK' : 'Error'}
                        </span>
                      </td>
                      <td className="font-mono">{log.responseTimeMs} ms</td>
                      <td className="font-mono">{log.statusCode || (log.isSuccess ? 200 : 'ERR')}</td>
                      <td className="font-mono text-muted">{new Date(log.checkedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </li>
  );
};