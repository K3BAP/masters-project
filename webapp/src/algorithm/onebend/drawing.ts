// Inkrementelle 1-Bend-Konstruktion entlang der kanonischen Ordnung
// (Port des Draw-Kerns aus onebend_core.cpp, Theorem 1).
//
// Steigungsmenge S (k = 4*Deff*n^2, D3 = Deff-3): vertikal; horizontal;
// links-steil -k/j und rechts-steil +k/j (j = 1..D3); flach j/D3
// (j = 1..D3-1).
//
// Streckung (Cut an Konturkante e): R = Abschluss des rechten Endpunkts
// des horizontalen Segments von e unter (a) nicht-horizontalen Segmenten
// (beide Richtungen, starr) und (b) horizontalen Segmenten in Richtung
// ihres rechten Endpunkts; alle Punkte in R wandern um +d. Nur
// horizontale Segmente aendern ihre Laenge, Steigungen bleiben exakt.

import type { Edge, Point } from '../types';
import type { CanonicalOrder } from './canonicalOrder';
import type { OneBendColor, OneBendSnapshot, SnapshotKind } from './types';

export interface EdgeRec {
  u: number; // Quelle (frueherer Teil)
  v: number;
  color: OneBendColor;
  drawn: boolean;
  bend: Point | null;
}

/**
 * Sicherer Koordinatenbereich (2^48). Bei manuell kleinem k waechst die
 * Breite pro Schritt etwa um den Faktor (1 + 2*Delta/k); der Guard nach
 * jedem Schritt bricht ab, BEVOR Zwischenwerte die exakte Ganzzahl-
 * Darstellung von Number (2^53) verlassen koennten -- ein einzelner
 * Schritt ab einem noch gueltigen Zustand bleibt nachweislich exakt.
 */
const MAX_COORD = 2 ** 48;

export interface DrawOutput {
  ok: boolean;
  error?: string;
  X: number[];
  Y: number[];
  recs: EdgeRec[];
  snapshots: OneBendSnapshot[];
  specialVn: boolean;
}

export function drawOneBend(
  n: number,
  edges: Edge[],
  order: CanonicalOrder,
  deltaEff: number,
  k: number,
): DrawOutput {
  const D = new Draw(n, edges, order, deltaEff, k);
  const ok = D.run();
  return {
    ok,
    error: ok ? undefined : D.error,
    X: D.X,
    Y: D.Y,
    recs: D.recs,
    snapshots: D.snapshots,
    specialVn: D.specialVn,
  };
}

class Draw {
  n: number;
  edges: Edge[];
  adj: number[][];
  part: number[];
  X: number[];
  Y: number[];
  placed: boolean[];
  recs: EdgeRec[];
  eidx = new Map<string, number>();
  usedTop: Array<Set<number>>; // 0 = vertikal, +j = k/j, -j = -k/j
  contour: number[] = [];
  H = 0;
  k: number;
  D3: number;
  deltaEff: number;
  order: CanonicalOrder;
  v1: number; v2: number; vn: number;
  skipA = -1; skipB = -1;
  specialVn = false;
  snapshots: OneBendSnapshot[] = [];
  error = '';

  constructor(n: number, edges: Edge[], order: CanonicalOrder, deltaEff: number, k: number) {
    this.n = n;
    this.edges = edges;
    this.order = order;
    this.deltaEff = deltaEff;
    this.D3 = deltaEff - 3;
    this.k = k;
    this.v1 = order.v1; this.v2 = order.v2; this.vn = order.vn;

    this.adj = Array.from({ length: n }, () => []);
    edges.forEach((e) => {
      this.adj[e.u].push(e.v);
      this.adj[e.v].push(e.u);
    });
    this.part = new Array<number>(n).fill(-1);
    order.parts.forEach((p, i) => p.forEach((v) => { this.part[v] = i; }));
    this.X = new Array<number>(n).fill(0);
    this.Y = new Array<number>(n).fill(0);
    this.placed = new Array<boolean>(n).fill(false);
    this.usedTop = Array.from({ length: n }, () => new Set<number>());
    this.recs = edges.map((e) => {
      const fwd = this.part[e.u] <= this.part[e.v];
      return {
        u: fwd ? e.u : e.v,
        v: fwd ? e.v : e.u,
        color: 'black' as OneBendColor,
        drawn: false,
        bend: null,
      };
    });
    edges.forEach((e, i) => this.eidx.set(ekey(e.u, e.v), i));
  }

