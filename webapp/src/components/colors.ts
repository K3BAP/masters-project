// Farbzuordnung der Steigungen (kategorial, konsistent in Zeichnung & Legende).

const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#86bcb6', '#d37295', '#fabfd2', '#b6992d', '#499894',
];

export const VERTICAL_COLOR = '#8a919c';

export function slopeColor(slope: number | 'inf', deltaEff: number): string {
  if (slope === 'inf') return VERTICAL_COLOR;
  const lo = -(Math.floor(deltaEff / 4) - 1);
  return PALETTE[(slope - lo + PALETTE.length * 4) % PALETTE.length];
}

// ---------------------------------------------------------------------
// Theorem 1: rationale Steigungsmenge S (k = 4*Deff*n^2, D3 = Deff-3):
// vertikal; horizontal; +-k/j (j=1..D3); flach j/D3 (j=1..D3-1).
// Farben ueber den Index in dieser kanonischen Aufzaehlung, damit
// Zeichnung und Legende konsistent eingefaerbt sind.
// ---------------------------------------------------------------------

export interface OneBendSlopeEntry {
  /** exakter Anzeige-Name, z.B. "k/2", "-k/1", "1/2", "0", "∞" */
  label: string;
  /** Steigung als Bruch dy/dx (dx = 0 fuer vertikal) */
  dy: number;
  dx: number;
  index: number;
}

/** Kanonische Aufzaehlung von S fuer Theorem 1. */
export function oneBendSlopeSet(deltaEff: number, k: number): OneBendSlopeEntry[] {
  const D3 = deltaEff - 3;
  const out: OneBendSlopeEntry[] = [];
  let i = 0;
  out.push({ label: '∞', dy: 1, dx: 0, index: i++ });
  out.push({ label: '0', dy: 0, dx: 1, index: i++ });
  for (let j = 1; j <= D3; j++) out.push({ label: `k/${j}`, dy: k, dx: j, index: i++ });
  for (let j = 1; j <= D3; j++) out.push({ label: `−k/${j}`, dy: -k, dx: j, index: i++ });
  for (let j = 1; j <= D3 - 1; j++) out.push({ label: `${j}/${D3}`, dy: j, dx: D3, index: i++ });
  return out;
}

/** Index eines Segments (dx, dy) in S; -1 falls nicht in S. */
export function oneBendSlopeIndex(dx: number, dy: number, deltaEff: number, k: number): number {
  const D3 = deltaEff - 3;
  if (dx === 0) return dy !== 0 ? 0 : -1;
  if (dy === 0) return 1;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const positive = dx > 0 === dy > 0;
  if (ay > ax) {
    const num = k * ax;
    if (num % ay !== 0) return -1;
    const j = num / ay;
    if (j < 1 || j > D3) return -1;
    return positive ? 2 + (j - 1) : 2 + D3 + (j - 1);
  }
  if (!positive) return -1;
  const num = ay * D3;
  if (num % ax !== 0) return -1;
  const j = num / ax;
  if (j < 1 || j > D3 - 1) return -1;
  return 2 + 2 * D3 + (j - 1);
}

export function oneBendSlopeColor(index: number): string {
  if (index === 0) return VERTICAL_COLOR;
  if (index < 0) return '#ffffff'; // nicht in S -- faellt im Bild sofort auf
  return PALETTE[(index - 1) % PALETTE.length];
}
