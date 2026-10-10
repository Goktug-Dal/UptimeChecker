import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Server, ServerStatusUpdatedEvent } from './types/monitor';
import { fetchServers, createServer, deleteServer, triggerManualPing, updateServer } from './services/api';
import { useSignalR } from './hooks/useSignalR';
import { ServerCard } from './components/ServerCard';
import {
  Plus,
  Info,
  Layers,
  X,
  Search,
  RefreshCw,
  Server as ServerIcon,
  Globe,
  ArrowLeft,
  ExternalLink,
  Mail,
} from 'lucide-react';

const UPTIME_LOGO = '/logo.png';

// Standalone brand SVG icons
const GithubIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export default function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [countdownSeconds, setCountdownSeconds] = useState(60);

  // Page Routing State ('monitors' | 'how' | 'about')
  const [currentPage, setCurrentPage] = useState<'monitors' | 'how' | 'about'>('monitors');

  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Add Target Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [intervalSec, setIntervalSec] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [isPingingAll, setIsPingingAll] = useState(false);

  const applyServerOrder = (rawList: Server[]): Server[] => {
    const list = rawList.map((s) => ({
      ...s,
      pingLogs: (s.pingLogs || []).slice(0, 15),
    }));
    try {
      const savedOrder = localStorage.getItem('uptime_checker_order');
      if (savedOrder) {
        const orderIds = JSON.parse(savedOrder);
        if (Array.isArray(orderIds)) {
          list.sort((a, b) => {
            const idxA = orderIds.indexOf(a.id);
            const idxB = orderIds.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        }
      }
    } catch {}
    return list;
  };

  // Initial loader with silent auto-retry every 4 seconds until Render boots up
  useEffect(() => {
    document.title = 'Uptime Checker';
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = UPTIME_LOGO;

    let isDone = false;

    const tryFetch = async () => {
      try {
        const data = await fetchServers();
        if (!isDone && Array.isArray(data)) {
          isDone = true;
          setServers(applyServerOrder(data));
          setIsLoading(false);
        }
      } catch {
        // Render server is still booting up (502/503/timeout), keep polling silently
      }
    };

    // Immediate first attempt
    tryFetch();

    // Auto-poll every 4s while waiting for Render container to start
    const pollInterval = setInterval(() => {
      if (!isDone) {
        tryFetch();
      }
    }, 4000);

    return () => {
      isDone = true;
      clearInterval(pollInterval);
    };
  }, []);

  // Continuous 60-second countdown timer that seamlessly loops if server needs another minute
  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          return 60; // Seamlessly reset to 60s for next attempt
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading]);



  const handleStatusUpdate = useCallback((event: ServerStatusUpdatedEvent) => {
    setServers((prevServers) =>
      prevServers.map((s) => {
        if (s.id !== event.serverId) return s;

        // Filter out any duplicate ping entry by id or identical timestamp before prepending
        const existing = (s.pingLogs || []).filter(
          (p) => (event.ping.id ? p.id !== event.ping.id : true) && p.checkedAt !== event.ping.checkedAt
        );
        const updatedPings = [event.ping, ...existing].slice(0, 15);

        return {
          ...s,
          isUp: event.isUp,
          lastResponseTimeMs: event.lastResponseTimeMs,
          lastCheckedAt: event.ping.checkedAt,
          pingLogs: updatedPings,
        };
      })
    );
  }, []);

  useSignalR(handleStatusUpdate);

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const newServer = await createServer({
        name: name.trim(),
        url: normalizedUrl,
        intervalSeconds: intervalSec,
      });
      setServers((prev) => {
        const updated = [...prev, { ...newServer, pingLogs: [] }];
        try {
          const ids = updated.map((s) => s.id);
          localStorage.setItem('uptime_checker_order', JSON.stringify(ids));
        } catch {}
        return updated;
      });
      setName('');
      setUrl('');
      setIntervalSec(15);
      setFormSuccess(`Now monitoring ${newServer.name || trimmed}`);
      setTimeout(() => setFormSuccess(null), 3500);
    } catch {
      setFormError("Could not add monitor. Ensure backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateInterval = async (id: number, newInterval: number) => {
    const target = servers.find((s) => s.id === id);
    if (!target) return;

    try {
      await updateServer(id, {
        name: target.name,
        url: target.url,
        intervalSeconds: newInterval,
        isActive: true,
      });

      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, intervalSeconds: newInterval } : s))
      );
    } catch (err: any) {
      alert(err.message || 'Error updating interval');
    }
  };

  const handleDelete = async (id: number) => {
    const target = servers.find((s) => s.id === id);
    const isCore = target && ((target as any).isDefault ?? (target as any).IsDefault);
    if (isCore) {
      alert(`"${target?.name || 'This service'}" is a core base monitor and cannot be removed.`);
      return;
    }

    if (!window.confirm(`Delete monitor "${target?.name || id}"?`)) return;

    try {
      await deleteServer(id);
      setServers((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        try {
          const ids = updated.map((s) => s.id);
          localStorage.setItem('uptime_checker_order', JSON.stringify(ids));
        } catch {}
        return updated;
      });
    } catch (err: any) {
      alert(err.message || 'Core system monitors cannot be deleted.');
    }
  };

  const handlePingAll = async () => {
    if (servers.length === 0 || isPingingAll) return;
    setIsPingingAll(true);
    try {
      await Promise.allSettled(servers.map((s) => triggerManualPing(s.id)));
    } finally {
      setIsPingingAll(false);
    }
  };

  const applyPreset = (presetName: string, presetUrl: string) => {
    setName(presetName);
    setUrl(presetUrl);
    if (currentPage !== 'monitors') {
      setCurrentPage('monitors');
    }
    setTimeout(() => {
      const el = document.getElementById('add-target-box');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${index}`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    setServers((prevServers) => {
      const updated = [...prevServers];
      const [movedItem] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, movedItem);

      try {
        const ids = updated.map((s) => s.id);
        localStorage.setItem('uptime_checker_order', JSON.stringify(ids));
      } catch {}

      return updated;
    });
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const totals = useMemo(() => {
    const up = servers.filter((s) => s.isUp).length;
    const down = servers.length - up;
    const avg = servers.length
      ? Math.round(servers.reduce((sum, s) => sum + (s.lastResponseTimeMs || 0), 0) / servers.length)
      : 0;
    return { up, down, avg, count: servers.length };
  }, [servers]);

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers;
    const q = searchQuery.toLowerCase();
    return servers.filter(
      (s) => (s.name || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q)
    );
  }, [servers, searchQuery]);

  return (
    <div className="app-shell">
      {/* ──────── Top Navbar with Page Navigation ──────── */}
      <header className="navbar">
        <div className="navbar__container">
          <div
            className="navbar__brand"
            onClick={() => setCurrentPage('monitors')}
            role="button"
            tabIndex={0}
          >
            <span className="navbar__logo">
              <img src={UPTIME_LOGO} alt="Uptime Checker Logo" className="navbar__logo-img" />
            </span>
            <span className="navbar__title">Uptime Checker</span>
          </div>

          <nav className="navbar__actions">
            <button
              type="button"
              className={`navbar__link ${currentPage === 'monitors' ? 'navbar__link--active' : ''}`}
              onClick={() => setCurrentPage('monitors')}
            >
              <ServerIcon size={15} />
              <span>Monitors</span>
            </button>
            <button
              type="button"
              className={`navbar__link ${currentPage === 'how' ? 'navbar__link--active' : ''}`}
              onClick={() => setCurrentPage('how')}
            >
              <Layers size={15} />
              <span>How it works</span>
            </button>
            <button
              type="button"
              className={`navbar__link ${currentPage === 'about' ? 'navbar__link--active' : ''}`}
              onClick={() => setCurrentPage('about')}
            >
              <Info size={15} />
              <span>About</span>
            </button>

            <button
              type="button"
              className="navbar__cta-btn"
              onClick={() => {
                if (currentPage !== 'monitors') setCurrentPage('monitors');
                setTimeout(() => {
                  const el = document.getElementById('add-target-box');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
              }}
            >
              <Plus size={15} />
              <span>Add Target</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ──────── Main Page Content ──────── */}
      <main className="content">
        {/* ================= PAGE: MONITORS (HOME) ================= */}
        {currentPage === 'monitors' && (
          <div className="page-monitors">
            {/* Centered Hero & Add Target Box */}
            <section className="hero-section">
              <div className="hero-header">
                <h1 className="hero-title">Is it Up?</h1>
              </div>

              {/* Add Target Box */}
              <div className="add-target-card" id="add-target-box">
                <form onSubmit={handleAddServer} className="add-target-form">
                  <div className="form-row">
                    <div className="input-group input-group--url">
                      <Globe size={15} className="input-icon" />
                      <input
                        type="text"
                        placeholder="URL or domain (e.g. cloudflare.com)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="input-group input-group--name">
                      <input
                        type="text"
                        placeholder="Target name (optional)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="input-group input-group--interval" title="Check frequency">
                      <span className="input-prefix">Every:</span>
                      <select
                        value={intervalSec}
                        onChange={(e) => setIntervalSec(Number(e.target.value))}
                        className="form-select"
                        aria-label="Probe interval"
                      >
                        <option value={10}>10s</option>
                        <option value={15}>15s</option>
                        <option value={30}>30s</option>
                        <option value={60}>60s</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !url.trim()}
                      className="submit-btn"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Adding…</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} />
                          <span>Add Target</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Quick Add Presets */}
                  <div className="presets-row">
                    <span className="presets-label">Quick add:</span>
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={() => applyPreset('IMDb', 'https://www.imdb.com')}
                    >
                      + IMDb
                    </button>
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={() => applyPreset('GitHub', 'https://github.com')}
                    >
                      + GitHub
                    </button>
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={() => applyPreset('Amazon', 'https://www.amazon.com')}
                    >
                      + Amazon
                    </button>
                  </div>

                  {/* Feedback Alerts */}
                  {formError && <div className="form-feedback form-feedback--error">{formError}</div>}
                  {formSuccess && <div className="form-feedback form-feedback--success">{formSuccess}</div>}
                </form>
              </div>

              {/* Boxed Stat Cards - clean containers, no bubbles/dots */}
              <div className="stats-cards-bar">
                <div className="stat-box">
                  <span className="stat-box__label">Operational:</span>
                  <span className="stat-box__val text-green">{totals.up}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-box__label">Distorted:</span>
                  <span className={`stat-box__val ${totals.down > 0 ? 'text-red' : ''}`}>
                    {totals.down}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-box__label">Avg Response:</span>
                  <span className="stat-box__val">{totals.avg} <small>ms</small></span>
                </div>
                <div className="stat-box">
                  <span className="stat-box__label">Total Monitors:</span>
                  <span className="stat-box__val">{totals.count}</span>
                </div>
              </div>
            </section>

            {/* ──────── Monitored Services with Drag Reorder ──────── */}
            <section className="monitors-section">
              <div className="monitors-bar">
                <div className="monitors-bar__title">
                  <h2>
                    Monitored Services{' '}
                    <span className="monitors-count">({filteredServers.length})</span>
                  </h2>
                  <span className="drag-hint">Drag cards to reorder</span>
                </div>

                <div className="monitors-bar__actions">
                  <div className="search-box">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Filter monitors…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery('')} className="search-clear">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="ping-all-btn"
                    onClick={handlePingAll}
                    disabled={isPingingAll || servers.length === 0}
                    title="Probe all endpoints now"
                  >
                    <RefreshCw size={13} className={isPingingAll ? 'spin' : ''} />
                    <span>{isPingingAll ? 'Pinging…' : 'Ping All'}</span>
                  </button>
                </div>
              </div>

              {/* Monitors Grid with Drag & Drop */}
              {isLoading ? (
                <div className="cold-start-banner" role="status" aria-live="polite">
                  <div className="cold-start-spinner">
                    <RefreshCw size={22} className="spin" />
                  </div>
                  <div className="cold-start-content">
                    <div className="cold-start-title">
                      Waking up backend service...
                      <span className="cold-start-timer">
                        (~{countdownSeconds}s remaining)
                      </span>
                    </div>
                    <p className="cold-start-desc">
                      Hosted on <strong>Render free tier</strong>. The server enters sleep mode when inactive and takes about 60 seconds to spin back up. Please wait while the container boots up.
                    </p>
                  </div>
                </div>
              ) : servers.length === 0 ? (
                <div className="empty-box">
                  <ServerIcon size={36} className="empty-icon" />
                  <h3>No monitors yet</h3>
                  <p>Enter a website or service above to start monitoring its uptime.</p>
                </div>
              ) : filteredServers.length === 0 ? (
                <div className="empty-box">
                  <p>No services match "{searchQuery}".</p>
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                <ul className="monitors-grid">
                  {filteredServers.map((s, idx) => (
                    <ServerCard
                      key={s.id}
                      server={s}
                      onDelete={handleDelete}
                      onPing={async (id) => { await triggerManualPing(id); }}
                      onUpdateInterval={handleUpdateInterval}
                      draggable={!searchQuery.trim()}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedIndex === idx}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* ================= PAGE: HOW IT WORKS ================= */}
        {currentPage === 'how' && (
          <div className="page-view animate-fade">
            <div className="page-view__header">
              <button
                type="button"
                className="page-back-btn"
                onClick={() => setCurrentPage('monitors')}
              >
                <ArrowLeft size={15} />
                <span>Back to Monitors</span>
              </button>
              <h1 className="page-view__title">How it works</h1>
            </div>

            {/* Simple 2-line top-to-bottom 4-item list */}
            <div className="how-vertical-list">
              <div className="how-list-item">
                <div className="how-list-item__num">1</div>
                <div className="how-list-item__text">
                  <h3>Background Services</h3>
                  <p>A background service sends periodic HTTP HEAD requests to each configured target URL to check availability.</p>
                </div>
              </div>

              <div className="how-list-item">
                <div className="how-list-item__num">2</div>
                <div className="how-list-item__text">
                  <h3>Response Logs</h3>
                  <p>Every API call records latency in milliseconds, HTTP status codes, and connection errors with timestamps.</p>
                </div>
              </div>

              <div className="how-list-item">
                <div className="how-list-item__num">3</div>
                <div className="how-list-item__text">
                  <h3>Instant Status Updates</h3>
                  <p>Results are pushed instantly to your browser as checks finish, without needing to refresh the page.</p>
                </div>
              </div>

              <div className="how-list-item">
                <div className="how-list-item__num">4</div>
                <div className="how-list-item__text">
                  <h3>Baseline &amp; Outage Detection</h3>
                  <p>Tracks average latency, flags high latency pings, and detects server failures.</p>
                </div>
              </div>
            </div>

            {/* GitHub Info Box for Later Use */}
            <div className="github-info-card">
              <div className="github-info-card__content">
                <GithubIcon size={18} />
                <div>
                  <h4>More info and repository on GitHub</h4>
                  <p>Documentation, setup instructions, and source code for UptimeChecker.</p>
                </div>
              </div>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="github-info-link"
              >
                <span>github.com/goktugdal/uptime-checker</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}

        {/* ================= PAGE: ABOUT ================= */}
        {currentPage === 'about' && (
          <div className="page-view animate-fade">
            <div className="page-view__header">
              <button
                type="button"
                className="page-back-btn"
                onClick={() => setCurrentPage('monitors')}
              >
                <ArrowLeft size={15} />
                <span>Back to Monitors</span>
              </button>
              <h1 className="page-view__title">About</h1>
              <p className="page-view__subtitle">
                Real-time website monitoring.
              </p>
            </div>

            {/* Architecture & Tech Stack: Categorized top-to-bottom */}
            <div className="about-stack-card">
              <h3 className="section-title">Architecture &amp; Tech Stack</h3>
              <div className="stack-vertical-list">
                <div className="stack-row">
                  <span className="stack-label">Frontend:</span>
                  <div className="stack-chips">
                    <span className="stack-chip">React</span>
                    <span className="stack-chip">TSX / TypeScript</span>
                  </div>
                </div>

                <div className="stack-row">
                  <span className="stack-label">Backend:</span>
                  <div className="stack-chips">
                    <span className="stack-chip">C#</span>
                    <span className="stack-chip">ASP.NET Core</span>
                  </div>
                </div>

                <div className="stack-row">
                  <span className="stack-label">Database:</span>
                  <div className="stack-chips">
                    <span className="stack-chip">PostgreSQL</span>
                  </div>
                </div>

                <div className="stack-row">
                  <span className="stack-label">Real-Time:</span>
                  <div className="stack-chips">
                    <span className="stack-chip">SignalR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Creator Section directly below (stacked, not side by side) */}
            <div className="about-creator-card">
              <h3 className="section-title">Made by Göktuğ Dal</h3>
              <div className="creator-links-row">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="creator-link-item"
                >
                  <GithubIcon size={16} />
                  <span>GitHub</span>
                  <ExternalLink size={12} className="link-sub" />
                </a>

                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  className="creator-link-item"
                >
                  <LinkedinIcon size={16} />
                  <span>LinkedIn</span>
                  <ExternalLink size={12} className="link-sub" />
                </a>

                <a
                  href="mailto:contact@goktugdal.dev"
                  className="creator-link-item"
                >
                  <Mail size={16} />
                  <span>Email</span>
                  <ExternalLink size={12} className="link-sub" />
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ──────── Simplified Bottom Plate (Made by Göktuğ Dal) ──────── */}
      <footer className="footer-plate">
        <div className="footer-plate__inner">
          <div className="footer-plate__left">
            <span className="footer-brand">Uptime Checker</span>
            <span className="footer-dot">•</span>
            <span className="footer-credit">
              Made by <strong>Göktuğ Dal</strong>
            </span>
          </div>

          <div className="footer-plate__links">
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => {
                setCurrentPage('monitors');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Monitors
            </button>
            <span className="footer-dot">•</span>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => {
                setCurrentPage('how');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              How It Works
            </button>
            <span className="footer-dot">•</span>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => {
                setCurrentPage('about');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              About
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}