import type { DrawingResult } from '../algorithm/types';

export function StatsPanel({ result }: { result: DrawingResult }) {
  const s = result.stats;
  return (
    <div className="stats">
      <div className={result.verified ? 'badge pass' : 'badge fail'}>
        {result.verified ? 'VERIFIKATION: PASS' : 'VERIFIKATION: FAIL'}
      </div>
      <table>
        <tbody>
          <tr><td>Knoten / Kanten</td><td>{s.n} / {s.m}{s.augmented ? ' (inkl. Hilfskanten)' : ''}</td></tr>
          <tr><td>Maxgrad Δ / Δ_eff</td><td>{s.deltaOrig} / {s.deltaEff}</td></tr>
          <tr>
            <td>Steigungen</td>
            <td>{s.slopesUsed} benutzt, Schranke ⌈Δ/2⌉{s.augmented || s.bumped ? '+1' : ''} = {s.slopesAllowedStrict}</td>
          </tr>
          <tr><td>Gitter (B × H)</td><td>{s.width} × {s.height}</td></tr>
          <tr><td>Zeilenabstand R</td><td>{s.rowSpacing}</td></tr>
          <tr>
            <td>Augmentierung</td>
            <td>
              {s.augmented ? 'ja (Bikonnektivität)' : 'nein'}
              {s.bumped ? ' · Regularitäts-/Quellen-Bump (+1 Steigung)' : ''}
            </td>
          </tr>
        </tbody>
      </table>
      <details>
        <summary>Verifikationsbericht</summary>
        <pre>{result.report}</pre>
      </details>
    </div>
  );
}
