// GraphML-Import/-Export fuer den Grapheditor.
//
// Export ist ein reiner String-Builder (ohne DOM, in Node testbar);
// Import nutzt den nativen DOMParser (im Test per happy-dom bereitgestellt).
// Exportiert werden die Zeichnungskoordinaten ueber eigene Schluessel
// x/y (attr.type="double"), sodass ein Export -> Import den Graphen exakt
// reproduziert.

import type { InputGraph, Point } from './algorithm/types';

export type GraphMLErrorCode = 'invalid-xml' | 'no-graph' | 'empty' | 'unknown-node';

export class GraphMLError extends Error {
  code: GraphMLErrorCode;
  constructor(code: GraphMLErrorCode) {
    super(code);
    this.name = 'GraphMLError';
    this.code = code;
  }
}

// Zentrum/Radius des Kreis-Layouts fuer Knoten ohne Koordinaten
// (View-Box des Editors ist 640 x 640).
const FALLBACK_CX = 320;
const FALLBACK_CY = 320;
const FALLBACK_R = 260;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Aktueller Editorgraph als standardkonformes GraphML. */
export function graphToGraphML(g: InputGraph): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '  <key id="x" for="node" attr.name="x" attr.type="double"/>',
    '  <key id="y" for="node" attr.name="y" attr.type="double"/>',
    '  <graph id="G" edgedefault="undirected">',
  ];
  for (let v = 0; v < g.n; v++) {
    const p = g.pos[v] ?? { x: 0, y: 0 };
    lines.push(
      `    <node id="n${v}">` +
        `<data key="x">${esc(String(p.x))}</data>` +
        `<data key="y">${esc(String(p.y))}</data>` +
        '</node>',
    );
  }
  for (const [u, w] of g.edges) {
    lines.push(`    <edge source="n${u}" target="n${w}"/>`);
  }
  lines.push('  </graph>', '</graphml>', '');
  return lines.join('\n');
}

/** GraphML-Text zu InputGraph (tolerant). Wirft GraphMLError. */
export function graphMLToGraph(
  text: string,
  parser: DOMParser = new DOMParser(),
): InputGraph {
  if (!text.trim()) throw new GraphMLError('empty');

  let doc: Document;
  try {
    doc = parser.parseFromString(text, 'application/xml');
  } catch {
    throw new GraphMLError('invalid-xml');
  }
  if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length) {
    throw new GraphMLError('invalid-xml');
  }

  const graph = doc.getElementsByTagName('graph')[0];
  if (!graph) throw new GraphMLError('no-graph');

  // Schluessel-IDs, die x- bzw. y-Koordinaten tragen (eigene oder fremde).
  const axisOfKey = new Map<string, 'x' | 'y'>();
  for (const key of Array.from(doc.getElementsByTagName('key'))) {
    const forAttr = (key.getAttribute('for') ?? '').toLowerCase();
    if (forAttr && forAttr !== 'node' && forAttr !== 'all') continue;
    const id = key.getAttribute('id') ?? '';
    const name = (key.getAttribute('attr.name') ?? '').toLowerCase();
    const axis = name === 'x' || id.toLowerCase() === 'x' ? 'x'
      : name === 'y' || id.toLowerCase() === 'y' ? 'y'
        : null;
    if (axis) axisOfKey.set(id, axis);
  }

  // Knoten-IDs in Auftrittsreihenfolge auf 0..n-1 abbilden.
  const nodeEls = Array.from(graph.getElementsByTagName('node'));
  if (nodeEls.length === 0) throw new GraphMLError('empty');
  const index = new Map<string, number>();
  const pos: Array<Point | null> = [];
  nodeEls.forEach((nodeEl, i) => {
    const id = nodeEl.getAttribute('id');
    if (id !== null && !index.has(id)) index.set(id, i);
    pos.push(readCoords(nodeEl, axisOfKey));
  });
  const n = index.size;

  // Kanten aufloesen; Richtung ignorieren, Schleifen/Duplikate entfernen.
  const edges: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const edgeEl of Array.from(graph.getElementsByTagName('edge'))) {
    const s = edgeEl.getAttribute('source');
    const t = edgeEl.getAttribute('target');
    if (s === null || t === null) continue;
    const a = index.get(s);
    const b = index.get(t);
    if (a === undefined || b === undefined) throw new GraphMLError('unknown-node');
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([a, b]);
  }

  // Positionen: vorhandene uebernehmen, fehlende per Kreis-Layout fuellen.
  const finalPos: Point[] = pos.map((p, i) =>
    p ?? {
      x: FALLBACK_CX + FALLBACK_R * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n),
      y: FALLBACK_CY + FALLBACK_R * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n),
    },
  );

  return { n, edges, pos: finalPos };
}

/** Koordinaten eines Knotens aus data-Schluesseln oder yEd-Geometry. */
function readCoords(
  nodeEl: Element,
  axisOfKey: Map<string, 'x' | 'y'>,
): Point | null {
  let x: number | null = null;
  let y: number | null = null;

  for (const dataEl of Array.from(nodeEl.getElementsByTagName('data'))) {
    const axis = axisOfKey.get(dataEl.getAttribute('key') ?? '');
    if (!axis) continue;
    const val = Number(dataEl.textContent);
    if (!Number.isFinite(val)) continue;
    if (axis === 'x') x = val;
    else y = val;
  }

  // Fallback: yEd <y:Geometry x="..." y="..."/>
  if (x === null || y === null) {
    for (const el of Array.from(nodeEl.getElementsByTagName('*'))) {
      if (el.localName !== 'Geometry') continue;
      const gx = Number(el.getAttribute('x'));
      const gy = Number(el.getAttribute('y'));
      if (Number.isFinite(gx) && Number.isFinite(gy)) { x = gx; y = gy; }
      break;
    }
  }

  return x !== null && y !== null ? { x, y } : null;
}
