/**
 * SnapshotSystem — copia a simulação para o schema do Colyseus.
 * Todos os floats são QUANTIZADOS antes da escrita: o schema só envia
 * campos alterados (delta compression), e valores quantizados idênticos
 * não geram tráfego — pacotes compactos, nada de JSON gordo.
 * O patch rate (SNAPSHOT_RATE = 20/s) decide quando isso vai ao fio;
 * a simulação continua a 60 ticks/s.
 */
import {
  PlayerCore,
  World,
  encodeFlags,
  quantize,
  QUANT_POS,
  QUANT_VEL,
  QUANT_ROPE,
  QUANT_DIST,
  QUANT_MULT,
} from '@hookrush/shared';
import { NetPlayer, RoomState } from '../rooms/state.js';

export function syncPlayer(net: NetPlayer, core: PlayerCore): void {
  net.x = quantize(core.x, QUANT_POS);
  net.y = quantize(core.y, QUANT_POS);
  net.vx = quantize(core.vx, QUANT_VEL);
  net.vy = quantize(core.vy, QUANT_VEL);
  net.flags = encodeFlags(core);
  net.hookPhase = core.hook.phase;
  net.hookX = quantize(core.hook.tipX, QUANT_POS);
  net.hookY = quantize(core.hook.tipY, QUANT_POS);
  net.ropeLen = quantize(core.hook.ropeLen, QUANT_ROPE);
  net.mult = quantize(core.mult, QUANT_MULT);
  net.timeBonus = quantize(core.timeBonus, QUANT_DIST);
  net.distance = quantize(core.distance, QUANT_DIST);
  net.lastSeq = core.lastInputSeq;
}

export function syncWorld(state: RoomState, world: World): void {
  state.tick = world.tick;
  state.wallX = quantize(world.wall.x, QUANT_POS);
  state.players.forEach((net, id) => {
    const core = world.players.get(id);
    if (core) syncPlayer(net, core);
  });
}
