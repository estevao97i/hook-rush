# Hook Rush

Runner infinito com gancho — agora **multiplayer online autoritativo**
(até 4 jogadores por sala), inspirado em SpeedRunners. Phaser 3 + TypeScript
no cliente, Node + Colyseus no servidor. **Zero assets externos.**

## Monorepo

```
client/   Phaser: render, inputs, predição local, interpolação, UI
server/   Colyseus: salas, simulação autoritativa a 60 ticks/s, snapshots a 20/s
shared/   fonte única: física/simulação, mapa procedural, tipos, protocolo, configs
```

O cliente **nunca** envia posição/velocidade/física — apenas `InputBits`
(pular/deslizar/gancho) com número de sequência. O servidor decide posição,
colisões, corda, parede da morte, mortes e vencedor.

## Rodar (dev local)

```bash
npm install
npm run dev:server    # ws://localhost:2567
npm run dev           # cliente em http://localhost:5199
```

Outro computador/celular na mesma rede: abra `http://IP-DO-MAC:5199` — o
cliente conecta sozinho em `ws://IP-DO-MAC:2567` (usa o hostname da página).
Override sem tocar em código: `?server=192.168.0.10:2567` ou `VITE_SERVER_URL`.

Bot de teste (2º jogador de mentira): `npm run bot -- CODIGO`.

## Online

- **Jogo Rápido**: entra/cria sala pública automaticamente.
- **Criar Sala**: gera código de 5 letras (ex.: `A8JKP`) para compartilhar.
- **Entrar com Código**: joinById direto na sala do amigo.
- Corrida: countdown → racing → resultados → lobby (rematch na mesma sala).
- Jogador local: **client prediction** + reconciliação suave (nunca teleporta).
- Demais jogadores: **interpolação** com atraso fixo (suave a 100–200 ms de ping).
- Mapa: o servidor manda só a **seed** — todos geram obstáculos idênticos.
- Reconexão: janela de 15 s durante a corrida.

## Controles

| Ação | PC | Mobile |
| --- | --- | --- |
| Pular (segurar = mais alto) | Espaço | botão ▲ |
| Deslizar | Shift / ↓ / S | botão ▼ |
| Corda (segurar mantém; soltar solta) | clique esquerdo (hold) | botão ⊙ (hold) |
| Pause (offline) / sair (online) | ESC | botão ❚❚ |
| Debug (FPS, ping, tick, seq, snapshot) | F3 | — |

## Regras

- Corre sozinho; velocidade **infinita** (ganho por segundo + 2% por perfect).
- Bater nunca mata: perde parte da velocidade (nunca volta à inicial).
- Parede da morte persegue e acelera — tocar = eliminação (servidor decide).
- Vence quem sobrar vivo (ou maior distância).

## Configuração (sem números mágicos)

- `shared/src/config/gameConfig.ts` — física completa: velocidades,
  aceleração, gravidade, slide, gancho, parede, hitbox, sub-passos.
- `shared/src/config/netConfig.ts` — tick rate (60), snapshot rate (20),
  máx. de jogadores (4), porta (2567), interpolação, countdown, reconexão.

## Sistemas

| Sistema | Onde |
| --- | --- |
| Movement/Physics/Collision | `shared/sim/PlayerSim.ts` |
| Hook | `shared/sim/HookSim.ts` |
| Wall | `shared/sim/WallSim.ts` |
| Obstacle (dados) | `shared/map/MapModel.ts` + `patterns.ts` |
| World (ordem do tick) | `shared/sim/World.ts` |
| Input | `shared/sim/input.ts` + `client/input/` |
| Network | `client/network/` + `shared/net/messages.ts` |
| Room | `server/rooms/GameRoom.ts` |
| Snapshot | `server/systems/snapshot.ts` + `server/rooms/state.ts` |
| Player (render) | `client/entities/PlayerView.ts` |
| Camera/HUD | cenas + `client/ui/HUD.ts` |

O modo offline (single/vs IA) roda a MESMA simulação compartilhada
localmente — física idêntica ao online, sem duplicação.

## Escala futura

A separação sim/estado/render + eventos de simulação + seed determinística
deixam prontos os caminhos para: ranking, replay (gravar seed + stream de
inputs), espectadores (snapshots sem input), cosméticos (colorIdx → skin),
matchmaking/servidores dedicados (Colyseus escala horizontal com presence
Redis) e login (auth no `onAuth` da sala).
