/**
 * Bot de teste (dev): conecta como um jogador real, entra numa sala
 * (Quick Play ou código via argv), inicia a corrida se for host e envia
 * inputs simples. Uso: npm run bot [-- CODIGO]
 */
import { Client, Room } from 'colyseus.js';
import { ROOM_NAME, ClientMsg, ServerMsg, GamePhase, InputBits, DEFAULT_PORT } from '@hookrush/shared';

const code = process.argv[2];
const url = process.env.SERVER_URL ?? `ws://localhost:${DEFAULT_PORT}`;

async function main(): Promise<void> {
  const client = new Client(url);
  const room: Room = code
    ? await client.joinById(code, { name: 'Bot' })
    : await client.joinOrCreate(ROOM_NAME, { privateRoom: false, name: 'Bot' });
  console.log(`[bot] entrou na sala ${room.roomId} como ${room.sessionId}`);

  let seq = 0;
  let phase = GamePhase.Lobby;
  room.onStateChange((state: any) => {
    phase = state.phase;
  });
  room.onMessage(ServerMsg.GameOver, (m: any) => {
    console.log(`[bot] game over — vencedor: ${m.winnerName}`, m.distances);
  });
  room.onMessage(ServerMsg.Pong, () => {});
  room.onLeave(() => {
    console.log('[bot] saiu da sala');
    process.exit(0);
  });

  // se for host, inicia a corrida sozinho após 2 s
  setTimeout(() => {
    if (phase === GamePhase.Lobby) room.send(ClientMsg.Start);
  }, 2000);

  // inputs: pulinhos periódicos (suficiente para validar a simulação)
  setInterval(() => {
    if (phase !== GamePhase.Racing) return;
    seq++;
    const jumping = Math.floor(Date.now() / 400) % 3 === 0;
    room.send(ClientMsg.Input, { s: seq, b: jumping ? InputBits.Jump : 0, t: Date.now() % 1e7 });
  }, 1000 / 30);

  // relatório periódico
  setInterval(() => {
    const st: any = room.state;
    const me = st.players?.get?.(room.sessionId);
    if (me) {
      console.log(
        `[bot] fase=${st.phase} tick=${st.tick} x=${me.x?.toFixed(0)} dist=${me.distance?.toFixed(0)}m wall=${st.wallX?.toFixed(0)}`,
      );
    }
  }, 2000);
}

main().catch((e) => {
  console.error('[bot] erro:', e.message ?? e);
  process.exit(1);
});
