/**
 * NetworkClock — relógio de rede sincronizado com o TICK do servidor.
 *
 * A interpolação NÃO usa o horário de chegada dos pacotes (jitter de rede
 * viraria jitter visual). Cada snapshot ancora o relógio: estimamos o tempo
 * do servidor e ajustamos o offset com drift suave (CLOCK_DRIFT_FACTOR);
 * só ressincronizamos duro em dessincronias grandes (CLOCK_SNAP_MS).
 */
import { SERVER_TICK_RATE, CLOCK_DRIFT_FACTOR, CLOCK_SNAP_MS } from '@hookrush/shared';

export class NetworkClock {
  private offsetMs = 0; // serverTimeMs - localNow
  private initialized = false;

  /** Chamar a cada snapshot com o tick do servidor. `rttMs` (RTT medido do
   *  ping/pong) compensa o tempo de trânsito do pacote — sem isso o offset
   *  nasce enviesado em meio RTT até o drift absorver, visível em pings altos. */
  onSnapshot(serverTick: number, localNow: number, rttMs = 0): void {
    const serverMs = (serverTick * 1000) / SERVER_TICK_RATE;
    const target = serverMs - localNow + rttMs / 2;
    if (!this.initialized) {
      this.offsetMs = target;
      this.initialized = true;
      return;
    }
    const diff = target - this.offsetMs;
    if (Math.abs(diff) > CLOCK_SNAP_MS) this.offsetMs = target; // resync duro (raro)
    else this.offsetMs += diff * CLOCK_DRIFT_FACTOR; // drift suave
  }

  /** Tempo estimado do servidor (ms na linha do tempo dos ticks). */
  serverNowMs(localNow: number): number {
    return localNow + this.offsetMs;
  }

  /** Converte um tick do servidor para a mesma linha do tempo (ms). */
  static tickToMs(tick: number): number {
    return (tick * 1000) / SERVER_TICK_RATE;
  }

  get ready(): boolean {
    return this.initialized;
  }
}