  fail(msg: string): false {
    if (!this.error) this.error = msg;
    return false;
  }

  // v2 ist der rechteste Konturknoten (Kontur endet dort, x-monoton) und
  // H die groesste y-Koordinate -- beide zusammen dominieren alle Punkte.
  coordGuard(): boolean {
    if (this.X[this.v2] <= MAX_COORD && this.H <= MAX_COORD) return true;
    return this.fail('Zeichnung uebersteigt den sicheren Koordinatenbereich (k zu klein fuer diesen Graphen?).');
  }

  eid(a: number, b: number): number {
    return this.eidx.get(ekey(a, b)) ?? -1;
  }

  cpos(v: number): number {
    return this.contour.indexOf(v);
  }

  // ------------------------------------------------------------------
  // Streckung: Cut an der Konturkante (a,b) mit a links von b
  // ------------------------------------------------------------------
  stretch(a: number, b: number, d: number): boolean {
    if (d <= 0) return true;
    const re = this.eid(a, b);
    if (re < 0 || !this.recs[re].drawn)
      return this.fail('Streckung an nicht gezeichneter Konturkante');

    // Punkt-Ids: 0..n-1 Knoten, n+i Knick der Kante i
    const NP = this.n + this.recs.length;
    // inc[p] = [anderer Punkt, typ]: 0 = starr, 1 = horizontal & p links,
    // 2 = horizontal & p rechts
    const inc: Array<Array<[number, 0 | 1 | 2]>> = Array.from({ length: NP }, () => []);
    const pts = (i: number): Array<[number, number, number]> => {
      const r = this.recs[i];
      const out: Array<[number, number, number]> = [[r.u, this.X[r.u], this.Y[r.u]]];
      if (r.bend) out.push([this.n + i, r.bend.x, r.bend.y]);
      out.push([r.v, this.X[r.v], this.Y[r.v]]);
      return out;
    };
    for (let i = 0; i < this.recs.length; i++) {
      if (!this.recs[i].drawn) continue;
      const p = pts(i);
      for (let s = 0; s + 1 < p.length; s++) {
        const [pid, px, py] = p[s];
        const [qid, qx, qy] = p[s + 1];
        if (py === qy) {
          const pLeft = px < qx;
          inc[pid].push([qid, pLeft ? 1 : 2]);
          inc[qid].push([pid, pLeft ? 2 : 1]);
        } else {
          inc[pid].push([qid, 0]);
          inc[qid].push([pid, 0]);
        }
      }
    }

    // Seed: rechter Endpunkt des horizontalen Segments der Cut-Kante
    let seed = -1, seedLeft = -1;
    for (const [s, t] of pairsOf(pts(re))) {
      if (s[2] !== t[2]) continue;
      if (s[1] < t[1]) { seed = t[0]; seedLeft = s[0]; }
      else { seed = s[0]; seedLeft = t[0]; }
    }
    if (seed < 0) return this.fail('Cut-Kante ohne horizontales Segment');

    const inR = new Array<boolean>(NP).fill(false);
    const queue = [seed];
    inR[seed] = true;
    for (let qi = 0; qi < queue.length; qi++) {
      for (const [q, t] of inc[queue[qi]]) {
        if (inR[q] || t === 2) continue;
        inR[q] = true;
        queue.push(q);
      }
    }
    if (inR[seedLeft])
      return this.fail('Cut-Verletzung: linker Endpunkt im verschobenen Teil');
    if (inR[this.v1]) return this.fail('Cut-Verletzung: v1 im verschobenen Teil');
    if (inR[a]) return this.fail('Cut-Verletzung: linker Konturknoten im verschobenen Teil');

    for (let p = 0; p < NP; p++) {
      if (!inR[p]) continue;
      if (p < this.n) this.X[p] += d;
      else this.recs[p - this.n].bend!.x += d;
    }
    return true;
  }

