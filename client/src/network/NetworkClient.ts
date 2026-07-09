/**
 * NetworkSystem (cliente) — conexão Colyseus, salas e medição de ping.
 * O cliente NUNCA envia posição/velocidade/física: apenas InputBits.
 */
import { Client, Room } from 'colyseus.js';
import { ROOM_NAME, ClientMsg, ServerMsg, InputMessage } from '@hookrush/shared';
import { getServerUrl } from './serverUrl';

export class NetworkClient {
  readonly url: string;
  private client: Client;
  room: Room | null = null;
  /** RTT medido (ms) — alimenta o LatencyManager. */
  rtt = 0;
  private pingTimer: number | null = null;
  /** DEV: latência artificial de saída (?fakelag=120&fakejitter=40) para
   *  testar predição/reconciliação sem sair do localhost. */
  private readonly fakeLagMs: number;
  private readonly fakeJitterMs: number;

  constructor(url = getServerUrl()) {
    this.url = url;
    this.client = new Client(url);
    const q = new URLSearchParams(window.location.search);
    this.fakeLagMs = Number(q.get('fakelag') ?? 0) || 0;
    this.fakeJitterMs = Number(q.get('fakejitter') ?? 0) || 0;
  }

  get connected(): boolean {
    return this.room !== null;
  }

  get sessionId(): string {
    return this.room?.sessionId ?? '';
  }

  async quickPlay(name: string): Promise<Room> {
    return this.attach(await this.client.joinOrCreate(ROOM_NAME, { privateRoom: false, name }));
  }

  async createPrivate(name: string): Promise<Room> {
    return this.attach(await this.client.create(ROOM_NAME, { privateRoom: true, name }));
  }

  async joinByCode(code: string, name: string): Promise<Room> {
    return this.attach(await this.client.joinById(code.trim().toUpperCase(), { name }));
  }

  private attach(room: Room): Room {
    this.room = room;
    room.onMessage(ServerMsg.Pong, (m: { t: number }) => {
      this.rtt = Math.round(performance.now() - m.t);
    });
    room.onLeave(() => {
      this.room = null;
      if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    });
    this.pingTimer = window.setInterval(() => {
      this.room?.send(ClientMsg.Ping, { t: performance.now() });
    }, 2000);
    return room;
  }

  /** Envia um pacote de input (objeto pooled do PacketSerializer). */
  sendInput(msg: InputMessage): void {
    if (this.fakeLagMs > 0) {
      // com atraso artificial o pooled precisa ser clonado (dev only)
      const copy: InputMessage = { s: msg.s, b: msg.b, t: msg.t };
      const delay = this.fakeLagMs + Math.random() * this.fakeJitterMs;
      window.setTimeout(() => this.room?.send(ClientMsg.Input, copy), delay);
      return;
    }
    this.room?.send(ClientMsg.Input, msg);
  }

  sendStart(): void {
    this.room?.send(ClientMsg.Start);
  }

  leave(): void {
    this.room?.leave();
    this.room = null;
  }
}
