import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import type { ServerStatusUpdateEvent } from '../types/monitor';

const HUB_URL = 'http://localhost:5000/hubs/server-status'; // CHANGE ON PRODUCTION WITH REAL DB LINK

export const useSignalR = (onStatusUpdate: (update: ServerStatusUpdateEvent) => void) => {
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connection.on('ServerStatusUpdated', (data: ServerStatusUpdateEvent) => {
      onStatusUpdate(data);
    });

    connection
      .start()
      .then(() => console.log('Connected to SignalR Hub'))
      .catch((err) => console.error('SignalR Connection Error: ', err));

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, [onStatusUpdate]);

  return connectionRef.current;
};