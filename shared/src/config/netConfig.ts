/**
 * Configuração de REDE compartilhada entre cliente e servidor.
 * Simulação (60 Hz), snapshots (20/s) e render (livre) são independentes.
 */

// ---- taxas ----
export const TICK_RATE = 60; // ticks de simulação por segundo (servidor)
export const SERVER_TICK_RATE = TICK_RATE; // alias semântico
export const SNAPSHOT_RATE = 20; // snapshots por segundo (nunca 60!)
export const MAX_PLAYERS = 4;
export const DEFAULT_PORT = 2567;
export const ROOM_NAME = 'hookrush';

// ---- salas ----
export const ROOM_CODE_LENGTH = 5; // ex.: A8JKP
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
export const COUNTDOWN_SECONDS = 3;
export const RESULTS_SECONDS = 8;
export const RECONNECT_SECONDS = 15;

// ---- inputs ----
export const INPUT_HEARTBEAT_TICKS = 6; // reenvia mesmo sem mudança

// ---- sincronização do cliente (netcode) ----
/** Remotos renderizam este tanto "no passado" — interpolação sempre entre
 *  dois snapshots reais, nunca no dado mais recente. */
export const INTERPOLATION_DELAY_MS = 110;
/** Extrapolação máxima quando um snapshot atrasa (depois disso, segura). */
export const MAX_EXTRAPOLATION_MS = 120;
/** Velocidade de consumo do erro de posição (1/s) — correção invisível. */
export const POSITION_SMOOTH_FACTOR = 12;
/** Idem para corda/ângulos (a ponta pode corrigir um pouco mais rápido). */
export const ROTATION_SMOOTH_FACTOR = 16;
/** Snapshots retidos por jogador (ring buffer pooled). */
export const NETWORK_BUFFER_SIZE = 32;
/** Janela máxima de replay na reconciliação (atrasos além disso: aceita o
 *  servidor e deixa o offset suave absorver). Dimensionada para ~200 ms de
 *  ping + intervalo de snapshot com folga. */
export const MAX_PREDICTION_TIME_MS = 400;
/** Relógio de rede: fator de ajuste por snapshot e limite para resync duro. */
export const CLOCK_DRIFT_FACTOR = 0.05;
export const CLOCK_SNAP_MS = 250;
/** Intervalo entre snapshots acima de fator×esperado conta como "perda"
 *  (em WebSocket/TCP não há perda real — mede atraso/coalescência). */
export const SNAPSHOT_LATE_FACTOR = 1.6;
/** Erro de predição (px) acima disso conta como rollback no debug. */
export const ROLLBACK_ERROR_THRESHOLD = 2;
