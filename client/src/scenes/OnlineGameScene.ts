/**
 * OnlineGameScene — corrida em rede.
 * Networking e renderização são camadas separadas:
 *  - NetworkClock: linha do tempo por TICK do servidor (imune a jitter);
 *  - PredictionSystem + ReconciliationSystem: local responde no frame,
 *    servidor confirma, correções suaves (nunca teleporta);
 *  - InterpolationSystem/SnapshotBuffer: remotos renderizam ~110 ms no
 *    passado entre snapshots reais, com extrapolação curta limitada;
 *  - parede: dead reckoning (velocidade estimada) + correção suave,
 *    sempre monotônica — nunca anda em saltos;
 *  - LatencyManager/RollbackManager: métricas completas no F3.
 */
import Phaser from 'phaser';
import {
  SIM_DT,
  BASE_SPEED,
  COLORS,
  PPM,
  GEN_AHEAD,
  CULL_BEHIND,
  HookPhase,
  GamePhase,
  ServerMsg,
  GameOverMessage,
  decodeFlags,
  INPUT_HEARTBEAT_TICKS,
  INTERPOLATION_DELAY_MS,
} from '@hookrush/shared';
import { UI_TEXT } from '../config/constants';
import { NetworkClient } from '../network/NetworkClient';
import { NetworkClock } from '../network/NetworkClock';
import { LatencyManager } from '../network/LatencyManager';
import { PredictionSystem } from '../network/PredictionSystem';
import { ReconciliationSystem } from '../network/ReconciliationSystem';
import { RollbackManager } from '../network/RollbackManager';
import { InterpolationSystem } from '../network/InterpolationSystem';
import { inputPacket } from '../network/PacketSerializer';
import { MapRenderer } from '../world/MapRenderer';
import { PlayerView, scratchView } from '../entities/PlayerView';
import { PlayerInput } from '../input/InputController';
import { ParticleFX } from '../fx/Particles';
import { HUD } from '../ui/HUD';
import { WallView, Parallax, drawHookHint } from '../systems/raceView';
import { AudioManager } from '../audio/AudioManager';

export class OnlineGameScene extends Phaser.Scene {
  private net!: NetworkClient;
  private clock!: NetworkClock;
  private latency!: LatencyManager;
  private pred!: PredictionSystem;
  private recon!: ReconciliationSystem;
  private rollback!: RollbackManager;
  private interp!: InterpolationSystem;

  private views = new Map<string, PlayerView>();
  private mapR!: MapRenderer;
  private wallView!: WallView;
  private parallax!: Parallax;
  private fxm!: ParticleFX;
  private hud!: HUD;
  private hintGfx!: Phaser.GameObjects.Graphics;
  private inputCtl!: PlayerInput;
  private countdownText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private kEsc!: Phaser.Input.Keyboard.Key;
  private kF3!: Phaser.Input.Keyboard.Key;

  private acc = 0;
  private lastSentBits = -1;
  private lastSentSeq = 0;
  // parede: dead reckoning
  private wallRenderX = 0;
  private wallSnapX = 0;
  private wallSnapAt = 0;
  private wallSpeedEst = 0;
  private localDeadNotified = false;

  constructor() {
    super('OnlineGame');
  }

