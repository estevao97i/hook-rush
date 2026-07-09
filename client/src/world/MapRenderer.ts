/**
 * MapRenderer — espelho VISUAL do MapModel compartilhado (que é puro).
 * Object pooling de retângulos; cria/recicla conforme os blocos e âncoras
 * entram/saem do modelo. Nenhuma física aqui — colisão vive na simulação.
 */
import Phaser from 'phaser';
import { MapModel } from '@hookrush/shared';
import { BLOCK_COLOR, BLOCK_EDGE, ANCHOR_COLOR } from '../config/constants';

interface AnchorVisual {
  ring: Phaser.GameObjects.Arc;
  dot: Phaser.GameObjects.Arc;
}

export class MapRenderer {
  private blockVisuals = new Map<number, Phaser.GameObjects.Rectangle>();
  private anchorVisuals = new Map<number, AnchorVisual>();
  private pool: Phaser.GameObjects.Rectangle[] = [];

  constructor(private scene: Phaser.Scene, private map: MapModel) {}

  /** Sincroniza visuais com o modelo (chamar 1x por frame). */
  sync(): void {
    const seen = new Set<number>();
    for (const b of this.map.blocks) {
      seen.add(b.id);
      if (!this.blockVisuals.has(b.id)) {
        let r = this.pool.pop();
        if (!r) {
          r = this.scene.add.rectangle(0, 0, 10, 10, BLOCK_COLOR).setStrokeStyle(2, BLOCK_EDGE);
          r.setDepth(1);
        }
        r.setActive(true).setVisible(true);
        r.setPosition(b.x + b.w / 2, b.y + b.h / 2);
        r.setSize(b.w, b.h);
        this.blockVisuals.set(b.id, r);
      }
    }
    for (const [id, r] of this.blockVisuals) {
      if (!seen.has(id)) {
        r.setActive(false).setVisible(false);
        this.pool.push(r);
        this.blockVisuals.delete(id);
      }
    }

    const seenA = new Set<number>();
    for (const a of this.map.anchors) {
      seenA.add(a.id);
      if (!this.anchorVisuals.has(a.id)) {
        const ring = this.scene.add.circle(a.x, a.y, 8).setStrokeStyle(3, ANCHOR_COLOR).setDepth(2);
        const dot = this.scene.add.circle(a.x, a.y, 2.5, ANCHOR_COLOR).setDepth(2);
        this.anchorVisuals.set(a.id, { ring, dot });
      }
    }
    for (const [id, v] of this.anchorVisuals) {
      if (!seenA.has(id)) {
        v.ring.destroy();
        v.dot.destroy();
        this.anchorVisuals.delete(id);
      }
    }
  }

  get blockCount(): number {
    return this.blockVisuals.size;
  }
}
