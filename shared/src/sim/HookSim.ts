/**
 * HookSystem — corda como projétil físico + pêndulo de comprimento fixo.
 * Roda no servidor (autoridade) e no cliente (predição do jogador local).
 * O servidor decide: acertou, conectou, soltou, balançou.
 */
import * as G from '../config/gameConfig';
import { MapModel, MapAnchor } from '../map/MapModel';
import { HookCore, HookPhase, PlayerCore, bodyHeight } from './types';
import { SimEvent } from './events';

export function createHook(): HookCore {
  return {
    phase: HookPhase.Idle,
    hasTarget: false,
    ax: 0,
    ay: 0,
    tipX: 0,
    tipY: 0,
    dirX: 0,
    dirY: 0,
    traveled: 0,
    ropeLen: 0,
    time: 0,
  };
}

/** Melhor GrapplePoint atingível: acima e à frente, ~60° de elevação. */
export function findBestAnchor(px: number, py: number, map: MapModel): MapAnchor | null {
  let best: MapAnchor | null = null;
  let bestScore = -Infinity;
  for (const a of map.anchorsNear(px, G.HOOK_MAX_DISTANCE + 60)) {
    const dx = a.x - px;
    const dy = a.y - py;
    const d = Math.hypot(dx, dy);
    if (d > G.HOOK_MAX_DISTANCE || d < 40) continue;
    if (dy > -24) continue;
    if (dx < -80) continue;
    const ang = Math.atan2(-dy, Math.max(dx, 1));
    const score = -Math.abs(ang - 1.05) * 60 - Math.abs(d - 260) * 0.15 + (dx > 0 ? 30 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

/** Dispara a ponta. A conexão só acontece quando ela CHEGA no ponto. */
export function hookFire(p: PlayerCore, map: MapModel): boolean {
  const h = p.hook;
  if (h.phase !== HookPhase.Idle) return false;
  const cy = p.y - bodyHeight(p) / 2;
  const target = findBestAnchor(p.x, cy, map);
  if (target) {
    h.hasTarget = true;
    h.ax = target.x;
    h.ay = target.y;
    const d = Math.hypot(target.x - p.x, target.y - cy) || 1;
    h.dirX = (target.x - p.x) / d;
    h.dirY = (target.y - cy) / d;
  } else {
    h.hasTarget = false;
    const n = Math.hypot(0.62, 0.78);
    h.dirX = 0.62 / n; // sem alvo: estica à frente/acima e recolhe
    h.dirY = -0.78 / n;
  }
  h.tipX = p.x;
  h.tipY = cy;
  h.traveled = 0;
  h.time = 0;
  h.phase = HookPhase.Firing;
  return h.hasTarget;
}

/** Solta o vínculo (ou cancela o disparo) — a ponta recolhe fisicamente. */
export function hookDetach(h: HookCore): void {
  if (h.phase === HookPhase.Attached) {
    h.tipX = h.ax;
    h.tipY = h.ay;
  }
  h.hasTarget = false;
  if (h.phase !== HookPhase.Idle) h.phase = HookPhase.Retracting;
}

/** Avança a corda um sub-passo (após a integração do corpo). */
export function hookStep(p: PlayerCore, dt: number, ev: SimEvent[]): void {
  const h = p.hook;
  if (h.phase === HookPhase.Idle) return;
  h.time += dt;
  const bh = bodyHeight(p);
  const cx = p.x;
  const cy = p.y - bh / 2;

  if (h.phase === HookPhase.Firing) {
    const step = G.HOOK_SPEED * dt;
    h.traveled += step;
    if (h.hasTarget) {
      const dx = h.ax - h.tipX;
      const dy = h.ay - h.tipY;
      const rem = Math.hypot(dx, dy);
      if (rem <= step) {
        // conectou: vira vínculo físico de comprimento fixo
        h.tipX = h.ax;
        h.tipY = h.ay;
        h.ropeLen = clamp(Math.hypot(h.ax - cx, h.ay - cy), G.ROPE_MIN, G.ROPE_MAX);
        h.time = 0;
        h.phase = HookPhase.Attached;
        ev.push({ type: 'attach', playerId: p.id, x: h.ax, y: h.ay });
      } else {
        h.tipX += (dx / rem) * step;
        h.tipY += (dy / rem) * step;
        if (h.traveled > G.HOOK_MAX_DISTANCE * 1.25) {
          h.hasTarget = false;
          h.phase = HookPhase.Retracting;
        }
      }
    } else {
      h.tipX = cx + h.dirX * h.traveled;
      h.tipY = cy + h.dirY * h.traveled;
      if (h.traveled >= G.HOOK_MAX_DISTANCE) h.phase = HookPhase.Retracting;
    }
  } else if (h.phase === HookPhase.Retracting) {
    const dx = cx - h.tipX;
    const dy = cy - h.tipY;
    const d = Math.hypot(dx, dy);
    const step = G.HOOK_RETRACT_SPEED * dt;
    if (d <= step + 8) h.phase = HookPhase.Idle;
    else {
      h.tipX += (dx / d) * step;
      h.tipY += (dy / d) * step;
    }
  } else if (h.phase === HookPhase.Attached) {
    constrainPendulum(p);
    h.tipX = h.ax;
    h.tipY = h.ay;
  }
}

/**
 * Tensão da corda esticada: comprimento fixo, remove só a componente radial
 * (conserva momento tangencial/energia), amortecimento mínimo — sem tremor,
 * sem teleporte, sem explosão de velocidade.
 */
function constrainPendulum(p: PlayerCore): void {
  const h = p.hook;
  const bh = bodyHeight(p);
  const cx = p.x;
  const cy = p.y - bh / 2;
  const dx = cx - h.ax;
  const dy = cy - h.ay;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > h.ropeLen) {
    const nx = dx / dist;
    const ny = dy / dist;
    const vn = p.vx * nx + p.vy * ny;
    if (vn > 0) {
      p.vx -= vn * nx;
      p.vy -= vn * ny;
    }
    p.vx *= G.ROPE_DAMPING;
    p.vy *= G.ROPE_DAMPING;
    p.x = h.ax + nx * h.ropeLen;
    p.y = h.ay + ny * h.ropeLen + bh / 2;
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