  create(): void {
    this.net = this.registry.get('net') as NetworkClient;
    const room = this.net.room;
    if (!room) {
      this.scene.start('Lobby');
      return;
    }
    const st = room.state as any;
    const seed = st.seed as number;

    this.views = new Map();
    this.acc = 0;
    this.lastSentBits = -1;
    this.lastSentSeq = 0;
    this.localDeadNotified = false;

    // ---- sistemas de rede ----
    this.clock = new NetworkClock();
    this.latency = new LatencyManager();
    this.rollback = new RollbackManager();
    this.interp = new InterpolationSystem();
    const myNet = st.players.get(room.sessionId);
    this.pred = new PredictionSystem(seed, room.sessionId, myNet?.colorIdx ?? 0);
    this.recon = new ReconciliationSystem(this.pred, this.rollback);

    // ---- render ----
    this.parallax = new Parallax(this);
    this.fxm = new ParticleFX(this);
    this.hintGfx = this.add.graphics().setDepth(3);
    this.wallView = new WallView(this);
    this.wallRenderX = st.wallX;
    this.wallSnapX = st.wallX;
    this.wallSnapAt = performance.now();
    this.mapR = new MapRenderer(this, this.pred.world.map);
    st.players.forEach((p: any, id: string) => this.ensureView(id, p));

    const cam = this.cameras.main;
    cam.startFollow(this.views.get(room.sessionId)!.follow, false, 0.14, 0.08);
    cam.setFollowOffset(-160, 80);

    const d = this.sys.game.device;
    const isMobile = d.os.android || d.os.iOS || d.os.iPad || (d.input.touch && !d.os.desktop);
    this.inputCtl = new PlayerInput(this, isMobile, () => this.leaveToLobby());
    this.hud = new HUD(this);

    this.countdownText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 80, '', {
        fontFamily: 'monospace',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#ffd94d',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(150);
    this.resultText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: UI_TEXT,
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(150);

    // listeners de sala acumulam entre corridas (a cena recria, a sala não):
    // registra com referência e REMOVE no shutdown — sem isso, cada rematch
    // duplicaria reconciliações e métricas
    const onState = () => this.onSnapshot();
    const onLeave = () => this.scene.start('Menu');
    room.onStateChange(onState);
    room.onMessage(ServerMsg.GameOver, (m: GameOverMessage) => this.showResults(m));
    room.onLeave(onLeave);
    this.events.once('shutdown', () => {
      try {
        (room.onStateChange as any).remove?.(onState);
        (room.onLeave as any).remove?.(onLeave);
      } catch {
        /* sala já fechada */
      }
    });

    const kb = this.input.keyboard!;
    kb.addCapture('ESC,F3');
    this.kEsc = kb.addKey('ESC');
    this.kF3 = kb.addKey('F3');
  }

  private ensureView(id: string, p: any): void {
    if (this.views.has(id)) return;
    const isLocal = id === this.net.sessionId;
    const view = new PlayerView(this, COLORS[p.colorIdx] ?? 0xffffff, isLocal, isLocal ? undefined : p.name);
    this.views.set(id, view);
  }

  // ---------- camada de rede (nunca desenha nada) ----------

  private onSnapshot(): void {
    const room = this.net.room;
    if (!room) return;
    const st = room.state as any;
    const now = performance.now();

    this.clock.onSnapshot(st.tick, now, this.net.rtt);
    this.latency.onSnapshot(now);
    this.latency.onPong(this.net.rtt);

    const tickMs = NetworkClock.tickToMs(st.tick);
    st.players.forEach((p: any, id: string) => {
      this.ensureView(id, p);
      if (id === room.sessionId) {
        this.recon.apply(p); // rollback + replay + correção suave
        const sentAt = this.pred.sentAt(p.lastSeq);
        if (sentAt > 0) this.latency.noteInputDelay(now - sentAt);
      } else {
        this.interp.push(id, tickMs, p);
      }
    });
    for (const [id, view] of this.views) {
      if (!st.players.get(id)) {
        view.destroy();
        this.views.delete(id);
        this.interp.remove(id);
      }
    }

    // parede: estima a velocidade real entre snapshots (dead reckoning)
    const dtMs = now - this.wallSnapAt;
    if (dtMs > 1 && st.wallX > this.wallSnapX) {
      const inst = ((st.wallX - this.wallSnapX) / dtMs) * 1000;
      this.wallSpeedEst += (inst - this.wallSpeedEst) * 0.3;
    }
    this.wallSnapX = st.wallX;
    this.wallSnapAt = now;
  }

  // ---------- camada de render (nunca fala com a rede) ----------

  update(_t: number, delta: number): void {
    const room = this.net.room;
    if (!room) return;
    const st = room.state as any;
    const dt = Math.min(delta / 1000, 0.05);
    const now = performance.now();
    const JD = Phaser.Input.Keyboard.JustDown;
    if (JD(this.kEsc)) this.leaveToLobby();
    if (JD(this.kF3)) this.hud.debugVisible = !this.hud.debugVisible;

    if (st.phase === GamePhase.Lobby) {
      this.scene.start('Lobby');
      return;
    }
    this.countdownText.setText(st.phase === GamePhase.Countdown ? `${Math.ceil(st.countdown)}` : '');

    const core = this.pred.core;
    const au = AudioManager.get();
    this.interp.beginFrame();

    // ---- predição local: passo fixo 60 Hz + envio de inputs ----
    if (st.phase === GamePhase.Racing && core.alive) {
      this.acc += dt;
      while (this.acc >= SIM_DT) {
        this.acc -= SIM_DT;
        const bits = this.inputCtl.readBits();
        this.handleLocalEvents(this.pred.step(bits, performance.now()));
        if (bits !== this.lastSentBits || this.pred.seq - this.lastSentSeq >= INPUT_HEARTBEAT_TICKS) {
          this.net.sendInput(inputPacket(this.pred.seq, bits, performance.now()));
          this.lastSentBits = bits;
          this.lastSentSeq = this.pred.seq;
        }
      }
      this.pred.decayError(dt);
    }
    const alpha = Phaser.Math.Clamp(this.acc / SIM_DT, 0, 1);

    // ---- local: pose interpolada entre passos + offset de erro suave ----
    scratchView.x = this.pred.renderX(alpha);
    scratchView.y = this.pred.renderY(alpha);
    scratchView.vx = core.vx;
    scratchView.grounded = core.grounded;
    scratchView.crouched = core.crouched;
    scratchView.stunned = core.stunT > 0;
    scratchView.alive = core.alive;
    scratchView.hookPhase = core.hook.phase;
    scratchView.hookTipX = this.pred.renderTipX(alpha);
    scratchView.hookTipY = this.pred.renderTipY(alpha);
    this.views.get(room.sessionId)?.update(scratchView, dt, () => au.step());

    // ---- remotos: interpolação no relógio de tick (~110 ms no passado) ----
    const renderMs = this.clock.serverNowMs(now) - INTERPOLATION_DELAY_MS;
    for (const [id, view] of this.views) {
      if (id === room.sessionId) continue;
      const s = this.interp.sample(id, renderMs, dt);
      if (!s) continue;
      const f = decodeFlags(s.flags);
      scratchView.x = s.x;
      scratchView.y = s.y;
      scratchView.vx = s.vx;
      scratchView.grounded = f.grounded;
      scratchView.crouched = f.crouched;
      scratchView.stunned = f.stunT > 0;
      scratchView.alive = f.alive;
      scratchView.hookPhase = s.hookPhase;
      scratchView.hookTipX = s.hookX;
      scratchView.hookTipY = s.hookY;
      view.update(scratchView, dt);
    }

    // ---- parede: avanço previsto + correção suave, sempre monotônica ----
    const wallTarget = this.wallSnapX + (this.wallSpeedEst * (now - this.wallSnapAt)) / 1000;
    const wallNext = this.wallRenderX + this.wallSpeedEst * dt + (wallTarget - this.wallRenderX) * Math.min(1, 4 * dt);
    this.wallRenderX = Math.max(this.wallRenderX, wallNext); // nunca recua
    this.wallView.update(this.wallRenderX);

    // ---- mapa/câmera/cenário ----
    const camRight = this.cameras.main.scrollX + this.scale.width;
    this.pred.world.map.ensure(camRight + GEN_AHEAD);
    this.pred.world.map.cull(Math.min(this.wallRenderX, st.wallX) - CULL_BEHIND);
    this.mapR.sync();
    this.parallax.update(this.cameras.main, this.scale.width);

    const cam = this.cameras.main;
    const vx = core.vx;
    const lookAhead = Phaser.Math.Clamp(vx * 0.45, 120, this.scale.width * 0.32);
    cam.followOffset.x += (-lookAhead - cam.followOffset.x) * Math.min(1, 3 * dt);
    const targetZoom = Phaser.Math.Clamp(1.04 - (vx / BASE_SPEED - 1) * 0.05, 0.8, 1.04);
    cam.setZoom(cam.zoom + (targetZoom - cam.zoom) * Math.min(1, 2 * dt));

    if (!core.alive) {
      if (!this.localDeadNotified) {
        this.localDeadNotified = true;
        this.hud.notice('Você foi eliminado! Espectando...');
        au.fall();
      }
      this.spectateLeader(st);
    }

    if (core.alive && core.hook.phase === HookPhase.Idle && st.phase === GamePhase.Racing) {
      drawHookHint(this.hintGfx, this.pred.world.map, core.x, core.y - 23, this.time.now);
    } else this.hintGfx.clear();

    this.hud.update(dt, {
      distance: core.distance,
      best: 0,
      speedPx: vx,
      centerText: this.leaderboard(st),
      wallGap: core.x - this.wallRenderX,
      debug: {
        fps: this.game.loop.actualFps,
        obstacles: this.pred.world.map.blocks.length,
        seed: st.seed,
        hook: HookPhase[core.hook.phase],
        mult: core.mult,
        timeBonus: core.timeBonus,
        posM: core.x / PPM,
        state: core.alive ? (core.grounded ? 'chão' : 'ar') : 'morto',
        net: {
          ping: Math.round(this.latency.ping),
          jitter: Math.round(this.latency.jitter),
          lossPct: this.latency.lossPct,
          snapshotRate: this.latency.snapshotRate,
          tick: st.tick,
          players: this.views.size,
          lastSeq: this.pred.seq,
          snapAgeMs: now - this.latency.lastSnapshotAt,
          inputDelayMs: this.latency.inputDelayMs,
          rollbacks: this.rollback.rollbacks,
          predictionErrorPx: this.rollback.lastErrorPx,
          interpDelayMs: INTERPOLATION_DELAY_MS,
          extrapolating: this.interp.extrapolating,
        },
      },
    });
  }

  private handleLocalEvents(events: ReturnType<PredictionSystem['step']>): void {
    const au = AudioManager.get();
    const cam = this.cameras.main;
    for (const e of events) {
      switch (e.type) {
        case 'jump':
          this.fxm.dustBurst(e.x, e.y, 5);
          au.jump();
          break;
        case 'land':
          if ((e.v ?? 0) > 420) this.fxm.dustBurst(e.x, e.y, 8);
          break;
        case 'hit':
          this.fxm.sparkBurst(e.x, e.y);
          cam.shake(120, 0.005);
          au.impact();
          break;
        case 'perfect':
          au.perfect();
          this.hud.pulseSpeed();
          break;
        case 'throw':
          au.throwHook();
          break;
        case 'attach':
          au.attach();
          break;
        case 'release':
          au.release(e.v === 1);
          break;
      }
    }
  }

  private leaderboard(st: any): string {
    const rows: Array<{ name: string; dist: number; alive: boolean; me: boolean }> = [];
    st.players.forEach((p: any, id: string) => {
      rows.push({
        name: p.name,
        dist: id === this.net.sessionId ? this.pred.core.distance : p.distance,
        alive: (p.flags & 1) !== 0,
        me: id === this.net.sessionId,
      });
    });
    rows.sort((a, b) => b.dist - a.dist);
    return rows
      .map((r, i) => `${i + 1}º ${r.me ? 'Você' : r.name} ${Math.floor(r.dist)}m${r.alive ? '' : ' ✝'}`)
      .join('   ');
  }

  private spectateLeader(st: any): void {
    let bestId = '';
    let bestX = -Infinity;
    st.players.forEach((p: any, id: string) => {
      if ((p.flags & 1) !== 0 && p.x > bestX) {
        bestX = p.x;
        bestId = id;
      }
    });
    const view = bestId ? this.views.get(bestId) : null;
    if (view) this.cameras.main.startFollow(view.follow, false, 0.1, 0.08);
  }

  private showResults(m: GameOverMessage): void {
    const lines = [
      m.winnerId === this.net.sessionId ? '🏆 VOCÊ VENCEU!' : `🏆 ${m.winnerName} venceu!`,
      '',
      ...m.distances.map(
        (d, i) => `${i + 1}º ${d.id === this.net.sessionId ? 'Você' : d.name} — ${d.distance} m`,
      ),
      '',
      'Voltando ao lobby...',
    ];
    this.resultText.setText(lines.join('\n'));
    if (m.winnerId === this.net.sessionId) AudioManager.get().record();
  }

  private leaveToLobby(): void {
    this.net.leave();
    this.scene.start('Lobby');
  }
}
