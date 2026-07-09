/**
 * Eventos emitidos pela simulação em cada tick.
 * Servidor: logs/decisões de partida. Cliente: efeitos (partículas/som).
 * Também são a base para um futuro sistema de replay.
 */

export type SimEventType =
  | 'jump'
  | 'land'
  | 'hit'
  | 'perfect'
  | 'throw'
  | 'attach'
  | 'release'
  | 'fall'
  | 'wallkill';

export interface SimEvent {
  type: SimEventType;
  playerId: string;
  x: number;
  y: number;
  /** land: impacto (vy); release: 1 = timing bom. */
  v?: number;
}
