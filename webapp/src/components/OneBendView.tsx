import { useMemo, useRef, useState } from 'react';
import type { Point } from '../algorithm/types';
import type { OneBendResult } from '../algorithm/onebend/types';
import { useI18n } from '../i18n';
import { oneBendSlopeColor, oneBendSlopeIndex } from './colors';
import { usePanZoom } from './usePanZoom';

interface Props {
  result: OneBendResult;
  /** 1..S = Snapshots; S+1 = Schritt "Fertig" (ohne Hervorhebungen). */
  step: number;
  selected: number | null;
  onSelect: (v: number | null) => void;
}

/**
 * SVG-Ergebnisansicht fuer Theorem 1 (Snapshot-basiert): Streckungen
 * verschieben bereits platzierte Knoten, deshalb rendert jeder Schritt
 * den vollstaendigen Zwischenstand seines Snapshots.
 *
 * Modi wie bei Theorem 4: kompakt (y anisotrop gestaucht -- linear,
 * Parallelitaet und Kreuzungsfreiheit bleiben erhalten) oder
 * massstabsgetreu. Theorem-1-Zeichnungen sind O(Δn³) hoch und O(Δn²)
 * breit; ohne Stauchung sind sie praktisch nicht ueberschaubar.
 */
export function OneBendView({ result, step, selected, onSelect }: Props) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const [compact, setCompact] = useState(true);
  const [showAug, setShowAug] = useState(true);
  const { tf, reset, movedRef, handlers } = usePanZoom(svgRef);

  const S = result.snapshots.length;
  const snap = step >= 1 && step <= S ? result.snapshots[step - 1] : null;

  const scene = useMemo(() => {
    const CELL = 24;
    const width = Math.max(1, result.stats.width);
    const height = Math.max(1, result.stats.height);
    const yScale = compact ? Math.min(CELL, (width * CELL * 1.6) / height) : CELL;
    const mx = (x: number) => x * CELL;
    const mapY = (y: number) => -y * yScale;

    const pos: Array<Point | null> = snap ? snap.pos : result.pos;
    const polylines: Array<Point[] | null> = snap ? snap.polylines : result.polylines;
    const hlEdges = new Set(snap ? snap.newEdges : []);
    const hlNodes = new Set(snap ? snap.newNodes : []);

    interface Seg { x1: number; y1: number; x2: number; y2: number; color: string; aug: boolean; edge: number }
    const segs: Seg[] = [];
    polylines.forEach((pl, e) => {
      if (!pl) return;
      if (result.edges[e].aug && !showAug) return;
      for (let j = 0; j + 1 < pl.length; j++) {
        const a = pl[j], b = pl[j + 1];
        const idx = oneBendSlopeIndex(b.x - a.x, b.y - a.y, result.stats.deltaEff, result.stats.k);
        segs.push({
          x1: mx(a.x), y1: mapY(a.y), x2: mx(b.x), y2: mapY(b.y),
          color: oneBendSlopeColor(idx), aug: result.edges[e].aug, edge: e,
        });
      }
    });

    const nodes = pos
      .map((p, v) => (p ? { v, x: mx(p.x), y: mapY(p.y), part: result.part[v] } : null))
      .filter((nd): nd is NonNullable<typeof nd> => nd !== null);

    // Zeilen-Hilfslinien an den (wenigen) Knotenzeilen
    const rowYs = [...new Set(pos.filter((p): p is Point => p !== null).map((p) => p.y))]
      .sort((a, b) => a - b);
    const rows = rowYs.map((y) => ({ y: mapY(y), label: y }));

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const ext = (x: number, y: number) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };
    segs.forEach((s) => { ext(s.x1, s.y1); ext(s.x2, s.y2); });
    nodes.forEach((nd) => ext(nd.x, nd.y));
    if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

    const pad = 40;
    return {
      segs, nodes, rows, hlEdges, hlNodes,
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`,
    };
  }, [result, snap, compact, showAug]);

  const onBackgroundClick = () => {
    if (!movedRef.current) onSelect(null);
  };

  // Zum ausgewaehlten Knoten inzidente Kanten
  const incident = useMemo(() => {
    const s = new Set<number>();
    if (selected !== null) {
      result.edges.forEach((e, idx) => {
        if (e.u === selected || e.v === selected) s.add(idx);
      });
    }
    return s;
  }, [result, selected]);

  return (
    <div className="drawing">
      <div className="drawing-toolbar">
        <label>
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          {t('view_compact')}
        </label>
        <label>
          <input type="checkbox" checked={showAug} onChange={(e) => setShowAug(e.target.checked)} />
          {t('view_aug')}
        </label>
        <div className="spacer" />
        <button onClick={reset}>{t('view_reset')}</button>
      </div>
      <svg
        ref={svgRef}
        className="drawing-canvas"
        viewBox={scene.viewBox}
        {...handlers}
        onClick={onBackgroundClick}
      >
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          {scene.rows.map((r) => (
            <line key={'row' + r.label} x1={-4000} x2={8000} y1={r.y} y2={r.y} className="row-guide" />
          ))}
          {/* Halo-Unterlagen: neue Kanten des Schritts (orange) und zum
              ausgewaehlten Knoten inzidente Kanten (blau). */}
          {scene.segs
            .filter((s) => scene.hlEdges.has(s.edge) || incident.has(s.edge))
            .map((s, i) => (
              <line
                key={'halo' + i}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                className={'halo' + (incident.has(s.edge) ? ' selected' : ' median')}
              />
            ))}
          {scene.segs.map((s, i) => (
            <line
              key={'seg' + i}
              x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke={s.color}
              className={
                'seg' + (s.aug ? ' aug' : '') +
                (selected !== null && !incident.has(s.edge) ? ' dim' : '')
              }
            />
          ))}
          {scene.nodes.map((nd) => (
            <g
              key={nd.v}
              className={
                'vertex' + (scene.hlNodes.has(nd.v) ? ' current' : '') +
                (nd.v === selected ? ' selected' : '')
              }
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(nd.v === selected ? null : nd.v);
              }}
            >
              <circle cx={nd.x} cy={nd.y} r={7} />
              <text x={nd.x} y={nd.y - 11} textAnchor="middle">
                {nd.v} (P{nd.part})
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
