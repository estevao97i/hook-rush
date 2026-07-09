/**
 * InterpolationSystem — pose suave dos jogadores REMOTOS.
 * Consome os SnapshotBuffers no tempo de render (relógio de tick − atraso
 * de interpolação) e aplica uma camada final de smooth damping que elimina
 * qualquer pop residual (transição extrapolação→interpolação, spawn,
 * mudanças bruscas de direção). Nunca `pos = snapshot.pos` direto.
 * Saídas pooled — zero alocação por frame.
 */
import { POSITION_SMOOTH_FACTOR, ROTATION_SMOOTH_FACTOR } from '@hookrush/shared';
import { SnapshotBuffer, RemoteSnap, makeSnap, copySnap, SampleResult } from './SnapshotBuffer';

interface Entry {
  buffer: SnapshotBuffer;
  sampled: RemoteSnap; // amostra crua do buffer (reutilizada)
  smooth: RemoteSnap; // pose suavizada exibida (reutilizada)
  primed: boolean;
  lastResult: SampleResult;
}

export class InterpolationSystem {
  private entries = new Map<string, Entry>();
  /** estatística do frame (debug): quantos remotos extrapolando */
  extrapolating = 0;

  private ensure(id: string): Entry {
    let e = this.entries.get(id);
    if (!e) {
      e = { buffer: new SnapshotBuffer(), sampled: makeSnap(), smooth: makeSnap(), primed: false, lastResult: 'none' };
      this.entries.set(id, e);
    }
    return e;
  }

  push(
    id: string,
    tMs: number,
    src: Parameters<SnapshotBuffer['push']>[1],
  ): void {
    this.ensure(id).buffer.push(tMs, src);
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  /** Pose suave do jogador `id` no tempo de render (objeto pooled). */
  sample(id: string, renderMs: number, dt: number): RemoteSnap | null {
    const e = this.entries.get(id);
    if (!e) return null;
    const res = e.buffer.sample(renderMs, e.sampled);
    e.lastResult = res;
    if (res === 'none') return null;
    if (res === 'extrap') this.extrapolating++;

    const s = e.smooth;
    if (!e.primed) {
      copySnap(e.sampled, s);
      e.primed = true;
      return s;
    }
    // smooth damping: correções pequenas ficam invisíveis, grandes nunca teleportam
    const kPos = 1 - Math.exp(-POSITION_SMOOTH_FACTOR * dt);
    const kRope = 1 - Math.exp(-ROTATION_SMOOTH_FACTOR * dt);
    s.x += (e.sampled.x - s.x) * kPos;
    s.y += (e.sampled.y - s.y) * kPos;
    s.vx += (e.sampled.vx - s.vx) * kPos;
    s.vy += (e.sampled.vy - s.vy) * kPos;
    s.hookX += (e.sampled.hookX - s.hookX) * kRope;
    s.hookY += (e.sampled.hookY - s.hookY) * kRope;
    s.ropeLen += (e.sampled.ropeLen - s.ropeLen) * kRope;
    s.flags = e.sampled.flags;
    s.hookPhase = e.sampled.hookPhase;
    s.distance = e.sampled.distance;
    s.tMs = renderMs;
    return s;
  }

  /** Chamar no início de cada frame de render (zera estatística). */
  beginFrame(): void {
    this.extrapolating = 0;
  }
}
