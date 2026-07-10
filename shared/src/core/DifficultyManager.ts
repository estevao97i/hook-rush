import { PPM } from '../config/gameConfig';
import { RNG } from './rng';

/**
 * Curva de dificuldade a partir da distância percorrida: densidade,
 * tipos de padrão, vãos e frequência de ganchos. Compartilhada — servidor
 * e cliente geram exatamente o mesmo mapa.
 */
export class DifficultyManager {
  /** Tier 0..1 — satura por volta de ~2850 m (janela longa: a parede/velocidade
   *  já escalam sem teto, então os padrões precisam continuar endurecendo por
   *  boa parte da corrida em vez de estabilizar cedo). */
  tier(distM: number): number {
    return Math.min(1, 1 - Math.exp(-Math.max(0, distM) / 950));
  }

  /** Distância de descanso (px) entre padrões. */
  restPx(t: number, rng: RNG): number {
    return (9 - 5.5 * t) * PPM * rng.range(0.85, 1.35);
  }

  pickType(t: number, rng: RNG): string {
    return rng.weighted([
      ['hurdle', 3],
      ['gap', 2 + 2 * t],
      ['tunnel', 1.2 + 2 * t],
      ['suspended', 1 + t],
      ['doubleWall', 0.4 + 2 * t],
      ['pillars', 0.3 + 2.2 * t],
      ['steps', 1 + t],
      ['hookGap', 0.5 + 3.5 * t],
    ]);
  }

  ambientAnchorChance(t: number): number {
    return 0.15 + 0.2 * t;
  }
}
