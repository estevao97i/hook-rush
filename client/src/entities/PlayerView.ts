/**
 * PlayerView — render puro do corredor (bola + perninhas + olhos + corda).
 * Não contém física: desenha qualquer fonte de estado (predição local,
 * interpolação remota ou simulação offline). Passada das pernas e passos
 * são cosméticos, calculados aqui no cliente.
 */
import Phaser from 'phaser';
import * as C from '../config/constants';
import { HookPhase } from '@hookrush/shared';

export interface ViewState {
  x: number; // centro
  y: number; // pés
  vx: number;
  grounded: boolean;
  crouched: boolean;
  stunned: boolean;
  alive: boolean;
  hookPhase: HookPhase;
  hookTipX: number;
  hookTipY: number;
}

/**
 * ViewState POOLED — as cenas preenchem e passam para view.update() no
 * mesmo frame (consumo síncrono). Evita alocar um objeto por jogador por
 * frame (GC zero no caminho de render).
 */
export const scratchView: ViewState = {
  x: 0,
  y: 0,
  vx: 0,
  grounded: false,
  crouched: false,
  stunned: false,
  alive: true,
  hookPhase: HookPhase.Idle,
  hookTipX: 0,
  hookTipY: 0,
};

export class PlayerView {
  /** Alvo invisível para câmera/trail seguirem. */
  readonly follow: Phaser.GameObjects.Rectangle;
  private gfx: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text | null = null;
  private legColor: number;
  private phase = 0;
  private stepAcc = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly color: number,
    isLocal: boolean,
    name?: string,
  ) {
    this.gfx = scene.add.graphics().setDepth(isLocal ? 6 : 5);
    if (!isLocal) this.gfx.setAlpha(0.92);
    this.follow = scene.add.rectangle(0, 0, 4, 4, 0xffffff, 0);
    this.legColor = Phaser.Display.Color.IntegerToColor(color).darken(22).color;
    if (name) {
      this.label = scene.add
        .text(0, 0, name, { fontFamily: 'monospace', fontSize: '13px', color: '#9aa5b1' })
        .setOrigin(0.5, 1)
        .setDepth(7)
        .setAlpha(0.85);
    }
  }

  update(s: ViewState, dt: number, onStep?: () => void): void {
    if (!s.alive) {
      this.gfx.clear();
      this.label?.setVisible(false);
      return;
    }
    this.follow.setPosition(s.x, s.y - 24);
    this.label?.setVisible(true).setPosition(s.x, s.y - 62);
    this.phase += (s.vx * dt) / 26;
    if (onStep && s.grounded && !s.crouched) {
      this.stepAcc += s.vx * dt;
      if (this.stepAcc > 46) {
        this.stepAcc = 0;
        onStep();
      }
    }
    this.draw(s);
  }

  private draw(s: ViewState): void {
    const g = this.gfx;
    g.clear();
    const cx = s.x;
    const bottom = s.y;
    const crouch = s.crouched;
    const bodyY = crouch ? bottom - 14 : bottom - 26;
    const rx = crouch ? 17 : 15;
    const ry = crouch ? 11 : 15;
    const attached = s.hookPhase === HookPhase.Attached;

    // corda em qualquer fase ativa (esticando, presa, recolhendo)
    if (s.hookPhase !== HookPhase.Idle) {
      g.lineStyle(3, 0xe8e8e8, 0.95);
      g.lineBetween(cx + 4, bodyY - 6, s.hookTipX, s.hookTipY);
      g.fillStyle(0xe8e8e8, 1);
      g.fillCircle(s.hookTipX, s.hookTipY, 3);
      g.lineStyle(3, this.legColor, 1);
      g.lineBetween(cx, bodyY - 2, cx + 6, bodyY - 8); // bracinho
    }

    // pernas finíssimas
    g.lineStyle(3, this.legColor, 1);
    const hipY = bodyY + ry - 4;
    if (attached) {
      g.lineBetween(cx, hipY, cx - 10, hipY + 14);
      g.lineBetween(cx - 3, hipY, cx - 14, hipY + 11);
      g.fillStyle(this.legColor);
      g.fillCircle(cx - 10, hipY + 14, 3);
      g.fillCircle(cx - 14, hipY + 11, 3);
    } else if (!s.grounded) {
      g.lineBetween(cx, hipY, cx + 9, hipY + 11);
      g.lineBetween(cx - 2, hipY, cx - 9, hipY + 7);
      g.fillStyle(this.legColor);
      g.fillCircle(cx + 9, hipY + 11, 3);
      g.fillCircle(cx - 9, hipY + 7, 3);
    } else {
      const stride = Phaser.Math.Clamp(s.vx * 0.05, 6, 20);
      for (let i = 0; i < 2; i++) {
        const ph = this.phase + i * Math.PI;
        const fx = cx + Math.cos(ph) * stride;
        const fy = bottom - Math.max(0, Math.sin(ph)) * 10;
        const midX = (cx + fx) / 2;
        const midY = (hipY + fy) / 2 - 3;
        g.lineBetween(cx, hipY, midX, midY);
        g.lineBetween(midX, midY, fx, fy);
        g.fillStyle(this.legColor);
        g.fillCircle(fx, fy, 3);
      }
    }

    // corpo (pisca no stun)
    const alpha = s.stunned ? 0.55 + 0.45 * Math.sin(this.scene.time.now * 0.04) : 1;
    g.fillStyle(this.color, alpha);
    g.fillEllipse(cx, bodyY, rx * 2, ry * 2);

    // olhos
    const ex = cx + 5;
    const eyy = bodyY - (crouch ? 2 : 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex, eyy, 4.2);
    g.fillCircle(ex + 8, eyy, 4.2);
    g.fillStyle(0x111111, 1);
    g.fillCircle(ex + 1.5, eyy, 1.9);
    g.fillCircle(ex + 9.5, eyy, 1.9);
  }

  destroy(): void {
    this.gfx.destroy();
    this.follow.destroy();
    this.label?.destroy();
  }
}