  // ------------------------------------------------------------------
  // Ports
  // ------------------------------------------------------------------
  pickRs(v: number): number | null {
    for (let j = this.D3; j >= 1; j--) if (!this.usedTop[v].has(+j)) return +j;
    return this.usedTop[v].has(0) ? null : 0;
  }
  pickLs(v: number): number | null {
    for (let j = this.D3; j >= 1; j--) if (!this.usedTop[v].has(-j)) return -j;
    return this.usedTop[v].has(0) ? null : 0;
  }
  rayX(v: number, port: number, Ly: number): number {
    if (port === 0) return this.X[v];
    const steps = (Ly - this.Y[v]) / this.k; // Vielfaches von k
    return this.X[v] + steps * port; // port traegt das Vorzeichen
  }

  drawEdge(u: number, v: number, color: OneBendColor, bend: Point | null): boolean {
    const re = this.eid(u, v);
    if (re < 0) return this.fail('Kante fehlt im Graphen (intern)');
    const r = this.recs[re];
    if (r.drawn) return this.fail('Kante doppelt gezeichnet (intern)');
    r.drawn = true;
    r.color = color;
    r.u = u;
    r.v = v;
    r.bend = bend ? { ...bend } : null;
    return true;
  }

  // Nachbarn des Teils mit kleinerem Teilindex, nach Konturposition
  // sortiert. Zwischen den Nachbarn koennen ueberdeckte Konturknoten
  // liegen (ihre spaeteren Nachbarn wurden bereits gezeichnet).
  lowerNeighbors(pt: number[], i: number): { nbrs: number[]; posL: number; posR: number } | null {
    const seen = new Set<number>();
    for (const z of pt) {
      for (const y of this.adj[z]) {
        if (this.part[y] >= i) continue;
        if (z === this.skipA && y === this.skipB) continue;
        if (z === this.skipB && y === this.skipA) continue;
        seen.add(y);
      }
    }
    const ord: Array<[number, number]> = [];
    for (const y of seen) {
      const p = this.cpos(y);
      if (p < 0) { this.fail('Nachbar nicht auf der Kontur'); return null; }
      ord.push([p, y]);
    }
    if (ord.length < 2) { this.fail('Teil mit weniger als zwei unteren Nachbarn'); return null; }
    ord.sort((a, b) => a[0] - b[0]);
    return { nbrs: ord.map((o) => o[1]), posL: ord[0][0], posR: ord[ord.length - 1][0] };
  }

  spliceContour(posL: number, posR: number, mid: number[]) {
    this.contour = [
      ...this.contour.slice(0, posL + 1),
      ...mid,
      ...this.contour.slice(posR),
    ];
  }

  snapshot(kind: SnapshotKind, partIndex: number, newNodes: number[], newEdges: number[], q?: number) {
    this.snapshots.push({
      kind,
      partIndex,
      pos: this.placed.map((p, v) => (p ? { x: this.X[v], y: this.Y[v] } : null)),
      polylines: this.recs.map((r) =>
        r.drawn
          ? [
              { x: this.X[r.u], y: this.Y[r.u] },
              ...(r.bend ? [{ ...r.bend }] : []),
              { x: this.X[r.v], y: this.Y[r.v] },
            ]
          : null,
      ),
      newNodes,
      newEdges,
      partSize: newNodes.length,
      q,
    });
  }

