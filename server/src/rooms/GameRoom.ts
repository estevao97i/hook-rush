/**
 * RoomSystem — sala autoritativa de até MAX_PLAYERS jogadores.
 *
 * O servidor decide TUDO (posição, física, colisões, corda, parede,
 * mortes, vencedor); os clientes só mandam InputBits com nº de sequência.
 *
 * Fluxo: Lobby → (host aperta começar) → Countdown → Racing → Finished →
 * Lobby (rematch na mesma sala).
 *
 * Código de sala: roomId customizado de 5 caracteres (ex.: A8JKP) —
 * amigos entram por joinById; Quick Play usa joinOrCreate filtrado por
 * { private: false }.
 */
import { Room, Client } from 'colyseus';
import {
  World,
  SimEvent,
  GamePhase,
  ClientMsg,
  ServerMsg,
  InputMessage,
  PingMessage,
  GameOverMessage,
  MAX_PLAYERS,
  TICK_RATE,
  SNAPSHOT_RATE,
  COUNTDOWN_SECONDS,
  RESULTS_SECONDS,
  RECONNECT_SECONDS,
  ROOM_CODE_CHARS,
  ROOM_CODE_LENGTH,
  COLORS,
  encodeFlags,
} from '@hookrush/shared';
import { RoomState, NetPlayer } from './state.js';
import { syncWorld, syncPlayer } from '../systems/snapshot.js';
import { log } from '../util/logger.js';

const CODE_CHANNEL = 'hookrush:codes';

interface PendingInput {
  bits: number;
  seq: number;
}

export class GameRoom extends Room<RoomState> {
  maxClients = MAX_PLAYERS;

  private world: World | null = null;
  private inputs = new Map<string, PendingInput>();
  private resultsT = 0;
  /** Map de bits reutilizado a cada tick (evita alocação/GC a 60 Hz). */
  private readonly tickBits = new Map<string, number>();

  // ---------- ciclo de vida ----------

  async onCreate(options: { privateRoom?: boolean }): Promise<void> {
    this.roomId = await this.generateRoomId();
    if (options?.privateRoom) this.setPrivate(true);
    this.setState(new RoomState());
    this.state.phase = GamePhase.Lobby;
    this.setPatchRate(1000 / SNAPSHOT_RATE); // snapshots leves a 20/s
    this.setSimulationInterval((dt) => this.tick(dt), 1000 / TICK_RATE); // 60 ticks/s

    this.onMessage(ClientMsg.Input, (client, m: InputMessage) => {
      // único dado aceito do cliente: bits de input + sequência
      this.inputs.set(client.sessionId, { bits: m.b | 0, seq: m.s | 0 });
    });
    this.onMessage(ClientMsg.Start, (client) => {
      if (client.sessionId === this.state.hostId && this.state.phase === GamePhase.Lobby) {
        this.beginCountdown();
      }
    });
    this.onMessage(ClientMsg.Ping, (client, m: PingMessage) => {
      client.send(ServerMsg.Pong, { t: m.t });
    });

    log(`Sala criada: ${this.roomId}${options?.privateRoom ? ' (privada)' : ' (pública)'}`);
  }

