/**
 * RollbackManager — métricas das correções de predição (debug/telemetria):
 * cada reconciliação com erro acima do limiar conta como rollback; erros
 * gigantes (janela de replay estourada) contam como snap forçado.
 */
import { ROLLBACK_ERROR_THRESHOLD } from '@hookrush/shared';

export class RollbackManager {
  /** correções perceptíveis (erro > limiar) */
  rollbacks = 0;
  /** replays descartados por atraso extremo (aceitou o servidor direto) */
  snaps = 0;
  /** último erro de predição medido (px) */
  lastErrorPx = 0;
  /** pico de erro na sessão (px) */
  maxErrorPx = 0;

  note(errPx: number): void {
    this.lastErrorPx = errPx;
    if (errPx > this.maxErrorPx) this.maxErrorPx = errPx;
    if (errPx > ROLLBACK_ERROR_THRESHOLD) this.rollbacks++;
  }
}
