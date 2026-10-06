import React, { useEffect, useState, useCallback } from 'react';
import type { Server, ServerStatusUpdatedEvent } from './types/monitor';
import { fetchServers, createServer, deleteServer, triggerManualPing } from './services/api';
import { useSignalR } from './hooks/useSignalR';
import { ServerCard } from './components/ServerCard';
import { PlusCircle, Activity } from 'lucide-react';

export default function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState(10);
  const [isAdding, setIsAdding] = useState(false);

  // 1. Initial hydration
  const loadData = async () => {
    try {
      const data = await fetchServers();
      setServers(data);
    } catch (err) {
      console.error('Error fetching servers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. Real-time updates via SignalR
  const handleStatusUpdate = useCallback((event: ServerStatusUpdatedEvent) => {
    setServers((prevServers) =>
      prevServers.map((s) => {
        if (s.id !== event.serverId) return s;

        const updatedPings = [event.ping, ...(s.pingLogs || [])].slice(0, 10);

        return {
          ...s,
          isUp: event.isUp,
          lastResponseTimeMs: event.lastResponseTimeMs,
          pingLogs: updatedPings,
        };
      })
    );
  }, []);

  useSignalR(handleStatusUpdate);

  // 3. Actions
  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    try {
      const newServer = await createServer({ name, url, intervalSeconds: Number(interval) });
      setServers((prev) => [...prev, { ...newServer, pingLogs: [] }]);
      setName('');
      setUrl('');
      setIsAdding(false);
    } catch {
      alert('Error creating server');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this monitor?')) return;
    await deleteServer(id);
    setServers((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <Activity size={28} color="#38bdf8" />
          <h1 style={styles.appTitle}>UptimePulse</h1>
        </div>
        <button style={styles.addBtn} onClick={() => setIsAdding(!isAdding)}>
          <PlusCircle size={18} /> Add Target
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddServer} style={styles.formCard}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Add New Server Target</h3>
          <div style={styles.formRow}>
            <input
              placeholder="Display Name (e.g. GitHub)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
            />
            <input
              placeholder="URL (e.g. https://github.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              style={styles.input}
            />
            <input
              type="number"
              min="5"
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              placeholder="Interval (sec)"
              style={{ ...styles.input, width: '120px' }}
            />
            <button type="submit" style={styles.submitBtn}>
              Start Monitoring
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p style={{ color: '#94a3b8' }}>Loading telemetry...</p>
      ) : (
        <div style={styles.grid}>
          {servers.map((s) => (
            <ServerCard key={s.id} server={s} onDelete={handleDelete} onPing={triggerManualPing} />
          ))}
          {servers.length === 0 && (
            <p style={{ color: '#94a3b8' }}>No servers monitored yet. Add one above!</p>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  appTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1.2rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  formCard: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    padding: '1.25rem',
    borderRadius: '8px',
    marginBottom: '2rem',
  },
  formRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    minWidth: '200px',
    padding: '0.6rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#fff',
  },
  submitBtn: {
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1.2rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.25rem',
  },
};