  // ------------------------------------------------------------------
  // Fall 1: Kette oder Singleton mit Untergrad 2
  // ------------------------------------------------------------------
  case1(chainIn: number[], i: number): boolean {
    const chain = chainIn.slice();
    const ln = this.lowerNeighbors(chain, i);
    if (!ln) return false;
    if (ln.nbrs.length !== 2) return this.fail('Fall 1 mit != 2 unteren Nachbarn');
    const [vl, vr] = ln.nbrs;

    if (!this.adj[chain[0]].includes(vl)) {
      if (!this.adj[chain[chain.length - 1]].includes(vl))
        return this.fail('Kette haengt nicht an vl');
      chain.reverse();
    }

    const rhoL = this.pickRs(vl);
    const rhoR = this.pickLs(vr);
    if (rhoL === null || rhoR === null) return this.fail('Kein freier Port (I.3 verletzt?)');

    const Ly = this.H + this.k;
    const plx = this.rayX(vl, rhoL, Ly);
    const vl2 = this.contour[ln.posL + 1];
    if (!this.stretch(vl, vl2, plx - (this.X[vl2] - 1))) return false;

    const vr2 = this.contour[ln.posR - 1];
    let prx = this.rayX(vr, rhoR, Ly);
    const d2 = Math.max(0, this.X[vr2] + 1 - prx);
    if (!this.stretch(vr2, vr, d2)) return false;
    prx += d2;

    const need = chain.length + 1;
    const d3 = Math.max(0, need - (prx - plx));
    if (!this.stretch(vl, vl2, d3)) return false;
    prx += d3;
    if (prx - plx < need) return this.fail('Platz fuer Kette fehlt (intern)');

    chain.forEach((z, t) => {
      this.X[z] = plx + 1 + t;
      this.Y[z] = Ly;
      this.placed[z] = true;
    });
    this.H = Ly;

    if (!this.drawEdge(vl, chain[0], 'blue', { x: plx, y: Ly })) return false;
    for (let t = 0; t + 1 < chain.length; t++)
      if (!this.drawEdge(chain[t], chain[t + 1], 'black', null)) return false;
    if (!this.drawEdge(vr, chain[chain.length - 1], 'green', { x: prx, y: Ly })) return false;

    this.usedTop[vl].add(rhoL);
    this.usedTop[vr].add(rhoR);
    this.spliceContour(ln.posL, ln.posR, chain);
    this.snapshot('chain', i, chain, this.newEdgeIds(chain));
    return true;
  }

  // ------------------------------------------------------------------
  // Fall 2: Singleton mit Untergrad > 2
  // ------------------------------------------------------------------
  case2(vg: number, i: number): boolean {
    const ln = this.lowerNeighbors([vg], i);
    if (!ln) return false;
    const q = ln.nbrs.length - 2;
    if (q < 1) return this.fail('Fall 2 mit Untergrad < 3');
    const vl = ln.nbrs[0];
    const vr = ln.nbrs[ln.nbrs.length - 1];
    const w = ln.nbrs.slice(1, ln.nbrs.length - 1); // w[0..q-1]

    // Horizontalabstaende zu w[q-1] auf Vielfache von D3 strecken
    // (von rechts nach links: jede Streckung verschiebt w[idx+1..q-1]
    // mitsamt kuenftiger v_g-Spalte, fixierte Abstaende bleiben).
    for (let idx = q - 2; idx >= 0; idx--) {
      const dx = this.X[w[q - 1]] - this.X[w[idx]];
      if (dx <= 0) return this.fail('Konturordnung verletzt (Fall 2)');
      const t = (this.D3 - (dx % this.D3)) % this.D3;
      const succ = this.contour[this.cpos(w[idx]) + 1];
      if (!this.stretch(w[idx], succ, t)) return false;
    }

    // y(v_g): kleinstes Vielfaches von k ueber allen Knick-Schranken
    const xg = this.X[w[q - 1]];
    let ymin = this.H + this.k;
    for (let idx = 0; idx <= q - 2; idx++) {
      const dx = xg - this.X[w[idx]];
      ymin = Math.max(ymin, this.H + 1 + (idx + 1) * (dx / this.D3));
    }
    const yg = Math.ceil(ymin / this.k) * this.k;

    this.X[vg] = xg;
    this.Y[vg] = yg;
    this.placed[vg] = true;

    // rote Kanten: vertikal an w_j, flach (idx+1)/D3 an v_g
    for (let idx = 0; idx <= q - 2; idx++) {
      const dx = xg - this.X[w[idx]];
      const by = yg - (idx + 1) * (dx / this.D3);
      if (!this.drawEdge(w[idx], vg, 'red', { x: this.X[w[idx]], y: by })) return false;
      this.usedTop[w[idx]].add(0);
    }
    if (!this.drawEdge(w[q - 1], vg, 'red', null)) return false;
    this.usedTop[w[q - 1]].add(0);
    this.H = yg;

    // blaue Kante (v_l -> v_g)
    const rhoL = this.pickRs(vl);
    if (rhoL === null) return this.fail('Kein freier Port an v_l (I.3?)');
    const plx = this.rayX(vl, rhoL, yg);
    const vl2 = this.contour[ln.posL + 1];
    if (!this.stretch(vl, vl2, plx - (this.X[vl2] - 1))) return false;
    if (!this.drawEdge(vl, vg, 'blue', { x: plx, y: yg })) return false;
    this.usedTop[vl].add(rhoL);

    // gruene Kante (v_r -> v_g)
    const rhoR = this.pickLs(vr);
    if (rhoR === null) return this.fail('Kein freier Port an v_r (I.3?)');
    let prx = this.rayX(vr, rhoR, yg);
    const vr2 = this.contour[ln.posR - 1];
    const d2 = Math.max(0, this.X[vr2] + 1 - prx);
    if (!this.stretch(vr2, vr, d2)) return false;
    prx += d2;
    if (!this.drawEdge(vr, vg, 'green', { x: prx, y: yg })) return false;
    this.usedTop[vr].add(rhoR);

    this.spliceContour(ln.posL, ln.posR, [vg]);
    this.snapshot('singleton', i, [vg], this.newEdgeIds([vg]), q);
    return true;
  }

