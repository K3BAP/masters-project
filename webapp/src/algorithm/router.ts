// Routing-Kern: Port von process_vertex / attempt_routing aus slopes_core.cpp.
//
// Vergibt ausschliesslich Kombinatorik (Spalten + Portsteigungen); die
// Geometrie folgt in geometry.ts. Dadurch ist shiftRight (Spalten-
// einfuegung) trivially verschiebungssicher.

import type { EmbeddedGraph, Port, TraceEvent } from './types';
import { UNASSIGNED } from './types';

export interface RoutingResult {
  xNode: number[];
  xEdge: number[];
  slopeSrc: number[]; // Steigung des ersten Segments (am st-kleineren Endpunkt)
  slopeTgt: number[]; // Steigung des letzten Segments (am st-groesseren Endpunkt)
  trace: TraceEvent[];
  flipped: boolean;
}

/**
 * Ports gegen den Uhrzeigersinn (nach Winkel):
 * (0,R),(1..hi,R),(inf,U),(lo..-1,L),(0..hi,L),(inf,D),(lo..-1,R)
 */
export function buildPortsCcw(deltaEff: number): { ports: Port[]; idxDown: number } {
  const hi = Math.ceil(deltaEff / 4) - 1;
  const lo = -(Math.floor(deltaEff / 4) - 1);
  const ports: Port[] = [];
  for (let s = 0; s <= hi; s++) ports.push({ slope: s, vertical: false, side: 1 });
  ports.push({ slope: 0, vertical: true, side: 1 });          // vertikal hoch
  for (let s = lo; s <= -1; s++) ports.push({ slope: s, vertical: false, side: -1 });
  for (let s = 0; s <= hi; s++) ports.push({ slope: s, vertical: false, side: -1 });
  const idxDown = ports.length;
  ports.push({ slope: 0, vertical: true, side: -1 });         // vertikal runter
  for (let s = lo; s <= -1; s++) ports.push({ slope: s, vertical: false, side: 1 });
  return { ports, idxDown };
}

/** Slope-Menge S als sortierte Liste endlicher Steigungen (ohne vertikal). */
export function slopeSet(deltaEff: number): number[] {
  const hi = Math.ceil(deltaEff / 4) - 1;
  const lo = -(Math.floor(deltaEff / 4) - 1);
  const out: number[] = [];
  for (let s = lo; s <= hi; s++) out.push(s);
  return out;
}

class RouterError extends Error {}

/**
 * Kompletter Routingversuch. eSt = Kanten-Id der st-Kante (v1, vn).
 * Wirft nicht; liefert Fehlermeldung im Rueckgabewert.
 */
export function route(
  eg: EmbeddedGraph,
  st: number[],
  eSt: number,
  deltaEff: number,
): { ok: true; result: RoutingResult } | { ok: false; error: string } {
  for (const flip of [false, true]) {
    try {
      const result = attempt(eg, st, eSt, deltaEff, flip);
      return { ok: true, result };
    } catch (err) {
      if (flip && err instanceof RouterError) return { ok: false, error: err.message };
      if (!(err instanceof RouterError)) throw err;
    }
  }
  return { ok: false, error: 'Routing fehlgeschlagen (intern)' };
}

