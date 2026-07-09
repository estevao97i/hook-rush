/**
 * ReconciliationSystem — server reconciliation clássica:
 * 1. aplica o estado autoritativo do snapshot no núcleo local;
 * 2. restaura as bordas de input (prevJump/prevHook) do último input que o
 *    servidor confirmou — replay com edges idênticos aos do servidor;
 * 3. reaplica (rollback+replay) APENAS os inputs com seq > ack;
 * 4. a diferença entre a pose antiga e a corrigida vira offset visual que
 *    decai suavemente — nunca `position = snapshot.position`, nunca
 *    teleporte. Métricas ficam no RollbackManager.
 */
import {
  SimEvent,
  stepPlayer,
  decodeFlags,
  HookPhase,
  InputBits,
  GEN_AHEAD,
  SIM_DT,
  MAX_PREDICTION_TIME_MS,
} from '@hookrush/shared';
import { PredictionSystem } from './PredictionSystem';
import { RollbackManager } from './RollbackManager';

/** Campos do NetPlayer usados na reconciliação. */
export interface ServerPlayerSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flags: number;
  hookPhase: number;
  hookX: number;
  hookY: number;
  ropeLen: number;
  mult: number;
  timeBonus: number;
  distance: number;
  lastSeq: number;
}

/** Limite de inputs reaplicáveis por reconciliação (janela de predição). */
const MAX_REPLAY = Math.ceil(MAX_PREDICTION_TIME_MS / (SIM_DT * 1000));

/** Eventos do replay são descartados (FX já tocaram na predição). */
const replayEvents: SimEvent[] = [];

export class ReconciliationSystem {
  constructor(
    private pred: PredictionSystem,
    readonly rollback: RollbackManager,
  ) {}

  apply(s: ServerPlayerSnapshot): void {
    const c = this.pred.core;
    const preX = c.x;
    const preY = c.y;

    // 1. estado autoritativo
    c.x = s.x;
    c.y = s.y;
    c.vx = s.vx;
    c.vy = s.vy;
    const f = decodeFlags(s.flags);
    c.alive = f.alive;
    c.grounded = f.grounded;
    c.crouched = f.crouched;
    c.sliding = f.sliding;
    c.mult = s.mult;
    c.timeBonus = s.timeBonus;
    c.distance = Math.max(c.distance, s.distance);
    c.hook.phase = s.hookPhase as HookPhase;
    c.hook.tipX = s.hookX;
    c.hook.tipY = s.hookY;
    c.hook.ropeLen = s.ropeLen;
    if (c.hook.phase === HookPhase.Attached || c.hook.phase === HookPhase.Firing) {
      c.hook.hasTarget = true;
      c.hook.ax = s.hookX;
      c.hook.ay = s.hookY;
    }

    // 2. bordas coerentes com o último input confirmado pelo servidor
    const acked = this.pred.record(s.lastSeq);
    if (acked) {
      c.prevJump = (acked.bits & InputBits.Jump) !== 0;
      c.prevHook = (acked.bits & InputBits.Hook) !== 0;
    }

    // 3. rollback + replay dos inputs pendentes (nunca perde input)
    const pending = this.pred.seq - s.lastSeq;
    if (c.alive && pending > 0) {
      if (pending <= MAX_REPLAY) {
        const map = this.pred.world.map;
        map.ensure(c.x + GEN_AHEAD);
        for (let seq = s.lastSeq + 1; seq <= this.pred.seq; seq++) {
          const rec = this.pred.record(seq);
          if (!rec) break; // janela estourou no meio: aceita até onde deu
          replayEvents.length = 0;
          stepPlayer(c, rec.bits, map, replayEvents);
        }
      } else {
        this.rollback.snaps++; // atraso extremo: aceita o servidor direto
      }
    }

    // 4. diferença → offset visual suave (o render consome aos poucos)
    const dx = preX - c.x;
    const dy = preY - c.y;
    this.rollback.note(Math.hypot(dx, dy));
    this.pred.addError(dx, dy);
  }
}
