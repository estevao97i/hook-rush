/**
 * Overlay de pause (ESC ou botão mobile) — posições seguem a tela atual.
 */
import Phaser from 'phaser';
import { UI_TEXT } from '../config/constants';
import { makeButton, makeSlider } from '../ui/widgets';
import { SaveSystem } from '../core/SaveSystem';
import { AudioManager } from '../audio/AudioManager';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;

    this.add.rectangle(cx, h / 2, w * 3, h * 3, 0x0b0e14, 0.75).setInteractive();
    this.add
      .text(cx, 150, 'PAUSA', { fontFamily: 'monospace', fontSize: '56px', color: UI_TEXT })
      .setOrigin(0.5);

    makeButton(this, cx, 270, 'Continuar', () => this.resumeGame());
    makeButton(this, cx, 336, 'Reiniciar', () => {
      this.scene.stop('Game');
      this.scene.start('Game', { mode: SaveSystem.data.mode, aiDiff: SaveSystem.data.aiDiff });
    });
    makeButton(this, cx, 402, 'Menu', () => {
      this.scene.stop('Game');
      this.scene.start('Menu');
    });

    const au = AudioManager.get();
    makeSlider(this, cx - 150, 500, 300, 'Música', SaveSystem.data.musicVol, (v) => {
      SaveSystem.data.musicVol = v;
      SaveSystem.save();
      au.setMusicVol(v);
    });
    makeSlider(this, cx - 150, 560, 300, 'Efeitos', SaveSystem.data.sfxVol, (v) => {
      SaveSystem.data.sfxVol = v;
      SaveSystem.save();
      au.setSfxVol(v);
    });

    this.input.keyboard!.on('keydown-ESC', () => this.resumeGame());

    // timer da própria cena: não sobrevive ao shutdown (sem restart fantasma)
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  private onResize(): void {
    this.time.removeAllEvents();
    this.time.delayedCall(120, () => this.scene.restart());
  }

  private resumeGame(): void {
    this.scene.resume('Game');
    this.scene.stop();
  }
}
