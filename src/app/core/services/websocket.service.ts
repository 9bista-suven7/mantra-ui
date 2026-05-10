import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, Observable, timer } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ChatEvent, TypingEvent, PresenceEvent, MessageDto, SendMessageRequest } from '../../models/chat.model';

const WS_URL = 'ws://localhost:9090/ws/chat';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECTS = 10;

/** Low-level WebSocket service. Connects once authenticated, auto-reconnects. */
@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {

  private readonly auth = inject(AuthService);

  private ws: WebSocket | null = null;
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  private readonly _events$ = new Subject<ChatEvent>();

  readonly connected$ = this._connected$.asObservable();

  /** All inbound chat events from the server. */
  readonly events$ = this._events$.asObservable();

  /** Filtered convenience streams */
  readonly newMessage$ = this.events$.pipe(
    filter(e => e.type === 'NEW_MESSAGE'),
    map(e => e.payload as MessageDto)
  );

  readonly typing$ = this.events$.pipe(
    filter(e => e.type === 'TYPING_START' || e.type === 'TYPING_STOP'),
    map(e => e.payload as TypingEvent)
  );

  readonly presence$ = this.events$.pipe(
    filter(e => e.type === 'PRESENCE_UPDATE'),
    map(e => e.payload as PresenceEvent)
  );

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const token = this.auth.getToken();
    if (!token) return;

    const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connected$.next(true);
      this.reconnectCount = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const ev: ChatEvent = JSON.parse(event.data);
        this._events$.next(ev);
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      this._connected$.next(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.reconnectCount = MAX_RECONNECTS; // prevent further reconnects
    this.ws?.close();
    this.ws = null;
    this._connected$.next(false);
  }

  send(action: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, payload }));
    }
  }

  sendChatMessage(req: SendMessageRequest): void {
    this.send('SEND_MESSAGE', req);
  }

  sendTypingStart(targetId: string): void {
    this.send('TYPING_START', { targetId });
  }

  sendTypingStop(targetId: string): void {
    this.send('TYPING_STOP', { targetId });
  }

  markRead(targetId: string, group = false): void {
    this.send('MARK_READ', { targetId, group: String(group) });
  }

  private scheduleReconnect(): void {
    if (this.reconnectCount >= MAX_RECONNECTS) return;
    this.reconnectCount++;
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
