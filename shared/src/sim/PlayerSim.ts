/**
 * MovementSystem + PhysicsSystem + CollisionSystem do corredor.
 * Porta fiel da física original (momentum/atrito/slide/coyote/buffer/
 * gravidade assimétrica/tropeço/túnel), agora PURA e determinística:
 * passo fixo de 1/60s com sub-passos anti-túnel, AABB contra o MapModel.
 * Roda idêntica no servidor (autoridade) e no cliente (predição local).
 */
import * as G from '../config/gameConfig';
import { MapModel, SolidBlock } from '../map/MapModel';
import { PlayerCore, HookPhase, bodyHeight } from './types';
import { createHook, hookFire, hookDetach, hookStep } from './HookSim';
import { InputBits, hasBit } from './input';
import { SimEvent } from './events';

export function createPlayer(id: string, colorIdx: number): PlayerCore {
  return {
    id,
    colorIdx,
    x: G.START_X,
    y: G.GROUND_Y,
    vx: 0,
    vy: 0,
    alive: true,
    grounded: true,
    crouched: false,
    sliding: false,
    slideT: 0,
    slideDur: 0,
    coyote: 0,
    buffer: 0,
    jumping: false,
    cutDone: false,
    stunT: 0,
    hitCd: 0,
    forceCrouchT: 0,
    mult: 1,
    timeBonus: 0,
    distance: 0,
    startX: G.START_X,
    lastScoredEndX: -Infinity,
    hitPatterns: new Set(),
    prevJump: false,
    prevHook: false,
    lastBits: 0,
    lastInputSeq: 0,
    hook: createHook(),
  };
}

export function targetSpeed(p: PlayerCore): number {
  return (G.BASE_SPEED + p.timeBonus) * p.mult;
}

