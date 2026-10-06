import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Server, ServerStatusUpdatedEvent } from './types/monitor';
import { fetchServers, createServer, deleteServer, triggerManualPing } from './services/api';
import { useSignalR } from './hooks/useSignalR';
import { ServerCard } from './components/ServerCard';
import { Activity } from 'lucide-react';

export default function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [intervalSec, setIntervalSec] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    const trimmed = url.trim();
    if (!trimmed) return;

    // be forgiving: "github.com" -> "https://github.com"
    const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    setIsSubmitting(true);
    setFormError(null);
    try {
      const newServer = await createServer({
        name: name.trim(),
        url: normalizedUrl,
        intervalSeconds: Number(intervalSec),
      });
      setServers((prev) => [...prev, { ...newServer, pingLogs: [] }]);
      setName('');
      setUrl('');
    } catch {
      setFormError("We couldn't add that target. Check the URL and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this monitor?')) return;
    await deleteServer(id);
    setServers((prev) => prev.filter((s) => s.id !== id));
  };

  // 4. Derived totals
  const totals = useMemo(() => {
    const up = servers.filter((s) => s.isUp).length;
    const down = servers.length - up;
    const avg = servers.length
      ? Math.round(servers.reduce((sum, s) => sum + (s.lastResponseTimeMs || 0), 0) / servers.length)
      : 0;
    return { up, down, avg };
  }, [servers]);

  const allGood = servers.length > 0 && totals.down === 0;

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">
            <Activity size={16} strokeWidth={2.5} />
          </span>
          UptimePulse
        </div>
        <span className="live">
          <i />
          Live updates
        </span>
      </header>

      <div className="layout">
        {/* Left: the "order summary" */}
        <section className="panel" aria-labelledby="monitors-title">
          <div className="panel__head">
            <h1 className="panel__title" id="monitors-title">
              Monitors
            </h1>
            <p className="panel__sub">
              {servers.length === 0
                ? 'Nothing is being watched yet.'
                : `${servers.length} ${servers.length === 1 ? 'target' : 'targets'}, refreshed in real time.`}
            </p>
          </div>

          {isLoading ? (
            <div className="list">
              <div className="skeleton-row" />
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </div>
          ) : servers.length === 0 ? (
            <div className="empty">
              <h2>No monitors yet</h2>
              <p>Add your first target on the right and checks start immediately.</p>
            </div>
          ) : (
            <ul className="list">
              {servers.map((s) => (
                <ServerCard key={s.id} server={s} onDelete={handleDelete} onPing={triggerManualPing} />
              ))}
            </ul>
          )}

          <dl className="totals">
            <div className="totals__row">
              <dt>Operational</dt>
              <dd>{totals.up}</dd>
            </div>
            <div className="totals__row">
              <dt>Failing</dt>
              <dd className={totals.down > 0 ? 'bad' : ''}>{totals.down}</dd>
            </div>
            <div className="totals__row">
              <dt>Average latency</dt>
              <dd>{totals.avg} ms</dd>
            </div>
            <div className="totals__row totals__row--final">
              <dt>Overall status</dt>
              <dd>{servers.length === 0 ? '—' : allGood ? 'All systems normal' : 'Attention needed'}</dd>
            </div>
          </dl>
        </section>

        {/* Right: the "payment form" */}
        <aside className="panel panel--form">
          <form onSubmit={handleAddServer} noValidate={false}>
            <h2 className="form__title">Add a target</h2>
            <p className="form__sub">We'll start checking it right away.</p>

            <div className="field">
              <label htmlFor="f-name">
                Display name<span className="field__optional">optional</span>
              </label>
              <div className="input">
                <input
                  id="f-name"
                  placeholder="GitHub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="f-url">URL</label>
              <div className="input">
                <input
                  id="f-url"
                  placeholder="github.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  autoComplete="off"
                  inputMode="url"
                />
              </div>
              <span className="field__hint">We'll add https:// if you leave it out.</span>
            </div>

            <div className="field">
              <label htmlFor="f-int">Check every</label>
              <div className="input">
                <input
                  id="f-int"
                  type="number"
                  min={5}
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(Number(e.target.value))}
                />
                <span className="input__affix">seconds</span>
              </div>
              <span className="field__hint">Minimum 5 seconds.</span>
            </div>

            {formError && <div className="form__error">{formError}</div>}

            <button type="submit" className="pay-btn" disabled={isSubmitting || !url.trim()}>
              {isSubmitting ? 'Adding…' : 'Start monitoring'}
            </button>

            <p className="form__fine">You can ping or remove a target at any time.</p>
          </form>
        </aside>
      </div>
    </div>
  );
}
