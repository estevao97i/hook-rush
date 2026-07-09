/**
 * Protocolo de rede (packets/events) — contratos entre cliente e servidor.
 * O snapshot em si viaja pelo state schema do Colyseus (delta-comprimido);
 * aqui ficam os tipos de mensagem e os enums de fase/flags.
 */

export enum ClientMsg {
  Input = 'i', // { s: seq, b: bits } — NUNCA posição/velocidade
  Start = 'start', // host inicia a corrida (no lobby)
  Ping = 'p', // { t } — medição de RTT
}

export enum ServerMsg {
  Pong = 'q', // { t } eco do ping
  GameOver = 'go', // GameOverMessage
}

export enum GamePhase {
  Lobby = 0,
  Countdown = 1,
  Racing = 2,
  Finished = 3,
}

export interface InputMessage {
  s: number; // sequência (reconciliação da predição)
  b: number; // InputBits
  t: number; // timestamp do cliente (ms) — medição/lag compensation futura
}

export interface PingMessage {
  t: number;
}

export interface GameOverMessage {
  winnerId: string;
  winnerName: string;
  distances: Array<{ id: string; name: string; distance: number }>;
}

/** Flags compactas do jogador no snapshot (uint8). */
export enum PlayerFlags {
  Alive = 1,
  Grounded = 2,
  Crouched = 4,
  Sliding = 8,
  Stunned = 16,
}

export interface FlagSource {
  alive: boolean;
  grounded: boolean;
  crouched: boolean;
  sliding: boolean;
  stunT: number;
}

export function encodeFlags(p: FlagSource): number {
  return (
    (p.alive ? PlayerFlags.Alive : 0) |
    (p.grounded ? PlayerFlags.Grounded : 0) |
    (p.crouched ? PlayerFlags.Crouched : 0) |
    (p.sliding ? PlayerFlags.Sliding : 0) |
    (p.stunT > 0 ? PlayerFlags.Stunned : 0)
  );
}

export function decodeFlags(f: number): FlagSource {
  return {
    alive: (f & PlayerFlags.Alive) !== 0,
    grounded: (f & PlayerFlags.Grounded) !== 0,
    crouched: (f & PlayerFlags.Crouched) !== 0,
    sliding: (f & PlayerFlags.Sliding) !== 0,
    stunT: (f & PlayerFlags.Stunned) !== 0 ? 0.2 : 0,
  };
}
