const LOAD = process.hrtime();
const ZERO = Date.now();

export function micros(): number {
  const hd = process.hrtime(LOAD);
  const now = (ZERO + hd[0] * 1000) * 1000 + Math.floor(hd[1] / 1000);
  return now;
}

export function time(): [number, number] {
  return process.hrtime();
}

export function span(start: [number, number], offset?: number): string {
  const lapse = process.hrtime(start);
  const ms = (lapse[0] * 1000) + Math.floor(lapse[1] / 1000000) - (offset || 0);
  const ns = Math.floor((lapse[1] % 1000000) / 1000) / 1000;
  return `${ms}${ns.toFixed(3).substring(1)}`;
}
