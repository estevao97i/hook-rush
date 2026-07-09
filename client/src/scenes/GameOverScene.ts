/**
 * Game Over: a parede alcançou o jogador (ou ele caiu). Mostra GAME OVER,
 * distância/recorde e o botão RECOMEÇAR — reiniciar zera velocidade,
 * parede, mapa, obstáculos e personagem (o restart da cena recria tudo).
 */
import Phaser from 'phaser';
import { UI_TEXT } from '../config/constants';
import { GameMode, AIDiff } from '../core/SaveSystem';
import { makeButton } from '../ui/widgets';

export interface GameOverData {
  mode: GameMode;
  aiDiff: AIDiff;
  dist: number;
  best: number;
  isRecord: boolean;
  aiDist: number;
  playerWon: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private data2!: GameOverData;

  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    this.data2 = data;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;

    this.add.rectangle(cx, h / 2, w * 3, h * 3, 0x0b0e14, 0.8).setInteractive();

    this.add
      .text(cx, 150, 'GAME OVER', { fontFamily: 'monospace', fontSize: '56px', color: '#ff5555' })
      .setOrigin(0.5);

    const lines = [`Distância: ${Math.floor(data.dist)} m`];
    if (data.mode === 'versus') {
      lines.push(`IA: ${Math.floor(data.aiDist)} m`);
      lines.push(data.playerWon ? 'Você venceu a IA!' : 'A IA venceu!');
    }
    lines.push(`Recorde: ${data.best} m`);
    this.add
      .text(cx, 280, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: UI_TEXT,
        align: 'center',
        lineSpacing: 12,
      })
      .setOrigin(0.5);

    if (data.isRecord) {
      const rec = this.add
        .text(cx, 386, '★ NOVO RECORDE! ★', {
          fontFamily: 'monospace',
          fontSize: '30px',
          color: '#ffd94d',
        })
        .setOrigin(0.5);
      this.tweens.add({ targets: rec, scale: { from: 1, to: 1.15 }, duration: 400, yoyo: true, repeat: -1 });
    }

    makeButton(this, cx, 470, 'RECOMEÇAR  (R)', () => this.restart());
    makeButton(this, cx, 536, 'Menu', () => {
      this.scene.stop('Game');
      this.scene.start('Menu');
    });

    this.input.keyboard!.on('keydown-R', () => this.restart());

    // rotação/resize: reposiciona recriando a cena — timer da própria cena
    // (morre com ela; um setTimeout global poderia restartar após o stop)
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  private onResize(): void {
    this.time.removeAllEvents();
    this.time.delayedCall(120, () => this.scene.restart(this.data2));
  }

  private restart(): void {
    this.scene.stop('Game');
    this.scene.start('Game', { mode: this.data2.mode, aiDiff: this.data2.aiDiff });
  }
}
