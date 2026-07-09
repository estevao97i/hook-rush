/**
 * @hookrush/shared — fonte única de verdade entre cliente e servidor:
 * configurações, tipos, simulação determinística, mapa e protocolo de rede.
 */
export * from './config/gameConfig';
export * from './config/netConfig';
export * from './core/rng';
export * from './core/DifficultyManager';
export * from './map/patterns';
export * from './map/MapModel';
export * from './sim/types';
export * from './sim/input';
export * from './sim/events';
export * from './sim/HookSim';
export * from './sim/PlayerSim';
export * from './sim/WallSim';
export * from './sim/World';
export * from './net/messages';
export * from './net/quantize';
