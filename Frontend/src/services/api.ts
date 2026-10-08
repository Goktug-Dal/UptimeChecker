import type { CreateServerDto, Server } from '../types/monitor';

const BASE_URL = 'http://localhost:5119';

// Generates or reads a persistent UUID for this specific browser tab session
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
  if (!res.ok) throw new Error('Failed to load servers');
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

export const triggerManualPing = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE_URL}/servers/${id}/ping`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger ping');
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const sid = sessionStorage.getItem('uptime_session_id');
    if (sid) {
      navigator.sendBeacon(`${BASE_URL}/sessions/${encodeURIComponent(sid)}/cleanup`);
    }
  });
}