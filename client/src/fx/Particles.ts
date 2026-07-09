/**
 * Efeitos de partícula (poeira, faíscas, trail) usando emitters do Phaser
 * com a textura gerada 'px' — emitters reutilizam partículas internamente
 * (pooling nativo, sem alocação por frame).
 */
import Phaser from 'phaser';

export class ParticleFX {
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    this.dust = scene.add
      .particles(0, 0, 'px', {
        speed: { min: 20, max: 90 },
        angle: { min: 200, max: 340 },
        gravityY: 600,
        scale: { start: 1.6, end: 0 },
        lifespan: { min: 180, max: 380 },
        tint: 0x9aa5b1,
        emitting: false,
      })
      .setDepth(4);

    this.sparks = scene.add
      .particles(0, 0, 'px', {
        speed: { min: 120, max: 320 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.4, end: 0 },
        lifespan: { min: 120, max: 300 },
        tint: [0xffd94d, 0xff9c40, 0xffffff],
        emitting: false,
      })
      .setDepth(4);
  }

  dustBurst(x: number, y: number, n = 6): void {
    this.dust.explode(n, x, y);
  }

  sparkBurst(x: number, y: number): void {
    this.sparks.explode(14, x, y);
  }

  /** Trail que segue um corredor — ligado/desligado conforme a velocidade. */
  makeTrail(target: Phaser.GameObjects.GameObject, color: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const em = this.scene.add
      .particles(0, 0, 'px', {
        speed: 8,
        scale: { start: 1.3, end: 0 },
        lifespan: 260,
        frequency: 22,
        tint: color,
        alpha: { start: 0.7, end: 0 },
        emitting: false,
      })
      .setDepth(4);
    em.startFollow(target as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, 0, 4);
    return em;
  }
}
