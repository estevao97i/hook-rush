/**
 * HUDSystem — placar da partida: distância, velocidade, recorde, texto
 * central (IA/placar online), aviso da parede, linhas de velocidade e
 * overlay de debug (F3): FPS, ping, tick, jogadores, posição, velocidade,
 * estado, último input e idade do snapshot.
 * Desacoplado da simulação: recebe um HudInfo simples.
 */
import Phaser from 'phaser';
import { UI_TEXT, PPM, BASE_SPEED, WALL_WARN_DIST } from '../config/constants';

export interface HudNetDebug {
  ping: number;
  jitter: number;
  lossPct: number;
  snapshotRate: number;
  tick: number;
  players: number;
  lastSeq: number;
  snapAgeMs: number;
  inputDelayMs: number;
  rollbacks: number;
  predictionErrorPx: number;
  interpDelayMs: number;
  extrapolating: number;
}

export interface HudDebug {
  fps: number;
  obstacles: number;
  seed: number;
  hook: string;
  mult: number;
  timeBonus: number;
  posM: number;
  state: string;
  net?: HudNetDebug;
}

export interface HudInfo {
  distance: number; // m
  best: number; // m (0 = oculto)
  speedPx: number; // vx em px/s
  centerText?: string | null; // delta da IA / placar online
  centerColor?: string;
  wallGap: number; // px até a parede
  debug?: HudDebug;
}

export class HUD {
  private distText: Phaser.GameObjects.Text;
  private recordText: Phaser.GameObjects.Text;
  private speedText: Phaser.GameObjects.Text;
  private centerText: Phaser.GameObjects.Text;
  private noticeText: Phaser.GameObjects.Text;
  private debugText: Phaser.GameObjects.Text;
  private wallGlow: Phaser.GameObjects.Rectangle;
  debugVisible = false;

  private lines: Phaser.GameObjects.Rectangle[] = [];

  constructor(private scene: Phaser.Scene) {
    const style = (size: number) => ({
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      color: UI_TEXT,
    });
    this.distText = scene.add.text(24, 18, '0 m', style(34)).setScrollFactor(0).setDepth(100);
    this.recordText = scene.add
      .text(24, 60, '', { ...style(16), color: '#9aa5b1' })
      .setScrollFactor(0)
      .setDepth(100);
    this.speedText = scene.add
      .text(0, 18, '', style(24))
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.centerText = scene.add
      .text(0, 18, '', style(18))
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.noticeText = scene.add
      .text(0, 120, '', { ...style(30), color: '#ffd94d' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0);
    this.debugText = scene.add
      .text(24, 0, '', { ...style(14), color: '#7dd3a0' })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
    this.wallGlow = scene.add
      .rectangle(0, 0, 90, 4000, 0xff3b30, 0)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(95);
    for (let i = 0; i < 10; i++) {
      const r = scene.add
        .rectangle(Math.random() * scene.scale.width, 60 + Math.random() * 520, 90 + Math.random() * 140, 2, 0xffffff, 0.18)
        .setScrollFactor(0)
        .setDepth(90)
        .setAlpha(0);
      this.lines.push(r);
    }
  }

  update(dt: number, info: HudInfo): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.speedText.setX(w - 24);
    this.centerText.setX(w / 2);
    this.noticeText.setX(w / 2);
    this.debugText.setY(h - 268);
    this.wallGlow.setY(h / 2);

    this.distText.setText(`${Math.floor(info.distance)} m`);
    this.recordText.setText(info.best > 0 ? `Recorde: ${info.best} m` : '');
    const pct = Math.round((info.speedPx / BASE_SPEED) * 100);
    this.speedText.setText(`${(info.speedPx / PPM).toFixed(1)} m/s  ${pct}%`);
    this.centerText
      .setText(info.centerText ?? '')
      .setColor(info.centerColor ?? UI_TEXT);

    const danger = Phaser.Math.Clamp(1 - info.wallGap / WALL_WARN_DIST, 0, 1);
    this.wallGlow.setAlpha(danger * 0.45);

    const intensity = Phaser.Math.Clamp((info.speedPx / BASE_SPEED - 1.5) / 1.5, 0, 1);
    for (const l of this.lines) {
      l.setAlpha(intensity * 0.25);
      if (intensity > 0) {
        l.x -= info.speedPx * 2.2 * dt;
        if (l.x < -l.width) {
          l.x = w + Math.random() * 200;
          l.y = 60 + Math.random() * (h - 200);
        }
      }
    }

    this.debugText.setVisible(this.debugVisible && !!info.debug);
    if (this.debugVisible && info.debug) {
      const d = info.debug;
      const rows = [
        `FPS: ${d.fps.toFixed(0)}`,
        `vel: ${info.speedPx.toFixed(0)} px/s (${(info.speedPx / PPM).toFixed(1)} m/s)`,
        `mult: ${d.mult.toFixed(2)}x  bônus tempo: +${(d.timeBonus / PPM).toFixed(1)} m/s`,
        `estado: ${d.state}  gancho: ${d.hook}`,
        `parede: ${(info.wallGap / PPM).toFixed(1)} m atrás`,
        `obstáculos: ${d.obstacles}  seed: ${d.seed}`,
        `pos: ${d.posM.toFixed(0)} m`,
      ];
      if (d.net) {
        const n = d.net;
        rows.push(
          `ping: ${n.ping} ms  jitter: ${n.jitter} ms  perda: ${n.lossPct.toFixed(1)}%`,
          `tick servidor: ${n.tick}  snapshots: ${n.snapshotRate.toFixed(1)}/s  há ${n.snapAgeMs.toFixed(0)} ms`,
          `input→ack: ${n.inputDelayMs.toFixed(0)} ms  interp: ${n.interpDelayMs} ms  extrap: ${n.extrapolating}`,
          `rollbacks: ${n.rollbacks}  erro predição: ${n.predictionErrorPx.toFixed(1)} px`,
          `seq: ${n.lastSeq}  jogadores: ${n.players}`,
        );
      }
      this.debugText.setText(rows.join('\n'));
    }
  }

  notice(msg: string): void {
    this.noticeText.setText(msg).setAlpha(1);
    this.scene.tweens.add({ targets: this.noticeText, alpha: 0, delay: 1200, duration: 800 });
  }

  pulseSpeed(): void {
    this.scene.tweens.add({ targets: this.speedText, scale: { from: 1.25, to: 1 }, duration: 180 });
  }
}
