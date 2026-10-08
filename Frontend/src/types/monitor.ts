export interface PingResult {
  id: number;
  statusCode: number;
  responseTimeMs: number;
  isSuccess: boolean;
  errMessage: string | null;
  checkedAt: string;
}

export interface Server {
  id: number;
  url: string;
  name: string;
  intervalSeconds: number;
  isActive: boolean;
  isUp: boolean;
  lastResponseTimeMs: number;
  isDefault?: boolean;
  lastCheckedAt?: string;
  pingLogs: PingResult[];
}

export interface ServerStatusUpdatedEvent {
  serverId: number;
  isUp: boolean;
  lastResponseTimeMs: number;
  ping: PingResult;
}

export interface CreateServerDto {
  name: string;
  url: string;
  intervalSeconds: number;
}