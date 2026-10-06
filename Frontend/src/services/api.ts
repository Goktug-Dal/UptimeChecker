import type { CreateServerDto, Server } from '../types/monitor';

const BASE_URL = 'http://localhost:5119';

export const fetchServers = async (): Promise<Server[]> => {
  const res = await fetch(`${BASE_URL}/servers`);
  if (!res.ok) throw new Error('Failed to load servers');
  return res.json();
};

export const createServer = async (dto: CreateServerDto): Promise<Server> => {
  const res = await fetch(`${BASE_URL}/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error('Failed to create server');
  return res.json();
};

export const deleteServer = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE_URL}/servers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete server');
};

export const triggerManualPing = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE_URL}/servers/${id}/ping`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger ping');
};