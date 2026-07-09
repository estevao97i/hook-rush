/**
 * State schema do Colyseus — o SNAPSHOT que viaja aos clientes.
 * Leve por design: posição/velocidade/flags/corda por jogador + parede,
 * tick e fase. Obstáculos NÃO trafegam: são derivados da seed (mesmo mapa
 * em todos, sem custo de banda). Delta-comprimido pelo próprio Colyseus.
 */
import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

export class NetPlayer extends Schema {
  name = '';
  colorIdx = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  flags = 0; // PlayerFlags (alive/grounded/crouch/slide/stun)
  hookPhase = 0;
  hookX = 0; // ponta da corda (âncora quando presa) — dá ângulo+comprimento
  hookY = 0;
  ropeLen = 0;
  mult = 1;
  timeBonus = 0;
  distance = 0;
  lastSeq = 0; // ack do último input aplicado (reconciliação)
}
defineTypes(NetPlayer, {
  name: 'string',
  colorIdx: 'uint8',
  x: 'float32',
  y: 'float32',
  vx: 'float32',
  vy: 'float32',
  flags: 'uint8',
  hookPhase: 'uint8',
  hookX: 'float32',
  hookY: 'float32',
  ropeLen: 'float32',
  mult: 'float32',
  timeBonus: 'float32',
  distance: 'float32',
  lastSeq: 'uint32',
});

export class RoomState extends Schema {
  phase = 0; // GamePhase
  tick = 0;
  seed = 0;
  wallX = 0;
  countdown = 0;
  hostId = '';
  winnerId = '';
  players = new MapSchema<NetPlayer>();
}
defineTypes(RoomState, {
  phase: 'uint8',
  tick: 'uint32',
  seed: 'float64',
  wallX: 'float64',
  countdown: 'float32',
  hostId: 'string',
  winnerId: 'string',
  players: { map: NetPlayer },
});
