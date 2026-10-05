import type { WebSocketService } from './websocket.service';

let realtime: WebSocketService | null = null;

export function setRealtimeService(service: WebSocketService): void {
  realtime = service;
}

export function getRealtimeService(): WebSocketService | null {
  return realtime;
}
