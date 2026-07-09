/**
 * Interpolação de render entre passos fixos da simulação (60 Hz) e o
 * frame rate livre (60/120/144 FPS) — elimina o "stair-step"/judder do
 * modo offline. Poses anteriores e saída são pooled (zero alocação).
 */
import { PlayerCore } from '@hookrush/shared';

export interface Pose {
  x: number;
  y: number;
  tipX: number;
  tipY: number;
}

export class PoseLerper {
  private prev = new Map<string, Pose>();
  private out: Pose = { x: 0, y: 0, tipX: 0, tipY: 0 };

  /** Chamar ANTES de cada world.step: captura a pose do passo anterior. */
  capture(players: Map<string, PlayerCore>): void {
    for (const p of players.values()) {
      let pose = this.prev.get(p.id);
      if (!pose) {
        pose = { x: p.x, y: p.y, tipX: p.hook.tipX, tipY: p.hook.tipY };
        this.prev.set(p.id, pose);
      }
      pose.x = p.x;
      pose.y = p.y;
      pose.tipX = p.hook.tipX;
      pose.tipY = p.hook.tipY;
    }
  }

  /** Pose interpolada (objeto pooled — consumir antes da próxima chamada). */
  sample(p: PlayerCore, alpha: number): Pose {
    const pr = this.prev.get(p.id);
    const o = this.out;
    if (!pr) {
      o.x = p.x;
      o.y = p.y;
      o.tipX = p.hook.tipX;
      o.tipY = p.hook.tipY;
      return o;
    }
    o.x = pr.x + (p.x - pr.x) * alpha;
    o.y = pr.y + (p.y - pr.y) * alpha;
    o.tipX = pr.tipX + (p.hook.tipX - pr.tipX) * alpha;
    o.tipY = pr.tipY + (p.hook.tipY - pr.tipY) * alpha;
    return o;
  }
}