/** Um tick completo (1/60s) de um jogador. */
export function stepPlayer(p: PlayerCore, bits: number, map: MapModel, ev: SimEvent[]): void {
  if (!p.alive) return;
  const DT = G.SIM_DT;
  const jumpHeld = hasBit(bits, InputBits.Jump);
  const crouchHeld = hasBit(bits, InputBits.Slide);
  const hookHeld = hasBit(bits, InputBits.Hook);
  const jumpPressed = jumpHeld && !p.prevJump;
  const hookPressed = hookHeld && !p.prevHook;
  p.prevJump = jumpHeld;
  p.prevHook = hookHeld;
  p.lastBits = bits;

  p.stunT = Math.max(0, p.stunT - DT);
  p.hitCd = Math.max(0, p.hitCd - DT);
  p.forceCrouchT = Math.max(0, p.forceCrouchT - DT);

  // ---- coyote time / jump buffer ----
  p.coyote = p.grounded ? G.COYOTE_TIME : p.coyote - DT;
  p.buffer = jumpPressed ? G.JUMP_BUFFER : p.buffer - DT;

  // ---- gancho por HOLD: apertar dispara; soltar solta na hora ----
  if (hookPressed && p.hook.phase === HookPhase.Idle) {
    hookFire(p, map);
    ev.push({ type: 'throw', playerId: p.id, x: p.x, y: p.y });
  }
  if (!hookHeld) {
    if (p.hook.phase === HookPhase.Attached) releaseHook(p, ev);
    else if (p.hook.phase === HookPhase.Firing) hookDetach(p.hook);
  }

  // ---- pulo (responsivo, altura variável) ----
  if (p.buffer > 0 && p.coyote > 0 && p.hook.phase !== HookPhase.Attached) {
    p.vy = -G.JUMP_V;
    p.coyote = 0;
    p.buffer = 0;
    p.jumping = true;
    p.cutDone = false;
    // moveY só zera `grounded` quando dy>=0 (caindo/nivelado); um pulo sobe
    // (dy<0), então sem isto `grounded` fica preso em true até o ápice —
    // reabastecendo o coyote a cada tick e permitindo pulo infinito se o
    // jogador martelar o pulo antes de atingir o ápice.
    p.grounded = false;
    ev.push({ type: 'jump', playerId: p.id, x: p.x, y: p.y });
  }
  if (p.jumping && !p.cutDone && !jumpHeld && p.vy < -120) {
    p.vy *= G.JUMP_CUT;
    p.cutDone = true;
  }

  // ---- agachar/deslizar ----
  const wantCrouch = crouchHeld || p.forceCrouchT > 0;
  if (wantCrouch !== p.crouched) {
    if (wantCrouch) {
      p.crouched = true;
      maybeStartSlide(p);
    } else if (headroomFree(p, map)) {
      p.crouched = false;
      p.sliding = false;
    }
  }

  // ---- corrida automática com momentum (nunca corte seco) ----
  if (p.hook.phase !== HookPhase.Attached) {
    p.timeBonus += G.SPEED_INCREASE_PER_SECOND * DT;
    const target = targetSpeed(p) * (p.stunT > 0 ? G.STUN_ACCEL : 1);
    const vx = p.vx;
    if (p.grounded) {
      if (p.crouched) {
        if (p.sliding) {
          p.slideT += DT;
          if (p.slideT >= p.slideDur || vx <= target) p.sliding = false;
        }
        const fr = p.sliding ? G.SLIDE_FRICTION : G.GROUND_FRICTION;
        if (vx > target) p.vx = Math.max(target, vx - fr * DT);
        else if (vx < target) {
          p.vx = Math.min(target, vx + G.MOVE_ACCELERATION * G.CROUCH_ACCEL_MULT * DT);
        }
      } else if (vx < target) p.vx = Math.min(target, vx + G.MOVE_ACCELERATION * DT);
      else if (vx > target) p.vx = Math.max(target, vx - G.GROUND_FRICTION * DT);
    } else if (vx < target) p.vx = Math.min(target, vx + G.AIR_ACCELERATION * DT);
  }

  // ---- integração + colisões (sub-passos anti-túnel) ----
  const wasGrounded = p.grounded;
  const h = DT / G.SIM_SUBSTEPS;
  let landImpact = 0;
  for (let i = 0; i < G.SIM_SUBSTEPS; i++) {
    const attached = p.hook.phase === HookPhase.Attached;
    // gravidade assimétrica — desligada no pêndulo (conservação de energia)
    let g = G.GRAVITY;
    if (!attached) {
      if (p.vy < -40) g *= G.GRAVITY_RISE_MULT;
      else if (p.vy > 40) g *= G.GRAVITY_FALL_MULT;
    }
    p.vy = Math.min(p.vy + g * h, G.PHYS_MAX_SPEED_Y);
    p.vx = Math.min(p.vx, G.PHYS_MAX_SPEED_X);
    moveX(p, p.vx * h, map, ev);
    landImpact = Math.max(landImpact, moveY(p, p.vy * h, map));
    hookStep(p, h, ev);
  }
  if (p.grounded && !wasGrounded) {
    p.jumping = false;
    if (p.crouched) maybeStartSlide(p); // pousou agachado: preserva momentum
    ev.push({ type: 'land', playerId: p.id, x: p.x, y: p.y, v: landImpact });
  }
  // arrastou no chão preso à corda: solta (novo disparo exige nova borda)
  if (p.hook.phase === HookPhase.Attached && p.grounded && p.hook.time > 0.25) {
    releaseHook(p, ev);
  }

  // ---- eliminação por queda (o servidor é quem manda) ----
  if (p.y > G.KILL_Y) {
    p.alive = false;
    hookDetach(p.hook);
    ev.push({ type: 'fall', playerId: p.id, x: p.x, y: p.y });
    return;
  }
  p.distance = Math.max(p.distance, (p.x - p.startX) / G.PPM);
}

/** Solta a corda: um arco bem soltado (empurrando pra frente, sem subir mais)
 *  ganha um impulso extra de velocidade — recompensa o "arqueamento" bom. */
export function releaseHook(p: PlayerCore, ev: SimEvent[]): void {
  if (p.hook.phase !== HookPhase.Attached) return;
  const good = p.vy < 40 && p.vx > 60;
  if (good) p.vx *= G.SWING_RELEASE_BOOST;
  hookDetach(p.hook);
  p.jumping = true;
  p.cutDone = true;
  ev.push({ type: 'release', playerId: p.id, x: p.x, y: p.y, v: good ? 1 : 0 });
}

/** Slide: janela de atrito reduzido que escala com a velocidade de entrada. */
function maybeStartSlide(p: PlayerCore): void {
  const target = targetSpeed(p);
  if (p.grounded && p.vx > target * 1.02) {
    p.sliding = true;
    p.slideT = 0;
    p.slideDur = clamp(
      (p.vx / G.BASE_SPEED) * G.SLIDE_DUR_PER_SPEED,
      G.SLIDE_DURATION_MIN,
      G.SLIDE_DURATION_MAX,
    );
  }
}

/** Há espaço acima para levantar? (evita levantar dentro de um túnel) */
function headroomFree(p: PlayerCore, map: MapModel): boolean {
  const left = p.x - G.BODY_W / 2 - 2;
  const right = p.x + G.BODY_W / 2 + 2;
  const top = p.y - G.BODY_H;
  const bottom = p.y - G.CROUCH_H;
  for (const b of map.solidsNear(left, right)) {
    if (right > b.x && left < b.x + b.w && bottom > b.y && top < b.y + b.h) return false;
  }
  return true;
}

