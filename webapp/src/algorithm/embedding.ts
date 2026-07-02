// Einbettung aus Zeichnungsgeometrie und Eingabevalidierung.
//
// Der entscheidende Trick der Webapp: Statt eines Planaritaetstests mit
// kombinatorischer Einbettung (Boyer-Myrvold etc.) wird das Rotations-
// system direkt aus der kreuzungsfreien Zeichnung des Nutzers abgeleitet
// (Nachbarn nach Winkel sortiert). Ein exakter Kreuzungstest fungiert
// als Planaritaets-Gate.

import type { Dart, Edge, EmbeddedGraph, InputGraph, Point } from './types';

/** Rotationssystem aus den Zeichnungskoordinaten (Winkelsortierung). */
export function buildEmbedding(g: InputGraph): EmbeddedGraph {
  const edges: Edge[] = g.edges.map(([u, v]) => ({ u, v, aug: false }));
  const rot: Dart[][] = Array.from({ length: g.n }, () => []);
  edges.forEach((e, idx) => {
    rot[e.u].push({ e: idx, to: e.v });
    rot[e.v].push({ e: idx, to: e.u });
  });
  for (let v = 0; v < g.n; v++) {
    rot[v].sort((a, b) => angleAt(g.pos, v, a.to) - angleAt(g.pos, v, b.to));
  }
  return { n: g.n, edges, rot };
}

function angleAt(pos: Point[], from: number, to: number): number {
  return Math.atan2(pos[to].y - pos[from].y, pos[to].x - pos[from].x);
}

// ---------------------------------------------------------------------
// Geometrische Validierung der Eingabezeichnung
// ---------------------------------------------------------------------

function orient(a: Point, b: Point, c: Point): number {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
}

function onSeg(p: Point, a: Point, b: Point): boolean {
  if (orient(a, b, p) !== 0) return false;
  return (
    p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 &&
    p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = orient(a, b, c), d2 = orient(a, b, d);
  const d3 = orient(c, d, a), d4 = orient(c, d, b);
  if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  // Beruehrungen/Kollinearitaeten zaehlen hier ebenfalls als Konflikt
  return onSeg(c, a, b) || onSeg(d, a, b) || onSeg(a, c, d) || onSeg(b, c, d);
}

export interface InputIssues {
  crossingPairs: Array<[number, number]>; // Kantenindizes
  vertexOnEdge: Array<[number, number]>;  // [Knoten, Kante]
  disconnected: boolean;
  ok: boolean;
}

/** Prueft die Zeichnung: kreuzungsfrei + zusammenhaengend. */
export function validateInput(g: InputGraph): InputIssues {
  const crossingPairs: Array<[number, number]> = [];
  const vertexOnEdge: Array<[number, number]> = [];

  for (let i = 0; i < g.edges.length; i++) {
    const [a, b] = g.edges[i];
    for (let j = i + 1; j < g.edges.length; j++) {
      const [c, d] = g.edges[j];
      if (a === c || a === d || b === c || b === d) continue; // gemeinsamer Endpunkt ok
      if (segmentsCross(g.pos[a], g.pos[b], g.pos[c], g.pos[d])) {
        crossingPairs.push([i, j]);
      }
    }
    for (let v = 0; v < g.n; v++) {
      if (v === a || v === b) continue;
      if (onSeg(g.pos[v], g.pos[a], g.pos[b])) vertexOnEdge.push([v, i]);
    }
  }

  const disconnected = g.n > 1 && !isConnected(g.n, g.edges);
  return {
    crossingPairs,
    vertexOnEdge,
    disconnected,
    ok: crossingPairs.length === 0 && vertexOnEdge.length === 0 && !disconnected,
  };
}

export function isConnected(n: number, edges: Array<[number, number]>): boolean {
  if (n === 0) return true;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) { adj[u].push(v); adj[v].push(u); }
  const seen = new Array<boolean>(n).fill(false);
  const stack = [0];
  seen[0] = true;
  let count = 1;
  while (stack.length) {
    const v = stack.pop()!;
    for (const w of adj[v]) if (!seen[w]) { seen[w] = true; count++; stack.push(w); }
  }
  return count === n;
}

/**
 * Ein "Corner" einer Flaeche: Besuch am Knoten v; ein neuer Dart, der an
 * Position insertPos in rot[v] eingefuegt wird, liegt in dieser Flaeche.
 */
export interface FaceCorner {
  v: number;
  insertPos: number;
}

/**
 * Alle Flaechen des Rotationssystems als Corner-Folgen.
 * Traversierungsregel: next(d) = Rotationsnachfolger des umgekehrten Darts.
 * Dart-Codierung: 2*e + (0: u->v, 1: v->u).
 */
export function traverseFaces(eg: EmbeddedGraph): FaceCorner[][] {
  const m = eg.edges.length;
  const pos = new Map<number, number>(); // Dartcode -> Index in rot[from]
  const codeOf = (vertex: number, d: Dart) => {
    const e = eg.edges[d.e];
    return 2 * d.e + (vertex === e.u ? 0 : 1);
  };
  for (let v = 0; v < eg.n; v++) {
    eg.rot[v].forEach((d, idx) => pos.set(codeOf(v, d), idx));
  }
  const targetOf = (code: number) => {
    const e = eg.edges[code >> 1];
    return (code & 1) === 0 ? e.v : e.u;
  };
  const visited = new Set<number>();
  const faces: FaceCorner[][] = [];
  for (let e = 0; e < m; e++) {
    for (const dir of [0, 1]) {
      let d = 2 * e + dir;
      if (visited.has(d)) continue;
      const corners: FaceCorner[] = [];
      while (!visited.has(d)) {
        visited.add(d);
        const v = targetOf(d);
        const idx = pos.get(d ^ 1)!; // Position des umgekehrten Darts an v
        // Der Corner an v liegt zwischen rot[v][idx] und rot[v][idx+1]
        corners.push({ v, insertPos: idx + 1 });
        d = codeOf(v, eg.rot[v][(idx + 1) % eg.rot[v].length]);
      }
      faces.push(corners);
    }
  }
  return faces;
}

/** Eulerformel-Check des Rotationssystems: planar (Genus 0) gdw. n - m + f = 2. */
export function isPlanarRotation(eg: EmbeddedGraph): boolean {
  const m = eg.edges.length;
  if (eg.n === 0 || m === 0) return true;
  return eg.n - m + traverseFaces(eg).length === 2;
}
