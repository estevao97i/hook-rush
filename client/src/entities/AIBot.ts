/**
 * IA local (modo offline vs IA) — produz os MESMOS InputBits de um jogador
 * humano, lendo apenas o que estaria visível na tela (action hints dos
 * padrões do MapModel compartilhado). Reação/jitter/erros por dificuldade.
 * Sem trapaça: ela não toca na física, só "aperta botões".
 */
import { MapModel, PlayerCore, HookPhase, InputBits, SIM_DT } from '@hookrush/shared';
import { AIDiff } from '../core/SaveSystem';

interface ActionPlan {
  off: number; // erro de timing (s)
  skip: boolean; // "não viu"
  done: boolean;
}

const PARAMS: Record<AIDiff, { jitter: number; mistake: number; lead: number }> = {
  easy: { jitter: 0.1, mistake: 0.16, lead: 0.02 },
  medium: { jitter: 0.06, mistake: 0.08, lead: 0.01 },
  hard: { jitter: 0.035, mistake: 0.03, lead: 0 },
  insane: { jitter: 0.015, mistake: 0.006, lead: 0 },
};

export class AIBot {
  private plans = new Map<string, ActionPlan>();
  private jumpHoldT = 0;
  private crouchUntilX = -1;
  private holdingHook = false;
  private hookPulse = 0; // solta o bit por 1 tick para gerar nova borda
  private hookRetryT = 0;
  private hookRetries = 0;

  constructor(
    private core: PlayerCore,
    private map: MapModel,
    private diff: AIDiff,
  ) {}

  readBits(): number {
    const c = this.core;
    if (!c.alive) return 0;
    const prm = PARAMS[this.diff];
    let bits = 0;
    const x = c.x;
    const vx = Math.max(c.vx, 80);

    this.jumpHoldT = Math.max(0, this.jumpHoldT - SIM_DT);
    if (this.jumpHoldT > 0) bits |= InputBits.Jump;
    if (x < this.crouchUntilX) bits |= InputBits.Slide;

    // só reage ao que caberia na tela à frente (sem trapacear)
    const look = Math.min(1200, Math.max(500, vx * 1.5));
    for (const pat of this.map.patternsInRange(x, x + look)) {
      for (let i = 0; i < pat.actions.length; i++) {
        const a = pat.actions[i];
        const key = `${pat.id}:${i}`;
        let plan = this.plans.get(key);
        if (!plan) {
          plan = this.makePlan(prm.jitter, prm.mistake);
          this.plans.set(key, plan);
        }
        if (plan.skip || plan.done) continue;
        const lead = Math.max(0, (a.lead ?? 0.05) + prm.lead - plan.off);
        if (x >= a.x - vx * lead) {
          plan.done = true;
          if (a.kind === 'jump') {
            this.jumpHoldT = Math.max(0.06, (a.hold ?? 0.15) + plan.off * 0.5);
            bits |= InputBits.Jump;
          } else if (a.kind === 'crouch') {
            this.crouchUntilX = a.x + (a.hold ?? 60);
            bits |= InputBits.Slide;
          } else if (a.kind === 'hook') {
            this.holdingHook = true;
            this.hookRetryT = 0.18;
            this.hookRetries = 3;
          }
        }
      }
    }

    // soltar no timing certo: simplesmente PARA de segurar o botão
    if (c.hook.phase === HookPhase.Attached) {
      if ((c.vy < -30 && x > c.hook.ax) || c.hook.time > 2.4) this.holdingHook = false;
    } else if (this.holdingHook && c.hook.phase === HookPhase.Idle) {
      // disparo falhou: re-pressiona (borda nova) algumas vezes
      this.hookRetryT -= SIM_DT;
      if (this.hookRetryT <= 0) {
        if (this.hookRetries > 0) {
          this.hookRetries--;
          this.hookPulse = 1; // 1 tick sem o bit → nova borda no próximo
          this.hookRetryT = 0.15;
        } else this.holdingHook = false;
      }
    }

    // emergência: caindo num buraco sem plano → gancho
    if (c.hook.phase === HookPhase.Idle && c.vy > 260 && this.map.isOverGap(x) && !this.holdingHook) {
      this.holdingHook = true;
      this.hookRetryT = 0.18;
      this.hookRetries = 2;
    }

    if (this.holdingHook) {
      if (this.hookPulse > 0) this.hookPulse--;
      else bits |= InputBits.Hook;
    }

    if (this.plans.size > 400) this.plans.clear();
    return bits;
  }

  private makePlan(jitter: number, mistake: number): ActionPlan {
    const off = (Math.random() + Math.random() - 1) * jitter;
    const roll = Math.random();
    return {
      off: roll < mistake ? off + 0.12 : off,
      skip: roll < mistake * 0.25,
      done: false,
    };
  }
}
