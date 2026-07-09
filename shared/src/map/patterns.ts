/**
 * Padrões procedurais de obstáculos (ObstacleSystem — geração).
 * Puro e determinístico: mesmo tier + mesmo RNG = mesmo padrão em qualquer
 * máquina. Os "action hints" são lidos pela IA offline (mesma visão de um
 * jogador humano).
 *
 * Coordenadas: x relativo ao início do padrão; y relativo ao chão
 * (0 = topo do chão, negativo = para cima).
 */
import { PPM, JUMP_V, GRAVITY, BASE_SPEED, HOOK_TRAVEL_TIME } from '../config/gameConfig';
import { RNG } from '../core/rng';

export interface BlockDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnchorDef {
  x: number;
  y: number;
}

export type ActionKind = 'jump' | 'crouch' | 'hook';

export interface ActionDef {
  x: number;
  kind: ActionKind;
  /** jump: segundos segurando; crouch: comprimento (px) abaixado. */
  hold?: number;
  /** antecedência (s) — multiplicada pela velocidade por quem consome. */
  lead?: number;
}

export interface PatternDef {
  type: string;
  width: number;
  blocks: BlockDef[];
  anchors: AnchorDef[];
  gaps: Array<[number, number]>;
  actions: ActionDef[];
}

const AIR_TIME = (2 * JUMP_V) / GRAVITY;

const expectedSpeed = (t: number) => BASE_SPEED * (1 + 1.4 * t);

function jumpLead(h: number): number {
  const disc = JUMP_V * JUMP_V - 2 * GRAVITY * (h + 16);
  const t = disc > 0 ? (JUMP_V - Math.sqrt(disc)) / GRAVITY : 0.35;
  return t + 0.05;
}

function hurdle(t: number, rng: RNG): PatternDef {
  const h = rng.range(42, 66 + 40 * t);
  const w = rng.range(28, 54);
  return {
    type: 'hurdle',
    width: w,
    blocks: [{ x: 0, y: -h, w, h }],
    anchors: [],
    gaps: [],
    actions: [{ x: -6, kind: 'jump', hold: 0.12 + h / 900, lead: jumpLead(h) }],
  };
}

function doubleWall(t: number, rng: RNG): PatternDef {
  const h1 = rng.range(44, 66);
  const h2 = rng.range(44, 72);
  const w = 34;
  const s = 2.6 * PPM + expectedSpeed(t) * 0.28;
  return {
    type: 'doubleWall',
    width: s + w * 2,
    blocks: [
      { x: 0, y: -h1, w, h: h1 },
      { x: w + s, y: -h2, w, h: h2 },
    ],
    anchors: [],
    gaps: [],
    actions: [
      { x: -6, kind: 'jump', hold: 0.12, lead: jumpLead(h1) },
      { x: w + s - 6, kind: 'jump', hold: 0.12, lead: jumpLead(h2) },
    ],
  };
}

function gapPattern(t: number, rng: RNG): PatternDef {
  const spd = expectedSpeed(t);
  const gw = Math.max(84, Math.min(rng.range(0.34, 0.58) * spd * AIR_TIME, 8.5 * PPM));
  return {
    type: 'gap',
    width: gw,
    blocks: [],
    anchors: [],
    gaps: [[0, gw]],
    actions: [{ x: -12, kind: 'jump', hold: 0.28, lead: 0.03 }],
  };
}

function tunnel(t: number, rng: RNG): PatternDef {
  const len = rng.range(2.2, 4 + 3.5 * t) * PPM;
  const clear = 42; // agachado (28) passa; em pé (46) bate
  return {
    type: 'tunnel',
    width: len,
    blocks: [{ x: 0, y: -(clear + 170), w: len, h: 170 }],
    anchors: [],
    gaps: [],
    actions: [{ x: -26, kind: 'crouch', hold: len + 56, lead: 0.12 }],
  };
}

function suspended(_t: number, rng: RNG): PatternDef {
  const w = rng.range(56, 96);
  return {
    type: 'suspended',
    width: w,
    blocks: [{ x: 0, y: -78, w, h: 36 }],
    anchors: [],
    gaps: [],
    actions: [{ x: -24, kind: 'crouch', hold: w + 52, lead: 0.12 }],
  };
}

function pillars(t: number, rng: RNG): PatternDef {
  const n = 2 + Math.round(rng.next() * (1 + 1.5 * t));
  const spd = expectedSpeed(t);
  const pw = 40;
  const gap = Math.min(rng.range(0.32, 0.45) * spd * AIR_TIME, 6.5 * PPM);
  const blocks: BlockDef[] = [];
  const actions: ActionDef[] = [];
  for (let i = 0; i < n; i++) {
    const xi = i * (pw + gap);
    const h = rng.range(48, 88);
    blocks.push({ x: xi, y: -h, w: pw, h });
    actions.push({ x: xi - 6, kind: 'jump', hold: 0.14, lead: jumpLead(h) });
  }
  return { type: 'pillars', width: n * (pw + gap), blocks, anchors: [], gaps: [], actions };
}

function steps(_t: number, rng: RNG): PatternDef {
  const w1 = rng.range(90, 140);
  const w2 = rng.range(90, 140);
  return {
    type: 'steps',
    width: w1 + w2 + 40,
    blocks: [
      { x: 0, y: -52, w: w1 + w2, h: 52 },
      { x: w1, y: -104, w: w2, h: 52 },
    ],
    anchors: [],
    gaps: [],
    actions: [
      { x: -6, kind: 'jump', hold: 0.1, lead: jumpLead(52) },
      { x: w1 - 6, kind: 'jump', hold: 0.1, lead: jumpLead(52) },
    ],
  };
}

function hookGap(t: number, rng: RNG): PatternDef {
  const gw = Math.min(rng.range(7.5, 10.5 + 5 * t) * PPM, 12.5 * PPM);
  const n = Math.max(1, Math.round(gw / (5.5 * PPM)));
  const anchors: AnchorDef[] = [];
  for (let i = 0; i < n; i++) {
    anchors.push({ x: (gw * (i + 0.5)) / n, y: -(225 + rng.range(0, 45)) });
  }
  return {
    type: 'hookGap',
    width: gw,
    blocks: [],
    anchors,
    gaps: [[0, gw]],
    actions: [
      { x: -12, kind: 'jump', hold: 0.22, lead: 0.03 },
      { x: gw * 0.1, kind: 'hook', lead: 0.02 + HOOK_TRAVEL_TIME },
    ],
  };
}

const BUILDERS: Record<string, (t: number, rng: RNG) => PatternDef> = {
  hurdle,
  doubleWall,
  gap: gapPattern,
  tunnel,
  suspended,
  pillars,
  steps,
  hookGap,
};

export function buildPattern(type: string, t: number, rng: RNG): PatternDef {
  const builder = BUILDERS[type] ?? hurdle;
  return builder(t, rng);
}