function attempt(
  eg: EmbeddedGraph,
  st: number[],
  eSt: number,
  deltaEff: number,
  flip: boolean,
): RoutingResult {
  const n = eg.n;
  const m = eg.edges.length;
  const { ports, idxDown } = buildPortsCcw(deltaEff);
  const P = ports.length;

  const xNode = new Array<number>(n).fill(UNASSIGNED);
  const xEdge = new Array<number>(m).fill(UNASSIGNED);
  const slopeSrc = new Array<number>(m).fill(0);
  const slopeTgt = new Array<number>(m).fill(0);
  const trace: TraceEvent[] = [];

  // Verarbeitungsreihenfolge nach st-Nummer
  const bySt = new Array<number>(n).fill(-1);
  for (let v = 0; v < n; v++) bySt[st[v] - 1] = v;

  let xMax = 0;
  const shiftRight = (pivot: number) => {
    xMax++;
    for (let v = 0; v < n; v++) if (xNode[v] !== UNASSIGNED && xNode[v] >= pivot) xNode[v]++;
    for (let e = 0; e < m; e++) if (xEdge[e] !== UNASSIGNED && xEdge[e] >= pivot) xEdge[e]++;
  };

  for (let step = 0; step < n; step++) {
    const v = bySt[step];
    const i = st[v];
    let rot = eg.rot[v].slice();
    if (flip) rot.reverse();
    const deg = rot.length;
    if (deg > P) throw new RouterError('Knotengrad uebersteigt Portanzahl (intern)');

    // ------ in/out-Runs bestimmen ------
    let inLtr: number[] = [];  // Kanten-Ids, links nach rechts
    let outs: number[] = [];

    if (i === 1) {
      const anchor = rot.findIndex((d) => d.e === eSt);
      if (anchor < 0) throw new RouterError('ST-Kante am Startknoten nicht gefunden');
      for (let j = 0; j < deg; j++) outs.push(rot[(anchor + j) % deg].e);
    } else if (i === n) {
      if (deg === 1) {
        inLtr.push(rot[0].e);
      } else {
        let ascents = 0, cut = -1;
        for (let j = 0; j < deg; j++) {
          const xa = xEdge[rot[j].e];
          const xb = xEdge[rot[(j + 1) % deg].e];
          if (xa === UNASSIGNED || xb === UNASSIGNED) throw new RouterError('In-Kante der Senke ohne Spalte');
          if (xa < xb) { ascents++; cut = j; }
        }
        if (ascents !== 1) throw new RouterError('Einbettung an der Senke nicht bipolar');
        for (let j = 0; j < deg; j++) inLtr.push(rot[(cut + deg - j) % deg].e);
      }
    } else {
      const isOut = rot.map((d) => st[d.to] > i);
      let transitions = 0, outStart = -1;
      for (let j = 0; j < deg; j++) {
        if (!isOut[j] && isOut[(j + 1) % deg]) { transitions++; outStart = (j + 1) % deg; }
      }
      if (transitions !== 1) throw new RouterError('Einbettung nicht bipolar an Knoten ' + v);
      let j = outStart;
      while (isOut[j]) { outs.push(rot[j].e); j = (j + 1) % deg; }
      while (j !== outStart) { inLtr.push(rot[j].e); j = (j + 1) % deg; }
      inLtr.reverse(); // Uhrzeigersinn liefert e_k..e_1
    }

    const k = inLtr.length;
    const q = outs.length;

    // Pending-Invariante: In-Spalten streng aufsteigend
    for (let j = 0; j + 1 < k; j++) {
      if (xEdge[inLtr[j]] >= xEdge[inLtr[j + 1]]) {
        throw new RouterError('Spaltenordnung der In-Kanten verletzt (Knoten ' + v + ')');
      }
    }

    // Medianspalte
    const med = Math.ceil(k / 2); // 1-indiziert
    if (i === 1) {
      xNode[v] = xMax; // = 0 beim Start
    } else {
      xNode[v] = xEdge[inLtr[med - 1]];
    }

    // ------ Portvergabe: ccw-konsekutiv, Median auf (inf, unten) ------
    const portOfOut = new Array<number>(q).fill(-1);
    for (let j = 0; j < k; j++) {
      const off = (j + 1) - med;
      const idx = ((idxDown + off) % P + P) % P;
      const p = ports[idx];
      if (j + 1 === med) { slopeTgt[inLtr[j]] = 0; continue; }
      if (p.vertical) throw new RouterError('In-Kante wuerde vertikalen Port belegen');
      slopeTgt[inLtr[j]] = p.slope;
    }
    for (let j = 1; j <= q; j++) {
      const idx = (idxDown + (k - med) + j) % P;
      portOfOut[q - j] = idx;
      if (ports[idx].vertical && ports[idx].side < 0) {
        throw new RouterError('Out-Kante wuerde unteren vertikalen Port belegen');
      }
    }

    // ------ Spaltenallokation: Muster L*, U?, R* ------
    let nL = 0, nR = 0, upIdx = -1;
    for (let j = 0; j < q; j++) {
      const p = ports[portOfOut[j]];
      if (p.vertical) {
        if (upIdx >= 0) throw new RouterError('Zwei vertikale Out-Ports (intern)');
        upIdx = j;
      } else if (p.side < 0) {
        if (upIdx >= 0 || nR > 0) throw new RouterError('Out-Port-Muster verletzt');
        nL++;
      } else {
        nR++;
      }
    }

    for (let t2 = 0; t2 < nL; t2++) shiftRight(xNode[v]);
    for (let j = 0; j < nL; j++) xEdge[outs[j]] = xNode[v] - nL + j;
    if (upIdx >= 0) xEdge[outs[upIdx]] = xNode[v];
    for (let t2 = 0; t2 < nR; t2++) shiftRight(xNode[v] + 1);
    for (let j = 0; j < nR; j++) xEdge[outs[q - nR + j]] = xNode[v] + 1 + j;

    for (let j = 0; j < q; j++) {
      const p = ports[portOfOut[j]];
      slopeSrc[outs[j]] = p.vertical ? 0 : p.slope;
    }

    trace.push({
      v, st: i, k, q,
      medianEdge: k > 0 ? inLtr[med - 1] : -1,
      inEdges: inLtr.slice(),
      outEdges: outs.slice(),
      shiftsLeft: nL,
      shiftsRight: nR,
    });
  }

  return { xNode, xEdge, slopeSrc, slopeTgt, trace, flipped: flip };
}