  onJoin(client: Client, options: { name?: string }): void {
    if (this.state.phase !== GamePhase.Lobby) {
      throw new Error('Partida em andamento — aguarde o lobby.');
    }
    const p = new NetPlayer();
    p.name = (options?.name ?? '').trim().slice(0, 12) || `P${this.state.players.size + 1}`;
    p.colorIdx = this.nextColor();
    p.flags = encodeFlags({ alive: true, grounded: true, crouched: false, sliding: false, stunT: 0 });
    this.state.players.set(client.sessionId, p);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    log(`Player conectado: ${p.name} (${client.sessionId}) em ${this.roomId}`);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.players.get(client.sessionId);
    const name = p?.name ?? client.sessionId;
    // janela de reconexão durante a corrida (queda de rede ≠ desistência)
    if (!consented && this.state.phase === GamePhase.Racing) {
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        log(`Reconexão: ${name} em ${this.roomId}`);
        return;
      } catch {
        /* não voltou a tempo */
      }
    }
    this.state.players.delete(client.sessionId);
    this.world?.removePlayer(client.sessionId);
    this.inputs.delete(client.sessionId);
    if (this.state.hostId === client.sessionId) {
      this.state.hostId = this.state.players.size > 0 ? [...this.state.players.keys()][0] : '';
    }
    log(`Player desconectado: ${name} de ${this.roomId}`);
  }

  onDispose(): void {
    this.presence.srem(CODE_CHANNEL, this.roomId);
    log(`Sala destruída: ${this.roomId}`);
  }

  // ---------- fases da partida ----------

  private beginCountdown(): void {
    // nova seed a cada corrida: mapa idêntico para todos, imprevisível
    this.state.seed = (Math.random() * 0x7fffffff) | 0;
    this.world = new World(this.state.seed, { wallEnabled: true });
    this.state.players.forEach((net, id) => {
      const core = this.world!.addPlayer(id, net.colorIdx);
      syncPlayer(net, core);
    });
    this.state.wallX = this.world.wall.x;
    this.state.tick = 0;
    this.state.winnerId = '';
    this.state.countdown = COUNTDOWN_SECONDS;
    this.state.phase = GamePhase.Countdown;
    this.lock(); // ninguém entra no meio da corrida
  }

  private finishRace(): void {
    const world = this.world!;
    const alive = world.alivePlayers;
    let winnerId = alive[0]?.id ?? '';
    if (!winnerId) {
      let best = -1;
      for (const p of world.players.values()) {
        if (p.distance > best) {
          best = p.distance;
          winnerId = p.id;
        }
      }
    }
    this.state.winnerId = winnerId;
    this.state.phase = GamePhase.Finished;
    this.resultsT = RESULTS_SECONDS;

    const msg: GameOverMessage = {
      winnerId,
      winnerName: this.state.players.get(winnerId)?.name ?? '?',
      distances: [...world.players.values()]
        .map((p) => ({
          id: p.id,
          name: this.state.players.get(p.id)?.name ?? '?',
          distance: Math.floor(p.distance),
        }))
        .sort((a, b) => b.distance - a.distance),
    };
    this.broadcast(ServerMsg.GameOver, msg);
    log(`Game Over em ${this.roomId} — Vitória: ${msg.winnerName} (${Math.floor(
      world.players.get(winnerId)?.distance ?? 0,
    )} m)`);
  }

  private backToLobby(): void {
    this.world = null;
    this.inputs.clear();
    this.state.phase = GamePhase.Lobby;
    this.state.winnerId = '';
    this.unlock();
  }

  // ---------- simulação (60 ticks/s) ----------

  private tick(dtMs: number): void {
    const dt = dtMs / 1000;
    switch (this.state.phase) {
      case GamePhase.Countdown: {
        this.state.countdown = Math.max(0, this.state.countdown - dt);
        if (this.state.countdown <= 0) this.state.phase = GamePhase.Racing;
        break;
      }
      case GamePhase.Racing: {
        const world = this.world;
        if (!world) return;
        // inputs → física → corda → parede → obstáculos → pontuação
        const bits = this.tickBits;
        bits.clear();
        for (const [id, inp] of this.inputs) bits.set(id, inp.bits);
        const events = world.step(bits);
        // ack de reconciliação: o último seq APLICADO neste tick
        for (const [id, inp] of this.inputs) {
          const core = world.players.get(id);
          if (core) core.lastInputSeq = inp.seq;
        }
        this.handleEvents(events);
        syncWorld(this.state, world); // → snapshot (patch a 20/s)
        const startedWithMany = world.players.size >= 2;
        const alive = world.alivePlayers.length;
        if ((startedWithMany && alive <= 1) || alive === 0) this.finishRace();
        break;
      }
      case GamePhase.Finished: {
        this.resultsT -= dt;
        if (this.resultsT <= 0) this.backToLobby();
        break;
      }
    }
  }

  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'fall' || e.type === 'wallkill') {
        const name = this.state.players.get(e.playerId)?.name ?? e.playerId;
        log(
          `Game Over de ${name} em ${this.roomId} (${
            e.type === 'wallkill' ? 'parede da morte' : 'queda'
          }, ${Math.floor((this.world?.players.get(e.playerId)?.distance ?? 0))} m)`,
        );
      }
    }
  }

  // ---------- util ----------

  private nextColor(): number {
    const used = new Set<number>();
    this.state.players.forEach((p) => used.add(p.colorIdx));
    for (let i = 0; i < COLORS.length; i++) if (!used.has(i)) return i;
    return 0;
  }

  /** Código de sala único e legível (ex.: A8JKP) — receita oficial Colyseus. */
  private async generateRoomId(): Promise<string> {
    const existing = await this.presence.smembers(CODE_CHANNEL);
    let code = '';
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_CHARS[(Math.random() * ROOM_CODE_CHARS.length) | 0],
      ).join('');
    } while (existing.includes(code));
    await this.presence.sadd(CODE_CHANNEL, code);
    return code;
  }
}
