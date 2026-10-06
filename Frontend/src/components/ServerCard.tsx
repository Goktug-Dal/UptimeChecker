import React, { useState } from 'react';
import type { Server } from '../types/monitor';
import { Play, Trash2 } from 'lucide-react';

interface Props {
  server: Server;
  onDelete: (id: number) => void;
  onPing: (id: number) => Promise<void>;
}

export const ServerCard: React.FC<Props> = ({ server, onDelete, onPing }) => {
  const [isPinging, setIsPinging] = useState(false);

  const handleManualPing = async () => {
    setIsPinging(true);
    try {
      await onPing(server.id);
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <span
              style={{
                ...styles.indicator,
                backgroundColor: server.isUp ? '#22c55e' : '#ef4444',
              }}
            />
            <h3 style={styles.name}>{server.name || server.url}</h3>
          </div>
          <a href={server.url} target="_blank" rel="noreferrer" style={styles.url}>
            {server.url}
          </a>
        </div>

        <div style={styles.actions}>
          <button
            onClick={handleManualPing}
            disabled={isPinging}
            style={styles.iconBtn}
            title="Manual Ping"
          >
            <Play size={16} />
          </button>
          <button
            onClick={() => onDelete(server.id)}
            style={{ ...styles.iconBtn, color: '#ef4444' }}
            title="Delete Target"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div style={styles.metrics}>
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Status</span>
          <span style={{ ...styles.metricValue, color: server.isUp ? '#22c55e' : '#ef4444' }}>
            {server.isUp ? 'Operational' : 'Failing'}
          </span>
        </div>
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Latency</span>
          <span style={styles.metricValue}>{server.lastResponseTimeMs} ms</span>
        </div>
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Interval</span>
          <span style={styles.metricValue}>{server.intervalSeconds}s</span>
        </div>
      </div>

      <div style={styles.pingsSection}>
        <span style={styles.metricLabel}>Recent Latency (Last 10 checks)</span>
        <div style={styles.barsContainer}>
          {(server.pingLogs || []).slice(0, 10).map((ping) => (
            <div
              key={ping.id}
              title={`Status: ${ping.statusCode} | ${ping.responseTimeMs}ms | ${new Date(ping.checkedAt).toLocaleTimeString()}`}
              style={{
                ...styles.bar,
                backgroundColor: ping.isSuccess ? '#22c55e' : '#ef4444',
                height: `${Math.min(Math.max((ping.responseTimeMs / 500) * 24, 6), 24)}px`,
              }}
            />
          ))}
          {(!server.pingLogs || server.pingLogs.length === 0) && (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Waiting for first ping...</span>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    border: '1px solid #334155',
    color: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  indicator: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  name: {
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: 0,
  },
  url: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
  actions: {
    display: 'flex',
    gap: '0.25rem',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    padding: '0.75rem',
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginBottom: '2px',
  },
  metricValue: {
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  pingsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  barsContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    height: '24px',
  },
  bar: {
    width: '12px',
    borderRadius: '2px',
    cursor: 'pointer',
  },
};