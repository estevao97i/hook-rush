/**
 * Tipos centrais da simulação (PlayerSystem/HookSystem) — dados puros,
 * serializáveis, sem engine. Cliente (predição) e servidor (autoridade)
 * usam exatamente as mesmas estruturas.
 */

export enum HookPhase {
  Idle = 0,
  Firing = 1,
  Attached = 2,
  Retracting = 3,
}

export interface HookCore {
  phase: HookPhase;
  /** GrapplePoint alvo/preso (válido quando hasTarget). */
  hasTarget: boolean;
  ax: number;
  ay: number;
  /** Ponta da corda no mundo (render + colisão com o alvo). */
  tipX: number;
  tipY: number;
  dirX: number;
  dirY: number;
  traveled: number;
  ropeLen: number;
  time: number;
}

export interface PlayerCore {
  id: string;
  colorIdx: number;
  /** x = centro; y = pés (bottom). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  grounded: boolean;
  crouched: boolean;
  sliding: boolean;
  slideT: number;
  slideDur: number;
  coyote: number;
  buffer: number;
  jumping: boolean;
  cutDone: boolean;
  stunT: number;
  hitCd: number;
  forceCrouchT: number;
  mult: number;
  timeBonus: number;
  distance: number;
  startX: number;
  lastScoredEndX: number;
  hitPatterns: Set<number>;
  prevJump: boolean;
  prevHook: boolean;
  lastBits: number;
  lastInputSeq: number;
  hook: HookCore;
}

export function bodyHeight(p: PlayerCore): number {
  return p.crouched ? 28 : 46; // ver BODY_H/CROUCH_H em gameConfig
}
