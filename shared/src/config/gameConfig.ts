/**
 * Configuração de GAMEPLAY compartilhada entre cliente e servidor.
 * Fonte única de verdade da física — NUNCA duplicar estes valores.
 * Tudo em pixels e segundos, salvo indicado.
 */

export const PPM = 32; // pixels por metro
export const GROUND_Y = 620; // y do topo do chão base
export const KILL_Y = GROUND_Y + 340; // abaixo disso o corredor é eliminado
export const START_X = 100; // x inicial dos corredores

export const GRAVITY = 2400; // px/s²
export const RUNNER_MASS = 1; // massa de referência da corda (abstrata)

// ---- Simulação (autoritativa no servidor; predição no cliente) ----
export const SIM_DT = 1 / 60; // passo fixo da simulação (60 ticks/s)
export const SIM_SUBSTEPS = 4; // sub-passos por tick (CCD-like, anti-túnel)
export const GEN_AHEAD = 2600; // gera mapa até esta distância à frente
export const CULL_BEHIND = 600; // recicla mapa atrás da parede

// ---- Velocidade (INFINITA: nunca há teto) ----
export const BASE_SPEED = 8 * PPM; // 8 m/s iniciais
export const SPEED_INCREASE_PER_SECOND = 0.12 * PPM; // ganho passivo por segundo
export const PERFECT_GAIN = 1.02; // +2% por obstáculo perfeito (sem limite)
export const HIT_PENALTY = 0.75; // mantém 75% do multiplicador ao bater
export const STUN_TIME = 0.3;
export const PHYS_MAX_SPEED_X = 12000; // teto físico de segurança
export const PHYS_MAX_SPEED_Y = 2600;

// ---- Pulo ----
export const JUMP_V = 860;
export const JUMP_CUT = 0.45; // corte ao soltar cedo (pulo curto)
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.12;
export const GRAVITY_RISE_MULT = 0.82; // sobe mais leve
export const GRAVITY_FALL_MULT = 1.22; // desce mais pesado

// ---- Momentum (estilo SpeedRunners) ----
export const MOVE_ACCELERATION = 1300; // aceleração no chão (px/s²)
export const AIR_ACCELERATION = 520; // aceleração no ar (menor)
export const GROUND_FRICTION = 340; // atrito acima da velocidade-alvo
export const CROUCH_ACCEL_MULT = 0.4;
export const STUN_ACCEL = 0.35;

// ---- Slide ----
export const SLIDE_FRICTION = 90; // atrito reduzido durante o slide
export const SLIDE_DURATION_MIN = 0.35;
export const SLIDE_DURATION_MAX = 2.2;
export const SLIDE_DUR_PER_SPEED = 0.7; // s por múltiplo de BASE_SPEED

// ---- Hitbox ----
export const BODY_W = 26;
export const BODY_H = 46;
export const CROUCH_H = 28;
export const STEP_UP_MAX = 14; // degrau raso que sobe sem penalidade

// ---- Gancho (projétil físico) ----
export const HOOK_SPEED = 2600; // velocidade da ponta (px/s)
export const HOOK_MAX_DISTANCE = 420; // alcance máximo
export const HOOK_TRAVEL_TIME = HOOK_MAX_DISTANCE / HOOK_SPEED;
export const HOOK_RETRACT_SPEED = 3900;
export const ROPE_MIN = 90;
export const ROPE_MAX = 400; // comprimento fixo após conectar
export const ROPE_DAMPING = 0.9995; // amortecimento tangencial por sub-passo
export const SWING_RELEASE_BOOST = 1.18; // impulso ao soltar num arco bom (empurrando pra frente)

// ---- Parede da morte ----
export const WALL_START_DISTANCE = 30 * PPM;
export const WALL_BASE_SPEED = BASE_SPEED * 0.92;
export const WALL_ACCELERATION = 3.2; // px/s²
export const WALL_MAX_GAP = 42 * PPM;
export const WALL_WIDTH = 90;
export const WALL_WARN_DIST = 12 * PPM;

// ---- Cores dos jogadores (indexadas por colorIdx nos snapshots) ----
export const COLORS = [
  0x4da6ff, // azul
  0xff5555, // vermelho
  0x5dde7a, // verde
  0xffd94d, // amarelo
  0xff7ad9, // rosa
  0xb07aff, // roxo
  0xff9c40, // laranja
];
