import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import type { ServerStatusUpdatedEvent } from '../types/monitor';

const HUB_URL = 'http://localhost:5119/hubs/server-status';

export const useSignalR = (onStatusUpdate: (event: ServerStatusUpdatedEvent) => void) => {
  const handlerRef = useRef(onStatusUpdate);
  handlerRef.current = onStatusUpdate;

  useEffect(() => {
    let isMounted = true;

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

    connection
      .start()
      .then(() => {
        if (isMounted) {
          console.log('[SignalR] Connected to hub');
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
        connection.stop();
      }
    };
  }, []);
};