// ---------- CollisionSystem (AABB com semântica do jogo) ----------

function moveX(p: PlayerCore, dx: number, map: MapModel, ev: SimEvent[]): void {
  if (dx === 0) return;
  p.x += dx;
  const bh = bodyHeight(p);
  for (const b of map.solidsNear(p.x - 200, p.x + 200)) {
    const left = p.x - G.BODY_W / 2;
    const right = p.x + G.BODY_W / 2;
    const top = p.y - bh;
    if (right <= b.x || left >= b.x + b.w) continue;
    const vert = Math.min(p.y, b.y + b.h) - Math.max(top, b.y);
    if (vert <= 0.5) continue;
    // degrau raso / emenda de chão: sobe suave, sem penalidade
    const ledge = p.y - b.y;
    if (dx > 0 && ledge > 0 && ledge < G.STEP_UP_MAX && p.vy >= 0) {
      p.y = b.y;
      p.grounded = true;
      continue;
    }
    // parede real: resolve para fora e aplica a semântica de batida
    if (dx > 0) {
      p.x = b.x - G.BODY_W / 2 - 0.01;
      if (p.vx > 0) p.vx = 0; // a parede física freia (como antes)
      sideHit(p, b, map, ev);
    } else {
      p.x = b.x + b.w + G.BODY_W / 2 + 0.01;
      if (p.vx < 0) p.vx = 0;
    }
  }
}

/** Retorna o impacto do pouso (vy no toque) ou 0. */
function moveY(p: PlayerCore, dy: number, map: MapModel): number {
  const prevVy = p.vy;
  p.y += dy;
  const bh = bodyHeight(p);
  const wasGrounded = p.grounded;
  if (dy >= 0) p.grounded = false;
  let impact = 0;
  for (const b of map.solidsNear(p.x - G.BODY_W, p.x + G.BODY_W)) {
    const left = p.x - G.BODY_W / 2;
    const right = p.x + G.BODY_W / 2;
    const horiz = Math.min(right, b.x + b.w) - Math.max(left, b.x);
    if (horiz <= 0.5) continue;
    const top = p.y - bh;
    if (dy >= 0 && p.y > b.y && top < b.y) {
      // caindo sobre o topo (penetração rasa = veio de cima, não de lado)
      if (p.y - b.y <= Math.max(dy + 2, 6)) {
        p.y = b.y;
        p.vy = 0;
        p.grounded = true;
        if (!wasGrounded) impact = prevVy;
      }
    } else if (dy < 0 && top < b.y + b.h && p.y > b.y + b.h) {
      // subindo: bateu a cabeça
      p.y = b.y + b.h + bh;
      if (p.vy < 0) {
        p.vy = 60;
        applyHitPenalty(p, b, map, null);
      }
    }
  }
  return impact;
}

/** Batida frontal: penalidade + resolução de fluxo (tropeço / agachada). */
function sideHit(p: PlayerCore, b: SolidBlock, map: MapModel, ev: SimEvent[]): void {
  if (!applyHitPenalty(p, b, map, ev)) return;
  const center = p.y - bodyHeight(p) / 2;
  const gapBelow = G.GROUND_Y - (b.y + b.h);
  if (b.y + b.h < center - 4) {
    // teto baixo: se dá para passar agachado, força agachar e segue
    if (gapBelow >= G.CROUCH_H + 2) {
      p.forceCrouchT = 0.55;
      p.vx = Math.max(p.vx, G.BASE_SPEED * 0.5);
    } else p.vy = Math.max(p.vy, 60);
  } else {
    // parede: tropeça por cima — bater NUNCA mata, o fluxo continua
    p.vy = -G.JUMP_V * 0.8;
    p.vx = Math.max(p.vx, G.BASE_SPEED * 0.45);
  }
}

/** Penalidade comum de batida (com cooldown). Retorna false se em cooldown. */
function applyHitPenalty(
  p: PlayerCore,
  _b: SolidBlock,
  map: MapModel,
  ev: SimEvent[] | null,
): boolean {
  if (p.hitCd > 0) return false;
  p.hitCd = 0.6;
  p.stunT = G.STUN_TIME;
  p.mult = Math.max(1, p.mult * G.HIT_PENALTY);
  const pat = map.patternAt(p.x + 60);
  if (pat) p.hitPatterns.add(pat.id);
  if (p.hook.phase === HookPhase.Attached && ev) releaseHook(p, ev);
  else if (p.hook.phase !== HookPhase.Idle) hookDetach(p.hook);
  ev?.push({ type: 'hit', playerId: p.id, x: p.x, y: p.y - bodyHeight(p) / 2 });
  return true;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
