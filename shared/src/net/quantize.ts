/**
 * Quantização dos campos do snapshot (PacketSerializer — lado dos dados).
 * Duas funções: (1) pacotes menores em floats; (2) DELTA COMPRESSION real —
 * o schema do Colyseus só envia campos que MUDARAM, e valores quantizados
 * idênticos não sujam o patch (estados parados custam ~zero de banda).
 */

export const QUANT_POS = 10; // posição: 0,1 px
export const QUANT_VEL = 2; // velocidade: 0,5 px/s
export const QUANT_ROPE = 2; // corda: 0,5 px
export const QUANT_DIST = 10; // distância: 0,1 m
export const QUANT_MULT = 1000; // multiplicador: 0,001

/** Arredonda v para a grade 1/steps. */
export function quantize(v: number, steps: number): number {
  return Math.round(v * steps) / steps;
}