  // Kanten dieses Schritts = gezeichnete Kanten an den neuen Knoten
  // (die Knoten wurden gerade erst platziert, aeltere Kanten scheiden aus).
  newEdgeIds(nodes: number[]): number[] {
    const set = new Set(nodes);
    const ids: number[] = [];
    this.recs.forEach((r, idx) => {
      if (r.drawn && (set.has(r.u) || set.has(r.v))) ids.push(idx);
    });
    return ids;
  }

  // ------------------------------------------------------------------
  // Ausrichtungs-Streckungen fuer die Wiedereinsetzungen (siehe C++):
  // muessen VOR dem Zeichnen der Sonderfall-Kante laufen, deren Bogen
  // ohne horizontales Segment spaetere Cuts versperrt. Der (v1,v2)-
  // Abstand wird ueber die erste Konturkante ausgerichtet: dieser Cut
  // verschiebt alles ausser v1 und erhaelt alle uebrigen Abstaende.
  // ------------------------------------------------------------------
  prepareReinserts(): boolean {
    if (this.specialVn) {
      const wl = this.skipA === this.vn ? this.skipB : this.skipA;
      const dx = this.X[wl] - this.X[this.vn];
      if (dx <= 0) return this.fail('Sonderfall: w_Delta nicht rechts von vn');
      const t = (this.D3 - (dx % this.D3)) % this.D3;
      const p = this.cpos(wl);
      if (p <= 0) return this.fail('Sonderfall: w_Delta nicht auf der Kontur');
      if (!this.stretch(this.contour[p - 1], wl, t)) return false;
    }
    const dx = this.X[this.v2] - this.X[this.v1];
    if (dx <= 0) return this.fail('v2 nicht rechts von v1 (intern)');
    const t = (this.D3 - (dx % this.D3)) % this.D3;
    if (this.contour.length < 2) return this.fail('Kontur zu kurz (intern)');
    return this.stretch(this.v1, this.contour[1], t);
  }

