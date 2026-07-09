/**
 * Hook Rush — servidor autoritativo (Node + Colyseus).
 * Porta configurável por env PORT (padrão: 2567). Na mesma rede local,
 * outros computadores conectam trocando localhost pelo IP do Mac —
 * o cliente resolve isso sozinho (usa o hostname da página).
 */
import { Server } from 'colyseus';
import { DEFAULT_PORT, ROOM_NAME } from '@hookrush/shared';
import { GameRoom } from './rooms/GameRoom.js';
import { log } from './util/logger.js';

const port = Number(process.env.PORT ?? DEFAULT_PORT);

const gameServer = new Server();
// filterBy(['privateRoom']): Quick Play (joinOrCreate {privateRoom:false})
// nunca cai numa sala privada de código
gameServer.define(ROOM_NAME, GameRoom).filterBy(['privateRoom']);

gameServer.listen(port).then(() => {
  log(`Hook Rush server ouvindo em ws://0.0.0.0:${port}`);
});
