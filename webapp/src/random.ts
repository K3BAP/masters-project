// Zufaellige planare Graphen: Delaunay-Triangulierung zufaelliger Punkte
// (planar + Einbettung per Konstruktion), danach zufaellige Ausduennung
// unter Erhalt des Zusammenhangs (Spannbaum bleibt).

import { Delaunay } from 'd3-delaunay';
import type { InputGraph } from './algorithm/types';

/** mulberry32 -- kleiner, reproduzierbarer PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Erzeugt einen zusammenhaengenden planaren Zufallsgraphen.
 * density in [0,1]: 0 = Spannbaum, 1 = volle Triangulierung.
 */
export function randomPlanarGraph(n: number, density: number, seed: number): InputGraph {
  const rnd = mulberry32(seed);

  // Punkte mit Mindestabstand (Rejection Sampling)
  const pts: Array<[number, number]> = [];
  const size = 560, margin = 40;
  const minDist = (size / Math.sqrt(n)) * 0.45;
  let guard = 0;
  while (pts.length < n && guard < 20000) {
    guard++;
    const x = margin + rnd() * size;
    const y = margin + rnd() * size;
    if (pts.every(([px, py]) => Math.hypot(px - x, py - y) >= minDist)) pts.push([x, y]);
  }
  while (pts.length < n) pts.push([margin + rnd() * size, margin + rnd() * size]);

  // Delaunay-Kanten extrahieren
  const del = Delaunay.from(pts);
  const edgeSet = new Set<string>();
  const allEdges: Array<[number, number]> = [];
  const { halfedges, triangles } = del;
  for (let e = 0; e < triangles.length; e++) {
    const opposite = halfedges[e];
    if (opposite !== -1 && opposite < e) continue; // Duplikat
    const a = triangles[e];
    const b = triangles[e % 3 === 2 ? e - 2 : e + 1];
    const key = Math.min(a, b) + ',' + Math.max(a, b);
    if (!edgeSet.has(key)) { edgeSet.add(key); allEdges.push([a, b]); }
  }

  // Spannbaum sichern, Rest zufaellig ausduennen
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const tree: Array<[number, number]> = [];
  const rest: Array<[number, number]> = [];
  for (const [a, b] of allEdges) {
    if (find(a) !== find(b)) { parent[find(a)] = find(b); tree.push([a, b]); }
    else rest.push([a, b]);
  }
  // Fisher-Yates
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const extra = Math.round(density * rest.length);
  const edges = [...tree, ...rest.slice(0, extra)];

  return { n, pos: pts.map(([x, y]) => ({ x, y })), edges };
}
