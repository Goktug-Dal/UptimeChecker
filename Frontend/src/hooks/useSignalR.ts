import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import type { ServerStatusUpdatedEvent } from '../types/monitor';
import { getSessionId } from '../services/api';

const HUB_URL = 'http://localhost:5119/hubs/server-status';

export const useSignalR = (onStatusUpdate: (event: ServerStatusUpdatedEvent) => void) => {
  const handlerRef = useRef(onStatusUpdate);
  handlerRef.current = onStatusUpdate;

  useEffect(() => {
    let isMounted = true;
    const sessionId = getSessionId();

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.None)
      .build();

    connection.on('ServerStatusUpdated', (data: ServerStatusUpdatedEvent) => {
      handlerRef.current(data);
    });

    // Re-join session group on automatic reconnection
    connection.onreconnected(async () => {
      if (sessionId && isMounted) {
        try {
          await connection.invoke('JoinSession', sessionId);
          console.log('[SignalR] Re-joined session group on reconnect:', sessionId);
        } catch (err) {
          console.error('[SignalR] Failed to re-join session group on reconnect:', err);
        }
      }
    });

    connection
      .start()
      .then(async () => {
        if (isMounted) {
          console.log('[SignalR] Connected to hub');
          // Join the user's private session group to receive updates for custom monitors
          if (sessionId) {
            try {
              await connection.invoke('JoinSession', sessionId);
              console.log('[SignalR] Joined session group:', sessionId);
            } catch (err) {
              console.error('[SignalR] Failed to join session group:', err);
            }
          }
        }
      })
      .catch((err) => {
        const isAbort =
          err.name === 'AbortError' ||
          err.message?.includes('stopped during negotiation');

        if (!isAbort && isMounted) {
          console.error('[SignalR] Connection error:', err);
        }
      });

    return () => {
      isMounted = false;
      if (connection.state === signalR.HubConnectionState.Connected) {
        if (sessionId) {
          connection.invoke('LeaveSession', sessionId).catch(() => {});
        }
        connection.stop();
      }
    };
  }, []);
};