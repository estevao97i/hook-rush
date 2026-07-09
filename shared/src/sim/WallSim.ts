/**
 * WallSystem — parede da morte, 100% determinística.
 * O servidor é a única autoridade; clientes apenas renderizam a posição
 * recebida (nunca dessincroniza).
 */
import * as G from '../config/gameConfig';

export class WallSim {
  x: number;
  elapsed = 0;

  constructor(startX: number) {
    this.x = startX;
  }

  /** Acelera com o tempo, nunca recua, nunca fica longe demais do líder. */
  step(dt: number, maxPlayerX: number): void {
    this.elapsed += dt;
    const speed = G.WALL_BASE_SPEED + G.WALL_ACCELERATION * this.elapsed;
    this.x = Math.max(this.x + speed * dt, maxPlayerX - G.WALL_MAX_GAP);
  }
}
