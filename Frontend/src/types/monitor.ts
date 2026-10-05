//basically models for react to use
export interface PingResult {
  id: number;
  statusCode: number;
  responseTimeMs: number;
  isSuccess: boolean;
  errMessage: string | null;
  checkedAt: string;
}

export interface ServerResult {
  id: number;
  url: string;
  name: string;
  intervalSeconds: number;
  isActive: boolean;
  isUp: boolean;
  lastResponseTimeMs: number;
  recentPings: PingResult[];
}

export interface ServerStatusUpdateEvent {
  serverId: number;
  isUp: boolean;
  lastResponseTimeMs: number;
  ping: PingResult;
}