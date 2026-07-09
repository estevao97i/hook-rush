/**
 * SnapshotBuffer — ring buffer POOLED de snapshots de um jogador remoto,
 * indexado pelo tempo do TICK do servidor (não pela chegada do pacote).
 * Zero alocação em regime: os slots são pré-criados e reutilizados.
 *
 * sample() devolve:
 *  - 'interp'  entre dois snapshots reais (caso normal — perfeito);
 *  - 'extrap'  além do último, dead reckoning por velocidade, limitado a
 *              MAX_EXTRAPOLATION_MS (pacote atrasou de leve);
 *  - 'hold'    segurando no limite (atraso grande — nunca chuta longe);
 *  - 'none'    sem dados.
 */
import { NETWORK_BUFFER_SIZE, MAX_EXTRAPOLATION_MS } from '@hookrush/shared';

export interface RemoteSnap {
  tMs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  flags: number;
  hookPhase: number;
  hookX: number;
  hookY: number;
  ropeLen: number;
  distance: number;
}

export type SampleResult = 'none' | 'hold' | 'interp' | 'extrap';

export function makeSnap(): RemoteSnap {
  return { tMs: 0, x: 0, y: 0, vx: 0, vy: 0, flags: 0, hookPhase: 0, hookX: 0, hookY: 0, ropeLen: 0, distance: 0 };
}

export function copySnap(src: RemoteSnap, dst: RemoteSnap): void {
  dst.tMs = src.tMs;
  dst.x = src.x;
  dst.y = src.y;
  dst.vx = src.vx;
  dst.vy = src.vy;
  dst.flags = src.flags;
  dst.hookPhase = src.hookPhase;
  dst.hookX = src.hookX;
  dst.hookY = src.hookY;
  dst.ropeLen = src.ropeLen;
  dst.distance = src.distance;
}

export class SnapshotBuffer {
  private ring: RemoteSnap[] = Array.from({ length: NETWORK_BUFFER_SIZE }, makeSnap);
  private head = 0; // índice do mais antigo
  private count = 0;

  private at(i: number): RemoteSnap {
    return this.ring[(this.head + i) % NETWORK_BUFFER_SIZE];
  }

  get latest(): RemoteSnap | null {
    return this.count > 0 ? this.at(this.count - 1) : null;
  }

  /** Registra um snapshot escrevendo num slot reutilizado. */
  push(
    tMs: number,
    src: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      flags: number;
      hookPhase: number;
      hookX: number;
      hookY: number;
      ropeLen: number;
      distance: number;
    },
  ): void {
    const last = this.latest;
    if (last && tMs <= last.tMs) return; // duplicado/fora de ordem: descarta
    let slot: RemoteSnap;
    if (this.count < NETWORK_BUFFER_SIZE) {
      slot = this.at(this.count);
      this.count++;
    } else {
      slot = this.ring[this.head];
      this.head = (this.head + 1) % NETWORK_BUFFER_SIZE;
    }
    slot.tMs = tMs;
    slot.x = src.x;
    slot.y = src.y;
    slot.vx = src.vx;
    slot.vy = src.vy;
    slot.flags = src.flags;
    slot.hookPhase = src.hookPhase;
    slot.hookX = src.hookX;
    slot.hookY = src.hookY;
    slot.ropeLen = src.ropeLen;
    slot.distance = src.distance;
  }

  /** Amostra a pose no tempo de render (escreve em `out`, sem alocar). */
  sample(renderMs: number, out: RemoteSnap): SampleResult {
    if (this.count === 0) return 'none';
    const first = this.at(0);
    if (renderMs <= first.tMs) {
      copySnap(first, out);
      return 'hold';
    }
    // caso normal: entre dois snapshots reais
    for (let i = 0; i < this.count - 1; i++) {
      const a = this.at(i);
      const b = this.at(i + 1);
      if (renderMs >= a.tMs && renderMs <= b.tMs) {
        const k = (renderMs - a.tMs) / Math.max(1, b.tMs - a.tMs);
        const disc = k < 0.5 ? a : b; // campos discretos: o mais próximo
        out.tMs = renderMs;
        out.x = a.x + (b.x - a.x) * k;
        out.y = a.y + (b.y - a.y) * k;
        out.vx = a.vx + (b.vx - a.vx) * k;
        out.vy = a.vy + (b.vy - a.vy) * k;
        out.hookX = a.hookX + (b.hookX - a.hookX) * k;
        out.hookY = a.hookY + (b.hookY - a.hookY) * k;
        out.ropeLen = a.ropeLen + (b.ropeLen - a.ropeLen) * k;
        out.flags = disc.flags;
        out.hookPhase = disc.hookPhase;
        out.distance = b.distance;
        return 'interp';
      }
    }
    // além do último: extrapolação curta por velocidade (dead reckoning)
    const last = this.latest!;
    const overMs = renderMs - last.tMs;
    const capped = Math.min(overMs, MAX_EXTRAPOLATION_MS) / 1000;
    copySnap(last, out);
    out.x += last.vx * capped;
    out.y += last.vy * capped;
    // corda NÃO extrapola: âncora é estática quando presa
    return overMs > MAX_EXTRAPOLATION_MS ? 'hold' : 'extrap';
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
