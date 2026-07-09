/**
 * Visuais de corrida compartilhados entre o modo offline e o online:
 * parede da morte, parallax e anel de dica do gancho. Render puro.
 */
import Phaser from 'phaser';
import { MapModel, findBestAnchor, GROUND_Y, WALL_WIDTH } from '@hookrush/shared';
import { GAME_W, ANCHOR_COLOR } from '../config/constants';

export class WallView {
  private body: Phaser.GameObjects.Rectangle;
  private edge: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.body = scene.add
      .rectangle(0, GROUND_Y - 800, WALL_WIDTH, 4000, 0xd23f3f, 0.35)
      .setDepth(8);
    this.edge = scene.add.rectangle(0, GROUND_Y - 800, 6, 4000, 0xff6b5e, 0.9).setDepth(8);
  }

  update(x: number): void {
    this.body.setX(x - WALL_WIDTH / 2);
    this.edge.setX(x - 3);
  }
}

export class Parallax {
  private items: Array<{ r: Phaser.GameObjects.Rectangle; f: number }> = [];

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < 26; i++) {
      const f = i % 2 === 0 ? 0.25 : 0.45;
      const r = scene.add
        .rectangle(
          Math.random() * 3200,
          160 + Math.random() * 400,
          40 + Math.random() * 120,
          60 + Math.random() * 240,
          i % 2 ? 0x1c2230 : 0x181d28,
        )
        .setScrollFactor(f)
        .setDepth(-9 + (i % 2));
      this.items.push({ r, f });
    }
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, viewW: number): void {
    for (const p of this.items) {
      const screenX = p.r.x - cam.scrollX * p.f;
      if (screenX < -220) p.r.x += Math.max(viewW, GAME_W) + 440 + Math.random() * 300;
    }
  }
}

/** Anel pulsante na melhor âncora atingível (affordance do gancho). */
export function drawHookHint(
  gfx: Phaser.GameObjects.Graphics,
  map: MapModel,
  cx: number,
  cy: number,
  timeNow: number,
): void {
  gfx.clear();
  const a = findBestAnchor(cx, cy, map);
  if (!a) return;
  const pulse = 12 + Math.sin(timeNow * 0.012) * 3;
  gfx.lineStyle(2, ANCHOR_COLOR, 0.6);
  gfx.strokeCircle(a.x, a.y, pulse);
}
