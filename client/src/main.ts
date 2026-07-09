/**
 * Hook Rush — cliente (render + inputs + predição).
 * Phaser 3 + TypeScript. Nenhum asset externo: tudo é procedural.
 * A física NÃO vive aqui: a simulação compartilhada (@hookrush/shared)
 * roda no servidor (online) e localmente (offline/predição) — por isso
 * não há engine de física do Phaser configurada.
 *
 * Tela cheia adaptativa: altura lógica fixa (GAME_H), largura pela
 * proporção da janela — 100% da tela em qualquer orientação.
 */
import Phaser from 'phaser';
import { GAME_H, MIN_GAME_W, MAX_GAME_W } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';
import { LobbyScene } from './scenes/LobbyScene';
import { OnlineGameScene } from './scenes/OnlineGameScene';

/** Largura lógica que casa com a proporção atual da janela (sem letterbox). */
function fittedWidth(): number {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  return Phaser.Math.Clamp(Math.round(GAME_H * aspect), MIN_GAME_W, MAX_GAME_W);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: fittedWidth(),
  height: GAME_H,
  backgroundColor: '#12151d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, LobbyScene, OnlineGameScene, PauseScene, GameOverScene],
});

// resize/rotação: o refit roda no PRÓXIMO frame (rAF) — durante o evento
// 'resize' o layout ainda não refluiu e o ScaleManager leria bounds antigos
let resizeRaf = 0;
const refit = () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    game.scale.setGameSize(fittedWidth(), GAME_H);
    game.scale.refresh();
  });
};
window.addEventListener('resize', refit);
window.addEventListener('orientationchange', refit);

// handle de debug (console do navegador)
(window as any).game = game;
