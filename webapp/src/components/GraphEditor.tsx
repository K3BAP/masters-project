import { useRef, useState } from 'react';
import type { InputIssues } from '../algorithm/embedding';
import type { InputGraph, Point } from '../algorithm/types';
import { useI18n } from '../i18n';
import { svgPoint } from './svgUtils';

type Mode = 'node' | 'edge' | 'move' | 'delete';

interface Props {
  graph: InputGraph;
  issues: InputIssues;
  onChange: (g: InputGraph) => void;
  /** In der Ergebnisansicht ausgewaehlter Knoten (Quermarkierung). */
  selectedNode?: number | null;
}

const VIEW = 640;

export function GraphEditor({ graph, issues, onChange, selectedNode = null }: Props) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>('node');
  const [dragNode, setDragNode] = useState<number | null>(null);
  const [edgeFrom, setEdgeFrom] = useState<number | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);

  const toLocal = (ev: React.MouseEvent): Point =>
    svgPoint(svgRef.current!, ev.clientX, ev.clientY);

  const nodeAt = (p: Point): number | null => {
    for (let v = 0; v < graph.n; v++) {
      if (Math.hypot(graph.pos[v].x - p.x, graph.pos[v].y - p.y) <= 16) return v;
    }
    return null;
  };

  const edgeAt = (p: Point): number | null => {
    for (let e = 0; e < graph.edges.length; e++) {
      const [u, w] = graph.edges[e];
      if (distToSegment(p, graph.pos[u], graph.pos[w]) <= 6) return e;
    }
    return null;
  };

  const crossingEdges = new Set(issues.crossingPairs.flat());

  // Hover-Ziel unter dem Zeiger (Knoten hat Vorrang; Kanten nur im
  // Loeschmodus relevant). Steuert Cursor und Hervorhebung.
  const [hover, setHover] = useState<{ node: number | null; edge: number | null }>(
    { node: null, edge: null },
  );

  const updateHover = (p: Point) => {
    const node = nodeAt(p);
    const edge = node === null && mode === 'delete' ? edgeAt(p) : null;
    if (node !== hover.node || edge !== hover.edge) setHover({ node, edge });
  };

  const onMouseDown = (ev: React.MouseEvent) => {
    const p = toLocal(ev);
    const v = nodeAt(p);
    if (mode === 'node') {
      if (v === null) {
        onChange({ ...graph, n: graph.n + 1, pos: [...graph.pos, p] });
      }
    } else if (mode === 'edge') {
      if (v !== null) { setEdgeFrom(v); setCursor(p); }
    } else if (mode === 'move') {
      if (v !== null) setDragNode(v);
    } else if (mode === 'delete') {
      if (v !== null) deleteNode(v);
      else {
        const e = edgeAt(p);
        if (e !== null) {
          onChange({ ...graph, edges: graph.edges.filter((_, i) => i !== e) });
        }
      }
    }
  };

  const onMouseMove = (ev: React.MouseEvent) => {
    const p = toLocal(ev);
    if (dragNode !== null) {
      const pos = graph.pos.slice();
      pos[dragNode] = p;
      onChange({ ...graph, pos });
    } else if (edgeFrom !== null) {
      setCursor(p);
    }
    updateHover(p);
  };

  const onMouseUp = (ev: React.MouseEvent) => {
    if (edgeFrom !== null) {
      const p = toLocal(ev);
      const v = nodeAt(p);
      if (v !== null && v !== edgeFrom && !hasEdge(graph, edgeFrom, v)) {
        onChange({ ...graph, edges: [...graph.edges, [edgeFrom, v]] });
      }
      setEdgeFrom(null);
      setCursor(null);
    }
    setDragNode(null);
  };

  const onMouseLeave = (ev: React.MouseEvent) => {
    onMouseUp(ev);
    setHover({ node: null, edge: null });
  };

  // Kontextabhaengiger Cursor: Spezialcursor nur dort, wo das Werkzeug
  // tatsaechlich wirkt.
  const cursorStyle = (() => {
    if (dragNode !== null) return 'grabbing';
    if (edgeFrom !== null) return 'crosshair';
    switch (mode) {
      case 'node': return hover.node !== null ? 'not-allowed' : 'crosshair';
      case 'edge': return hover.node !== null ? 'crosshair' : 'default';
      case 'move': return hover.node !== null ? 'grab' : 'default';
      case 'delete': return hover.node !== null || hover.edge !== null ? 'pointer' : 'default';
    }
  })();

  // Hervorhebung des Hover-Ziels je Werkzeug; beim Kantenziehen wird das
  // Ziel gruen (gueltig) bzw. rot (Kante existiert schon) markiert.
  const nodeClass = (v: number) => {
    let cls = 'node';
    if (v === selectedNode) cls += ' selected';
    if (edgeFrom !== null) {
      if (v === edgeFrom) cls += ' edge-source';
      else if (hover.node === v) {
        cls += hasEdge(graph, edgeFrom, v) ? ' target-invalid' : ' target-valid';
      }
    } else if (hover.node === v) {
      if (mode === 'delete') cls += ' hover-delete';
      else if (mode === 'edge' || mode === 'move') cls += ' hover-target';
    }
    return cls;
  };

  const deleteNode = (v: number) => {
    const remap = new Map<number, number>();
    let next = 0;
    for (let i = 0; i < graph.n; i++) if (i !== v) remap.set(i, next++);
    onChange({
      n: graph.n - 1,
      pos: graph.pos.filter((_, i) => i !== v),
      edges: graph.edges
        .filter(([a, b]) => a !== v && b !== v)
        .map(([a, b]) => [remap.get(a)!, remap.get(b)!] as [number, number]),
    });
  };

  return (
    <div className="editor">
      <div className="editor-toolbar">
        {(
          [
            ['node', t('editor_node')],
            ['edge', t('editor_edge')],
            ['move', t('editor_move')],
            ['delete', t('editor_delete')],
          ] as Array<[Mode, string]>
        ).map(([m, label]) => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
        <button
          className="push-right"
          onClick={() => onChange({ n: 0, edges: [], pos: [] })}
        >
          {t('editor_clear')}
        </button>
      </div>
      <svg
        ref={svgRef}
        className="editor-canvas"
        style={{ cursor: cursorStyle }}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {graph.edges.map(([u, w], e) => (
          <line
            key={e}
            x1={graph.pos[u].x} y1={graph.pos[u].y}
            x2={graph.pos[w].x} y2={graph.pos[w].y}
            className={
              'edge' + (crossingEdges.has(e) ? ' crossing' : '') +
              (hover.edge === e ? ' hover-delete' : '')
            }
          />
        ))}
        {edgeFrom !== null && cursor && (
          <line
            x1={graph.pos[edgeFrom].x} y1={graph.pos[edgeFrom].y}
            x2={cursor.x} y2={cursor.y}
            className="edge preview"
          />
        )}
        {graph.pos.map((p, v) => (
          <g key={v}>
            <circle cx={p.x} cy={p.y} r={14} className={nodeClass(v)} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" className="node-label">{v}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function hasEdge(g: InputGraph, a: number, b: number): boolean {
  return g.edges.some(([u, w]) => (u === a && w === b) || (u === b && w === a));
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
