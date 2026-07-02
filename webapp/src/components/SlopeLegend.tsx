import { slopeSet } from '../algorithm/router';
import { slopeColor, VERTICAL_COLOR } from './colors';

/** Port-Faecher: die Steigungsmenge S als Strahlen mit Farblegende. */
export function SlopeLegend({ deltaEff }: { deltaEff: number }) {
  const slopes = slopeSet(deltaEff);
  const size = 170, c = size / 2, r = size / 2 - 24;

  const ray = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    return { x: c + (dx / len) * r, y: c + (dy / len) * r };
  };

  return (
    <div className="legend">
      <h3>Steigungsmenge S ({slopes.length + 1} Steigungen)</h3>
      <svg viewBox={`0 0 ${size} ${size}`}>
        {slopes.map((s) => {
          const a = ray(1, -s), b = ray(-1, s);
          return (
            <g key={s}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={slopeColor(s, deltaEff)} />
              <text x={a.x + (a.x - c) * 0.22} y={a.y + (a.y - c) * 0.22 + 4} textAnchor="middle">
                {s}
              </text>
            </g>
          );
        })}
        <line x1={c} y1={c - r} x2={c} y2={c + r} stroke={VERTICAL_COLOR} />
        <text x={c} y={c - r - 6} textAnchor="middle">∞</text>
        <circle cx={c} cy={c} r={3.5} fill="#e8eaed" />
      </svg>
    </div>
  );
}
