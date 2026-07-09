/**
 * World — orquestra um tick completo da partida, na ordem:
 * inputs → física+corda por jogador → parede → obstáculos → pontuação.
 * Usado pelo servidor (autoridade), pelo modo offline do cliente e pela
 * predição local (com a parede desligada — parede é só do servidor).
 */
import * as G from '../config/gameConfig';
import { MapModel } from '../map/MapModel';
import { PlayerCore } from './types';
import { createPlayer, stepPlayer } from './PlayerSim';
import { WallSim } from './WallSim';
import { SimEvent } from './events';

export interface WorldOptions {
  /** Predição do cliente desliga a parede (autoridade exclusiva do servidor). */
  wallEnabled?: boolean;
}

export class World {
  readonly map: MapModel;
  readonly wall: WallSim;
  readonly players = new Map<string, PlayerCore>();
  readonly wallEnabled: boolean;
  tick = 0;
  /** Array de eventos REUTILIZADO entre ticks (zero alocação por tick —
   *  válido até o próximo step; consumidores processam sincronamente). */
  private readonly events: SimEvent[] = [];

  constructor(readonly seed: number, opts: WorldOptions = {}) {
    this.map = new MapModel(seed);
    this.wall = new WallSim(G.START_X - G.WALL_START_DISTANCE);
    this.wallEnabled = opts.wallEnabled ?? true;
    this.map.ensure(G.START_X + G.GEN_AHEAD);
  }

  addPlayer(id: string, colorIdx: number): PlayerCore {
    const p = createPlayer(id, colorIdx);
    this.players.set(id, p);
    return p;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  get alivePlayers(): PlayerCore[] {
    return [...this.players.values()].filter((p) => p.alive);
  }

  /** Um tick (1/60s). inputs: bits por jogador (ausente = último conhecido). */
  step(inputs: ReadonlyMap<string, number>): SimEvent[] {
    this.tick++;
    const ev = this.events;
    ev.length = 0;

    // 1. inputs → 2. física + corda
    let maxX = G.START_X;
    for (const p of this.players.values()) {
      stepPlayer(p, inputs.get(p.id) ?? p.lastBits, this.map, ev);
      if (p.alive && p.x > maxX) maxX = p.x;
    }

    // 3. parede da morte (tocar = eliminação imediata)
    if (this.wallEnabled && this.alivePlayers.length > 0) {
      this.wall.step(G.SIM_DT, maxX);
      for (const p of this.players.values()) {
        if (p.alive && this.wall.x >= p.x - G.BODY_W / 2) {
          p.alive = false;
          ev.push({ type: 'wallkill', playerId: p.id, x: p.x, y: p.y });
        }
      }
    }

    // 4. obstáculos: gera à frente, recicla atrás
    this.map.ensure(maxX + G.GEN_AHEAD);
    this.map.cull(Math.min(this.wall.x, maxX) - G.CULL_BEHIND);

    // 5. pontuação de perfects (+2% sem teto)
    for (const p of this.players.values()) if (p.alive) this.score(p, ev);

    return ev;
  }

  private score(p: PlayerCore, ev: SimEvent[]): void {
    for (const pat of this.map.patterns) {
      if (pat.endX > p.x) break; // lista ordenada
      if (pat.endX <= p.lastScoredEndX) continue;
      p.lastScoredEndX = pat.endX;
      if (!p.hitPatterns.has(pat.id)) {
        p.mult *= G.PERFECT_GAIN;
        ev.push({ type: 'perfect', playerId: p.id, x: p.x, y: p.y });
      } else p.hitPatterns.delete(pat.id);
    }
  }
}
