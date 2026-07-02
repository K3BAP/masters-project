// Abschlussgeometrie: Zeilenkoordinaten und Knickpunkte aus der
// Routing-Kombinatorik (Port des Geometriedurchlaufs aus slopes_core.cpp).

import type { EmbeddedGraph, Point } from './types';
import type { RoutingResult } from './router';

export interface GeometryResult {
  pos: Point[];         // logische Gitterkoordinaten pro Knoten
  polylines: Point[][]; // pro Kante, orientiert vom st-kleineren Endpunkt aus
  rowSpacing: number;
  span: number;
}

export function computeGeometry(
  eg: EmbeddedGraph,
  st: number[],
  routing: RoutingResult,
  deltaEff: number,
): GeometryResult {
  const n = eg.n;
  const m = eg.edges.length;
  const span = Math.max(1, 2 * m - n);
  const R = (deltaEff / 2) * span + 1;

  const pos: Point[] = [];
  for (let v = 0; v < n; v++) {
    pos.push({ x: routing.xNode[v], y: (st[v] - 1) * R });
  }

  const polylines: Point[][] = [];
  for (let e = 0; e < m; e++) {
    const { u, v } = eg.edges[e];
    const s = st[u] < st[v] ? u : v; // st-kleinerer Endpunkt
    const t = st[u] < st[v] ? v : u;
    const xe = routing.xEdge[e];
    const b1: Point = { x: xe, y: pos[s].y + routing.slopeSrc[e] * (xe - pos[s].x) };
    const b2: Point = { x: xe, y: pos[t].y + routing.slopeTgt[e] * (xe - pos[t].x) };
    const pl: Point[] = [pos[s]];
    if (!samePoint(b1, pos[s])) pl.push(b1);
    if (!samePoint(b2, pos[t]) && !samePoint(b2, pl[pl.length - 1])) pl.push(b2);
    pl.push(pos[t]);
    polylines.push(pl);
  }

  return { pos, polylines, rowSpacing: R, span };
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
