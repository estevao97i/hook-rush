/**
 * PacketSerializer — montagem dos pacotes de input.
 * O pacote é minúsculo ({s, b, t}) e o objeto é REUTILIZADO a cada envio
 * (o transporte serializa sincronamente) — zero alocação por input.
 * Snapshots não passam por aqui: viajam pelo schema binário delta do
 * Colyseus, com floats quantizados no servidor (shared/net/quantize).
 */
import { InputMessage } from '@hookrush/shared';

const pkt: InputMessage = { s: 0, b: 0, t: 0 };

/** Pacote de input pooled — válido até a próxima chamada. */
export function inputPacket(seq: number, bits: number, tMs: number): InputMessage {
  pkt.s = seq;
  pkt.b = bits;
  pkt.t = Math.round(tMs);
  return pkt;
}
