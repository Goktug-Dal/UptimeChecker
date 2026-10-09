import type { CreateServerDto, Server, PingResult } from '../types/monitor';

const BASE_URL = 'http://localhost:5119';

export const getSessionId = (): string => {
  let sid = sessionStorage.getItem('uptime_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('uptime_session_id', sid);
  }
  return sid;
};

export const fetchServers = async (): Promise<Server[]> => {
  const sid = getSessionId();
  const res = await fetch(`${BASE_URL}/servers?sessionId=${encodeURIComponent(sid)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load servers');
  }
  return res.json();
};

export const fetchServerPings = async (id: number): Promise<PingResult[]> => {
  const sid = getSessionId();
  const res = await fetch(`${BASE_URL}/servers/${id}/pings?sessionId=${encodeURIComponent(sid)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch server pings');
  }
  return res.json();
};

export const createServer = async (dto: CreateServerDto): Promise<Server> => {
  const sid = getSessionId();
  const res = await fetch(`${BASE_URL}/servers?sessionId=${encodeURIComponent(sid)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create server');
  }
  return res.json();
};

export const updateServer = async (
  id: number,
  dto: { name: string; url: string; intervalSeconds: number; isActive: boolean }
): Promise<void> => {
  const sid = getSessionId();
  const res = await fetch(`${BASE_URL}/servers/${id}?sessionId=${encodeURIComponent(sid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update server');
  }
};

export const deleteServer = async (id: number): Promise<void> => {
  const sid = getSessionId();
  const res = await fetch(`${BASE_URL}/servers/${id}?sessionId=${encodeURIComponent(sid)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete server');
  }
};

export const triggerManualPing = async (id: number): Promise<PingResult> => {
  const sid = getSessionId();
  const res = await fetch(`${BASE_URL}/servers/${id}/ping?sessionId=${encodeURIComponent(sid)}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to trigger ping');
  }
  return res.json();
};

// Automatic cleanup beacon when user closes the browser tab
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const sid = sessionStorage.getItem('uptime_session_id');
    if (sid) {
      navigator.sendBeacon(`${BASE_URL}/sessions/${encodeURIComponent(sid)}/cleanup`);
    }
  });
}