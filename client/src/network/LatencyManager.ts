/**
 * LatencyManager — métricas de rede para o overlay de debug:
 * ping (EMA), jitter (variação do ping), "perda" (snapshots atrasados/
 * coalescidos — WebSocket é TCP, não há perda real), taxa de snapshots
 * medida e atraso input→ack (tempo até o servidor confirmar um input).
 */
import { SNAPSHOT_RATE, SNAPSHOT_LATE_FACTOR } from '@hookrush/shared';

export class LatencyManager {
  ping = 0;
  jitter = 0;
  inputDelayMs = 0;

  private lastSnapAt = 0;
  private snapInterval = 1000 / SNAPSHOT_RATE;
  private late = 0;
  private total = 0;

  onPong(rtt: number): void {
    if (this.ping > 0) this.jitter += (Math.abs(rtt - this.ping) - this.jitter) * 0.2;
    this.ping += (rtt - this.ping) * (this.ping === 0 ? 1 : 0.3);
  }

  onSnapshot(now: number): void {
    if (this.lastSnapAt > 0) {
      const dt = now - this.lastSnapAt;
      this.snapInterval += (dt - this.snapInterval) * 0.1;
      this.total++;
      if (dt > (1000 / SNAPSHOT_RATE) * SNAPSHOT_LATE_FACTOR) this.late++;
      if (this.total > 200) {
        // janela deslizante simples
        this.total = 100;
        this.late = Math.round(this.late / 2);
      }
    }
    this.lastSnapAt = now;
  }

  noteInputDelay(ms: number): void {
    this.inputDelayMs += (ms - this.inputDelayMs) * 0.2;
  }

  get snapshotRate(): number {
    return this.snapInterval > 0 ? 1000 / this.snapInterval : 0;
  }

  get lossPct(): number {
    return this.total > 0 ? (this.late / this.total) * 100 : 0;
  }

  get lastSnapshotAt(): number {
    return this.lastSnapAt;
  }
}
