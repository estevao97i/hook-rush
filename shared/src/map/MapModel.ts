/**
 * MapModel (ObstacleSystem — dados): mapa infinito procedural PURO, sem
 * nenhuma dependência de engine. O servidor simula contra ele; o cliente
 * gera o MESMO mapa a partir da mesma seed e apenas o renderiza.
 *
 * Blocos são AABBs (x,y = canto superior esquerdo). A geração é sequencial
 * e determinística: independe de QUANDO ensure() é chamado.
 */
import { GROUND_Y, KILL_Y, PPM, START_X } from '../config/gameConfig';
import { RNG } from '../core/rng';
import { DifficultyManager } from '../core/DifficultyManager';
import { buildPattern, PatternDef, ActionKind } from './patterns';

export interface SolidBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapAnchor {
  id: number;
  x: number;
  y: number;
}

export interface AbsAction {
  x: number;
  kind: ActionKind;
  hold?: number;
  lead?: number;
}

export interface PatternInstance {
  id: number;
  type: string;
  startX: number;
  endX: number;
  actions: AbsAction[];
}

const GROUND_DEPTH = KILL_Y - GROUND_Y + 400; // altura das placas de chão

export class MapModel {
  readonly blocks: SolidBlock[] = [];
  readonly anchors: MapAnchor[] = [];
  readonly patterns: PatternInstance[] = [];

  private gaps: Array<{ x0: number; x1: number }> = [];
  private cursor: number;
  private nextPatternId = 1;
  private nextBlockId = 1;
  private nextAnchorId = 1;
  private readonly rng: RNG;
  private readonly diff = new DifficultyManager();

  constructor(readonly seed: number, readonly originX = START_X) {
    this.rng = new RNG(seed);
    // pista inicial segura
    this.layGround(originX - 700, originX + 520);
    this.cursor = originX + 520;
  }

  /** Garante mapa gerado até untilX (sequencial e determinístico). */
  ensure(untilX: number): void {
    while (this.cursor < untilX) this.emitChunk();
  }

  private emitChunk(): void {
    const t = this.diff.tier((this.cursor - this.originX) / PPM);
    const rest = this.diff.restPx(t, this.rng);
    this.layGround(this.cursor, this.cursor + rest);
    if (rest > 5 * PPM && this.rng.chance(this.diff.ambientAnchorChance(t))) {
      this.addAnchor(this.cursor + rest / 2, GROUND_Y - this.rng.range(215, 285));
    }
    this.cursor += rest;
    this.place(buildPattern(this.diff.pickType(t, this.rng), t, this.rng));
  }

  private place(def: PatternDef): void {
    const bx = this.cursor;
    for (const b of def.blocks) this.addBlock(bx + b.x, GROUND_Y + b.y, b.w, b.h);
    let gx = 0;
    const sorted = [...def.gaps].sort((a, b) => a[0] - b[0]);
    for (const [g0, g1] of sorted) {
      if (g0 > gx) this.layGround(bx + gx, bx + g0);
      this.gaps.push({ x0: bx + g0, x1: bx + g1 });
      gx = g1;
    }
    if (gx < def.width) this.layGround(bx + gx, bx + def.width);
    for (const a of def.anchors) this.addAnchor(bx + a.x, GROUND_Y + a.y);
    this.patterns.push({
      id: this.nextPatternId++,
      type: def.type,
      startX: bx,
      endX: bx + def.width,
      actions: def.actions.map((a) => ({ ...a, x: bx + a.x })),
    });
    this.cursor += def.width;
  }

  private layGround(x0: number, x1: number): void {
    if (x1 - x0 < 4) return;
    // 2px de sobreposição suaviza emendas entre placas
    this.addBlock(x0 - 2, GROUND_Y, x1 - x0 + 4, GROUND_DEPTH);
  }

  private addBlock(x: number, y: number, w: number, h: number): void {
    this.blocks.push({ id: this.nextBlockId++, x, y, w, h });
  }

  private addAnchor(x: number, y: number): void {
    this.anchors.push({ id: this.nextAnchorId++, x, y });
  }

  /** Recicla tudo atrás de minX (não afeta o RNG — geração já consumida). */
  cull(minX: number): void {
    let i = 0;
    while (i < this.blocks.length) {
      if (this.blocks[i].x + this.blocks[i].w < minX) this.blocks.splice(i, 1);
      else i++;
    }
    while (this.patterns.length && this.patterns[0].endX < minX) this.patterns.shift();
    for (let j = this.anchors.length - 1; j >= 0; j--) {
      if (this.anchors[j].x < minX) this.anchors.splice(j, 1);
    }
    this.gaps = this.gaps.filter((g) => g.x1 > minX);
  }

  // ---------- consultas (CollisionSystem usa solidsNear) ----------

  solidsNear(x0: number, x1: number): SolidBlock[] {
    return this.blocks.filter((b) => b.x + b.w >= x0 && b.x <= x1);
  }

  anchorsNear(x: number, range: number): MapAnchor[] {
    return this.anchors.filter((a) => Math.abs(a.x - x) <= range);
  }

  patternsInRange(x0: number, x1: number): PatternInstance[] {
    return this.patterns.filter((p) => p.endX >= x0 && p.startX <= x1);
  }

  patternAt(x: number): PatternInstance | null {
    return this.patterns.find((p) => x >= p.startX - 40 && x <= p.endX + 20) ?? null;
  }

  isOverGap(x: number): boolean {
    return this.gaps.some((g) => x >= g.x0 && x <= g.x1);
  }
}
