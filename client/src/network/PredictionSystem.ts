/**
 * PredictionSystem — o jogador local NUNCA espera o servidor.
 * Roda a simulação compartilhada em passo fixo de 60 Hz sobre os inputs
 * locais (correr/pular/deslizar/gancho respondem no mesmo frame) e mantém:
 *  - INPUT BUFFER circular pooled: {seq, bits, timestamp} — nada se perde,
 *    nada aloca; a reconciliação reaplica só o que o servidor não viu;
 *  - pose ANTERIOR do passo de sim: o render (FPS livre) interpola entre
 *    o passo anterior e o atual (alpha) — zero stair-step de 60 Hz;
 *  - offset de erro suave (consumido por POSITION_SMOOTH_FACTOR) — as
 *    correções do servidor jamais teleportam.
 * A parede fica desligada aqui: autoridade exclusiva do servidor.
 */
import {
  World,
  PlayerCore,
  SimEvent,
  POSITION_SMOOTH_FACTOR,
} from '@hookrush/shared';

export interface InputRecord {
  seq: number;
  bits: number;
  t: number; // timestamp local do envio (ms)
}

/** Tamanho do histórico (~4 s a 60 Hz) — folga ampla sobre MAX_PREDICTION_TIME. */
const HISTORY = 256;

export class PredictionSystem {
  readonly world: World;
  readonly core: PlayerCore;
  seq = 0;
  /** offset visual do erro de reconciliação (decai suavemente) */
  errX = 0;
  errY = 0;

  /** histórico circular pooled: o registro do seq N vive no slot (N-1)%HISTORY */
  private readonly history: InputRecord[] = Array.from({ length: HISTORY }, () => ({
    seq: 0,
    bits: 0,
    t: 0,
  }));
  private readonly inputs = new Map<string, number>(); // reutilizado por passo

  // pose do passo anterior (interpolação de render entre passos fixos)
  private prevX: number;
  private prevY: number;
  private prevTipX = 0;
  private prevTipY = 0;

  constructor(seed: number, readonly id: string, colorIdx: number) {
    this.world = new World(seed, { wallEnabled: false });
    this.core = this.world.addPlayer(id, colorIdx);
    this.prevX = this.core.x;
    this.prevY = this.core.y;
  }

  /** Um tick local (60 Hz). Retorna os eventos da simulação (para FX). */
  step(bits: number, nowMs: number): SimEvent[] {
    this.seq++;
    const rec = this.history[(this.seq - 1) % HISTORY];
    rec.seq = this.seq;
    rec.bits = bits;
    rec.t = nowMs;

    this.prevX = this.core.x;
    this.prevY = this.core.y;
    this.prevTipX = this.core.hook.tipX;
    this.prevTipY = this.core.hook.tipY;

    this.inputs.set(this.id, bits);
    return this.world.step(this.inputs);
  }

  /** Registro do input `seq` (null se já saiu da janela do histórico). */
  record(seq: number): InputRecord | null {
    if (seq <= 0 || seq > this.seq || this.seq - seq >= HISTORY) return null;
    const rec = this.history[(seq - 1) % HISTORY];
    return rec.seq === seq ? rec : null;
  }

  /** Timestamp de envio do input `seq` (medição de input delay). */
  sentAt(seq: number): number {
    return this.record(seq)?.t ?? 0;
  }

  // ---- pose de render: lerp entre passos + offset de erro ----

  renderX(alpha: number): number {
    return this.prevX + (this.core.x - this.prevX) * alpha + this.errX;
  }

  renderY(alpha: number): number {
    return this.prevY + (this.core.y - this.prevY) * alpha + this.errY;
  }

  renderTipX(alpha: number): number {
    return this.prevTipX + (this.core.hook.tipX - this.prevTipX) * alpha + this.errX;
  }

  renderTipY(alpha: number): number {
    return this.prevTipY + (this.core.hook.tipY - this.prevTipY) * alpha + this.errY;
  }

  /** Acumula erro de reconciliação para consumo suave. */
  addError(dx: number, dy: number): void {
    this.errX += dx;
    this.errY += dy;
  }

  /** Decaimento exponencial do offset (correções pequenas = invisíveis). */
  decayError(dt: number): void {
    const k = Math.exp(-POSITION_SMOOTH_FACTOR * dt);
    this.errX *= k;
    this.errY *= k;
    if (Math.abs(this.errX) < 0.05) this.errX = 0;
    if (Math.abs(this.errY) < 0.05) this.errY = 0;
  }
}
