import { useI18n } from '../i18n';
import { oneBendSlopeColor, oneBendSlopeSet } from './colors';

/**
 * Steigungsmenge S von Theorem 1 als Faecher. Die steilen Steigungen
 * +-k/j liegen in Wahrheit fast senkrecht (k = 4Δn²); fuer die Anzeige
 * werden sie schematisch zwischen 54° und 84° gespreizt. Die flachen
 * Steigungen j/(Δ−3) < 1 werden winkeltreu gezeichnet.
 */
export function OneBendLegend({ deltaEff, k }: { deltaEff: number; k: number }) {
  const { t } = useI18n();
  const entries = oneBendSlopeSet(deltaEff, k);
  const D3 = deltaEff - 3;
  const size = 190, c = size / 2, r = size / 2 - 26;

  // Anzeige-Winkel (Grad) je Eintrag
  const angleOf = (e: { dy: number; dx: number; label: string }): number => {
    if (e.dx === 0) return 90;
    if (e.dy === 0) return 0;
    const ay = Math.abs(e.dy);
    if (ay > Math.abs(e.dx)) {
      // steil (Betrag k/j): schematisch, j = dx
      const j = Math.abs(e.dx);
      const a = 84 - ((j - 1) * 30) / Math.max(1, D3 - 1);
      return e.dy > 0 === e.dx > 0 ? a : 180 - a;
    }
    return (Math.atan2(e.dy, e.dx) * 180) / Math.PI; // flach: winkeltreu
  };

  const showLabels = entries.length <= 13;

  return (
    <div className="legend">
      <h3>{t('ob_legend_title', { n: entries.length })}</h3>
      <svg viewBox={`0 0 ${size} ${size}`}>
        {entries.map((e) => {
          const a = (angleOf(e) * Math.PI) / 180;
          const x1 = c + r * Math.cos(a), y1 = c - r * Math.sin(a);
          const x2 = c - r * Math.cos(a), y2 = c + r * Math.sin(a);
          const label = showLabels || e.dx === 0 || e.dy === 0 ||
            Math.abs(e.dx) === 1 || Math.abs(e.dx) === D3;
          return (
            <g key={e.index}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={oneBendSlopeColor(e.index)} />
              {label && (
                <text x={c + (r + 13) * Math.cos(a)} y={c - (r + 13) * Math.sin(a) + 4}
                      textAnchor="middle">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        <circle cx={c} cy={c} r={3.5} fill="#e8eaed" />
      </svg>
    </div>
  );
}
