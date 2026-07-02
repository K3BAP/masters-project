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
