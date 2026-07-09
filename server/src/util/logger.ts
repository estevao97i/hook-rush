/**
 * Logger mínimo do servidor — eventos relevantes, sem excesso.
 */
export function log(...args: unknown[]): void {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}]`, ...args);
}
