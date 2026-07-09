/**
 * Widgets de UI reutilizáveis (botões e sliders) — menu, pause e game over.
 */
import Phaser from 'phaser';
import { UI_TEXT } from '../config/constants';
import { AudioManager } from '../audio/AudioManager';

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  w = 320,
  h = 54,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, w, h, 0x232a38).setStrokeStyle(2, 0x39445a);
  const txt = scene.add
    .text(0, 0, label, { fontFamily: 'monospace', fontSize: '22px', color: UI_TEXT })
    .setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, txt]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => {
    bg.setFillStyle(0x2f3949);
    c.setScale(1.04);
  });
  bg.on('pointerout', () => {
    bg.setFillStyle(0x232a38);
    c.setScale(1);
  });
  bg.on('pointerup', () => {
    AudioManager.get().click();
    onClick();
  });
  return c;
}

export function makeSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  label: string,
  value: number,
  onChange: (v: number) => void,
): Phaser.GameObjects.Container {
  const lbl = scene.add
    .text(0, -24, label, { fontFamily: 'monospace', fontSize: '16px', color: UI_TEXT })
    .setOrigin(0, 0.5);
  const track = scene.add.rectangle(0, 0, w, 6, 0x39445a).setOrigin(0, 0.5);
  const fill = scene.add.rectangle(0, 0, w * value, 6, 0x4da6ff).setOrigin(0, 0.5);
  const handle = scene.add.circle(w * value, 0, 11, 0xe8ecf4);
  const c = scene.add.container(x, y, [lbl, track, fill, handle]);
  handle.setInteractive({ draggable: true, useHandCursor: true });
  handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => {
    const v = Phaser.Math.Clamp(dragX / w, 0, 1);
    handle.x = v * w;
    fill.width = v * w;
    onChange(v);
  });
  return c;
}