  reinsertSpecial(): boolean {
    const wl = this.skipA === this.vn ? this.skipB : this.skipA;
    const dx = this.X[wl] - this.X[this.vn];
    if (dx <= 0 || dx % this.D3 !== 0)
      return this.fail('Sonderfall: Ausrichtung fehlt (intern)');
    const by = this.Y[this.vn] + dx / this.D3;
    if (this.usedTop[wl].has(0)) return this.fail('Sonderfall: vertikaler Port belegt');
    if (!this.drawEdge(wl, this.vn, 'red', { x: this.X[wl], y: by })) return false;
    this.usedTop[wl].add(0);
    if (by > this.H) this.H = by;
    this.snapshot('special', this.order.parts.length - 1, [], [this.eid(wl, this.vn)]);
    return true;
  }

  reinsertBase(): boolean {
    const dx = this.X[this.v2] - this.X[this.v1];
    if (dx <= 0 || dx % this.D3 !== 0)
      return this.fail('Basiskante: Ausrichtung fehlt (intern)');
    const by = this.Y[this.v1] - dx / this.D3;
    if (!this.drawEdge(this.v1, this.v2, 'black', { x: this.X[this.v1], y: by })) return false;
    this.snapshot('closing', this.order.parts.length - 1, [], [this.eid(this.v1, this.v2)]);
    return true;
  }

  // ------------------------------------------------------------------
  run(): boolean {
    const parts = this.order.parts;
    const mparts = parts.length - 1;

    // Basis: v1, P1, v2 auf Zeile 0 (Kante (v1,v2) aufgeschoben)
    const p1 = parts[1].slice();
    if (!this.adj[p1[0]].includes(this.v1)) {
      if (!this.adj[p1[p1.length - 1]].includes(this.v1))
        return this.fail('P1 haengt nicht an v1');
      p1.reverse();
    }
    this.X[this.v1] = 0; this.Y[this.v1] = 0; this.placed[this.v1] = true;
    p1.forEach((z, t) => {
      this.X[z] = t + 1; this.Y[z] = 0; this.placed[z] = true;
    });
    this.X[this.v2] = p1.length + 1; this.Y[this.v2] = 0; this.placed[this.v2] = true;
    if (!this.drawEdge(this.v1, p1[0], 'black', null)) return false;
    for (let t = 0; t + 1 < p1.length; t++)
      if (!this.drawEdge(p1[t], p1[t + 1], 'black', null)) return false;
    if (!this.drawEdge(p1[p1.length - 1], this.v2, 'black', null)) return false;
    this.contour = [this.v1, ...p1, this.v2];
    this.H = 0;
    this.snapshot('base', 1, [this.v1, ...p1, this.v2],
      this.recs.map((r, i) => (r.drawn ? i : -1)).filter((i) => i >= 0));

    for (let i = 2; i <= mparts; i++) {
      const pt = parts[i];

      if (i === mparts && this.adj[this.vn].length === this.deltaEff) {
        // Sonderfall deg(vn) = Deff: rechteste Kante (w_Delta, vn) aufschieben
        this.specialVn = true;
        const ln = this.lowerNeighbors(pt, i);
        if (!ln) return false;
        this.skipA = ln.nbrs[ln.nbrs.length - 1];
        this.skipB = this.vn;
      }

      if (pt.length >= 2) {
        if (!this.case1(pt, i)) return false;
      } else {
        let lowdeg = 0;
        for (const y of this.adj[pt[0]]) {
          if (this.part[y] >= i) continue;
          if (pt[0] === this.skipA && y === this.skipB) continue;
          if (pt[0] === this.skipB && y === this.skipA) continue;
          lowdeg++;
        }
        if (!(lowdeg === 2 ? this.case1(pt, i) : this.case2(pt[0], i))) return false;
      }
      if (!this.coordGuard()) return false;
    }

    if (!this.prepareReinserts()) return false;
    if (!this.coordGuard()) return false;
    if (this.specialVn && !this.reinsertSpecial()) return false;
    return this.reinsertBase();
  }
}

function ekey(a: number, b: number): string {
  return Math.min(a, b) + ',' + Math.max(a, b);
}

function pairsOf(p: Array<[number, number, number]>): Array<[[number, number, number], [number, number, number]]> {
  const out: Array<[[number, number, number], [number, number, number]]> = [];
  for (let s = 0; s + 1 < p.length; s++) out.push([p[s], p[s + 1]]);
  return out;
}
