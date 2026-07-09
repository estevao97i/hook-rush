/**
 * InputSystem — protocolo de entrada.
 * O cliente envia APENAS estes bits (nunca posição/velocidade/física).
 * Bordas (press/release) são derivadas das transições held→!held pela
 * própria simulação, o que torna o protocolo tolerante a perda de pacotes.
 */

export enum InputBits {
  Left = 1, // reservado (auto-runner não usa; futuro)
  Right = 2, // reservado
  Jump = 4,
  Slide = 8,
  Hook = 16,
}

export function hasBit(bits: number, bit: InputBits): boolean {
  return (bits & bit) !== 0;
}
