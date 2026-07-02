import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawingResult, Point } from '../algorithm/types';
import { slopeColor } from './colors';
import { svgPoint } from './svgUtils';

interface Props {
  result: DrawingResult;
  step: number; // 1..n; n = komplette Zeichnung
  selected: number | null;
  onSelect: (v: number | null) => void;
}

/**
 * SVG-Ergebnisansicht mit Pan/Zoom.
 *
 * Modi:
 *  - kompakt: y-Achse gleichmaessig gestaucht (anisotrope Skalierung).
 *    Parallelitaet und Kreuzungsfreiheit bleiben dabei erhalten, nur der
 *    Betrag der Steigungen erscheint verkleinert.
 *  - massstabsgetreu: isotropes Gitter (wahre Steigungen).
 */
export function DrawingView({ result, step, selected, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [compact, setCompact] = useState(true);
  const [showAug, setShowAug] = useState(true);
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  // Klick vs. Pan unterscheiden: erst ab 4px Bewegung gilt es als Drag
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const n = result.stats.n;
  const R = result.stats.rowSpacing;
  const ev = step >= 1 && step <= result.trace.length ? result.trace[step - 1] : null;

  const scene = useMemo(() => {
    // Skalierung: x-Zelle fest; y so, dass die Gesamthoehe handhabbar bleibt
    const CELL = 24;
    const width = Math.max(1, result.stats.width);
    const height = Math.max(1, result.stats.height);
    const yScale = compact ? Math.min(CELL, (width * CELL * 1.6) / height) : CELL;
    const mx = (x: number) => x * CELL;
    // kompakt: y anisotrop gestaucht; massstabsgetreu: gleiche Einheit wie x
    const mapY = (y: number) => -y * yScale;

    interface Seg { x1: number; y1: number; x2: number; y2: number; color: string; aug: boolean; edge: number }
    const segs: Seg[] = [];
    const stubs: Seg[] = [];

    const stOf = (v: number) => result.st[v];
    const lowHigh = (e: number): [number, number] => {
      const { u, v } = result.edges[e];
      return stOf(u) < stOf(v) ? [u, v] : [v, u];
    };

    result.edges.forEach((edge, e) => {
      if (edge.aug && !showAug) return;
      const [lowV, highV] = lowHigh(e);
      const pl = result.polylines[e];
      const color = (a: Point, b: Point) =>
        slopeColor(a.x === b.x ? 'inf' : (b.y - a.y) / (b.x - a.x), result.stats.deltaEff);

      if (stOf(highV) <= step) {
        for (let j = 0; j + 1 < pl.length; j++) {
          segs.push({
            x1: mx(pl[j].x), y1: mapY(pl[j].y), x2: mx(pl[j + 1].x), y2: mapY(pl[j + 1].y),
            color: color(pl[j], pl[j + 1]), aug: edge.aug, edge: e,
          });
        }
      } else if (stOf(lowV) <= step) {
        // Pending-Stummel: erstes Segment + Vertikale bis zur "Front"
        const frontier = (step - 1) * R + 0.55 * R;
        const pts: Point[] = [result.pos[lowV]];
        if (pl.length >= 3) {
          const b = pl[1];
          const isSourceBend =
            Math.abs(b.y - result.pos[lowV].y) < Math.abs(b.y - result.pos[highV].y);
          if (isSourceBend) pts.push(b);
        }
        pts.push({ x: result.xEdge[e], y: Math.max(frontier, pts[pts.length - 1].y + 1) });
        for (let j = 0; j + 1 < pts.length; j++) {
          stubs.push({
            x1: mx(pts[j].x), y1: mapY(pts[j].y), x2: mx(pts[j + 1].x), y2: mapY(pts[j + 1].y),
            color: color(pts[j], pts[j + 1]), aug: edge.aug, edge: e,
          });
        }
      }
    });

    const nodes = result.pos
      .map((p, v) => ({ v, x: mx(p.x), y: mapY(p.y), st: stOf(v) }))
      .filter((nd) => nd.st <= step);

    // Zeilen-Hilfslinien
    const rows: Array<{ y: number; st: number }> = [];
    for (let i = 1; i <= Math.min(step, n); i++) rows.push({ y: mapY((i - 1) * R), st: i });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const ext = (x: number, y: number) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };
    segs.forEach((s) => { ext(s.x1, s.y1); ext(s.x2, s.y2); });
    stubs.forEach((s) => { ext(s.x1, s.y1); ext(s.x2, s.y2); });
    nodes.forEach((nd) => ext(nd.x, nd.y));
    if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

    const pad = 40;
    return {
      segs, stubs, nodes, rows,
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`,
    };
  }, [result, step, compact, showAug, R, n]);

  // -------- Pan/Zoom (Rechnung durchgehend in viewBox-Einheiten) --------
  // Die Referenz ist das Wurzel-Koordinatensystem des SVG (viewBox), das
  // von der eigenen <g>-Transformation unabhaengig ist; svgPoint liefert
  // den Zeiger exakt in diesen Einheiten (inkl. Letterboxing).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // Seite nicht scrollen; erfordert non-passive Listener
      const factor = Math.exp(-e.deltaY * 0.0015);
      const p = svgPoint(svg, e.clientX, e.clientY);
      setTf((t) => {
        const k = Math.min(80, Math.max(0.05, t.k * factor));
        const scale = k / t.k;
        // Weltpunkt unter dem Zeiger bleibt fest: t' = p - (p - t)·(k'/k)
        return { k, x: p.x - (p.x - t.x) * scale, y: p.y - (p.y - t.y) * scale };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = svgPoint(svgRef.current!, e.clientX, e.clientY);
    dragStart.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    if (dragStart.current &&
        Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 4) {
      moved.current = true;
    }
    if (!moved.current) return;
    const p = svgPoint(svgRef.current!, e.clientX, e.clientY);
    const dx = p.x - drag.current.x, dy = p.y - drag.current.y;
    drag.current = p;
    setTf((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  };
  const onMouseUp = () => { drag.current = null; };
  const onBackgroundClick = () => {
    if (!moved.current) onSelect(null);
  };

  const highlightOut = new Set(ev?.outEdges ?? []);
  const medianEdge = ev?.medianEdge ?? -1;

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
          kompakt (y gestaucht)
        </label>
        <label>
          <input type="checkbox" checked={showAug} onChange={(e) => setShowAug(e.target.checked)} />
          Hilfskanten
        </label>
        <div className="spacer" />
        <button onClick={() => setTf({ k: 1, x: 0, y: 0 })}>Ansicht zurücksetzen</button>
      </div>
      <svg
        ref={svgRef}
        className="drawing-canvas"
        viewBox={scene.viewBox}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onBackgroundClick}
      >
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          {scene.rows.map((r) => (
            <line key={'row' + r.st} x1={-2000} x2={4000} y1={r.y} y2={r.y} className="row-guide" />
          ))}
          {/* Halo-Unterlagen: Median-Kante des aktuellen Schritts (orange)
              und zum ausgewaehlten Knoten inzidente Kanten (blau). */}
          {scene.segs
            .filter((s) => s.edge === medianEdge || incident.has(s.edge))
            .map((s, i) => (
              <line
                key={'halo' + i}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                className={'halo' + (incident.has(s.edge) ? ' selected' : ' median')}
              />
            ))}
          {scene.stubs.map((s, i) => (
            <line
              key={'stub' + i}
              x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke={s.color}
              className={
                'seg stub' + (s.aug ? ' aug' : '') +
                (highlightOut.has(s.edge) ? ' hl-out' : '') +
                (selected !== null && !incident.has(s.edge) ? ' dim' : '')
              }
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
                'vertex' + (ev && nd.v === ev.v ? ' current' : '') +
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
                {nd.v} ({nd.st})
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
