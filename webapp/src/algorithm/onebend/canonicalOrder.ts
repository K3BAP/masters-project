// Kanonische Ordnung 3-zusammenhaengender planarer Graphen per Reverse
// Peeling (Port von canonical_order.cpp).
//
// Eine kanonische Ordnung ist eine Partition Pi = (P_0, ..., P_m) der
// Knotenmenge in Pfade mit P_0 = {v1, v2}, P_m = {vn}, sodass (v1,v2)
// und (v1,vn) Aussenkanten sind und fuer i = 1..m-1 gilt:
//  (i)   G_i ist bikonnektiert, intern 3-zusammenhaengend und mit
//        C_i u {(v1,v2)} als Aussenflaeche eingebettet;
//  (ii)  alle Nachbarn von P_i in G_{i-1} liegen auf C_{i-1};
//  (iii) P_i ist Singleton oder Kette (alle Grade in G_i genau 2);
//  (iv)  jeder Knoten von P_i hat einen Nachbarn in P_j mit j > i.
//
// Der Schaelschritt validiert die Bedingungen direkt (Bikonnektivitaet,
// interner 3-Zusammenhang per Apex-Trick, (ii), (iv)-Filter); nach Kants
// Existenzlemma bleibt der Greedy dadurch nie stecken. checkCanonicalOrder
// prueft eine fertige Ordnung unabhaengig (Referee fuer die Tests).

import type { EmbeddedGraph } from '../types';

export interface CanonicalOrder {
  /** parts[0] = [v1, v2]; parts[parts.length-1] = [vn]; Ketten in Konturrichtung. */
  parts: number[][];
  v1: number;
  v2: number;
  vn: number;
}

// ---------------------------------------------------------------------
// Indexbasiertes Rotationssystem mit Alive-Maske
// ---------------------------------------------------------------------
interface Emb {
  n: number;
  rot: number[][]; // rot[u] = Nachbarindizes in Rotationsreihenfolge
  alive: boolean[];
}

function buildEmb(eg: EmbeddedGraph): Emb {
  return {
    n: eg.n,
    rot: eg.rot.map((r) => r.map((d) => d.to)),
    alive: new Array<boolean>(eg.n).fill(true),
  };
}

function degAlive(E: Emb, u: number): number {
  let d = 0;
  for (const w of E.rot[u]) if (E.alive[w]) d++;
  return d;
}

function adjacent(E: Emb, u: number, v: number): boolean {
  return E.rot[u].includes(v);
}

/**
 * Flaechen-Nachfolger des Darts (u->v) im lebendig-induzierten Graphen:
 * an v den Eintrag u suchen, dann zyklischer Nachfolger (Konvention wie
 * traverseFaces in embedding.ts; tote Nachbarn werden uebersprungen).
 */
function faceSucc(E: Emb, u: number, v: number): [number, number] | null {
  const rv = E.rot[v];
  const L = rv.length;
  const p = rv.indexOf(u);
  if (p < 0) return null;
  for (let step = 1; step <= L; step++) {
    const q = (p + step) % L;
    if (E.alive[rv[q]]) return [v, rv[q]];
  }
  return null;
}

/** Flaechenwalk ab Dart (a->b); liefert die Quellknoten der Darts. */
function faceWalk(E: Emb, a: number, b: number): number[] | null {
  if (!E.alive[a] || !E.alive[b]) return null;
  let limit = 8;
  for (let u = 0; u < E.n; u++) limit += E.rot[u].length;
  const walk: number[] = [];
  let u = a, v = b;
  let guard = 0;
  do {
    walk.push(u);
    const nxt = faceSucc(E, u, v);
    if (!nxt) return null;
    [u, v] = nxt;
    if (++guard > limit) return null;
  } while (u !== a || v !== b);
  return walk;
}

// ---------------------------------------------------------------------
// Bikonnektivitaet des induzierten Graphen (ohne skip); optional mit
// Apex-Knoten (Id n), der mit allen markierten Knoten verbunden ist.
// ---------------------------------------------------------------------
function inducedBiconnected(E: Emb, skip: number, apexMask: boolean[] | null): boolean {
  let V = 0;
  let start = -1;
  for (let u = 0; u < E.n; u++)
    if (E.alive[u] && u !== skip) { V++; if (start < 0) start = u; }
  if (apexMask) V++;
  if (V <= 1) return true;

  const num = new Array<number>(E.n + 1).fill(-1);
  const low = new Array<number>(E.n + 1).fill(0);
  const par = new Array<number>(E.n + 1).fill(-1);
  let cnt = 0;
  let hasArt = false;

  const nbrs = (u: number): number[] => {
    if (u === E.n) {
      const out: number[] = [];
      for (let w = 0; w < E.n; w++) if (apexMask![w]) out.push(w);
      return out;
    }
    const out: number[] = [];
    for (const w of E.rot[u]) if (E.alive[w] && w !== skip) out.push(w);
    if (apexMask && apexMask[u]) out.push(E.n);
    return out;
  };

  const dfs = (root: number) => {
    // iterativ (explizite Frames), um Rekursionstiefe zu vermeiden
    const stack: Array<{ u: number; nb: number[]; i: number; children: number }> = [
      { u: root, nb: nbrs(root), i: 0, children: 0 },
    ];
    num[root] = low[root] = cnt++;
    while (stack.length && !hasArt) {
      const f = stack[stack.length - 1];
      if (f.i < f.nb.length) {
        const w = f.nb[f.i++];
        if (num[w] < 0) {
          par[w] = f.u;
          f.children++;
          num[w] = low[w] = cnt++;
          stack.push({ u: w, nb: nbrs(w), i: 0, children: 0 });
        } else if (w !== par[f.u]) {
          low[f.u] = Math.min(low[f.u], num[w]);
        }
      } else {
        stack.pop();
        if (par[f.u] < 0 && f.children >= 2) hasArt = true;
        if (stack.length) {
          const p = stack[stack.length - 1];
          low[p.u] = Math.min(low[p.u], low[f.u]);
          if (par[p.u] >= 0 && low[f.u] >= num[p.u]) hasArt = true;
        }
      }
    }
  };
  dfs(start);
  return !hasArt && cnt === V;
}

/**
 * Intern 3-zusammenhaengend: Apex an alle Aussenzyklus-Knoten ergibt
 * einen 3-zusammenhaengenden Graphen (Brute-Force wie LEDA).
 */
function internallyTriconnectedEmb(E: Emb, outer: number[]): boolean {
  let N = 0;
  for (let u = 0; u < E.n; u++) if (E.alive[u]) N++;
  if (N + 1 <= 3) return true;
  if (!inducedBiconnected(E, -1, null)) return false;
  const apexMask = new Array<boolean>(E.n).fill(false);
  for (const u of outer) if (E.alive[u]) apexMask[u] = true;
  for (let x = 0; x < E.n; x++) {
    if (!E.alive[x]) continue;
    const mask = apexMask.slice();
    mask[x] = false;
    if (!inducedBiconnected(E, x, mask)) return false;
  }
  return true;
}

/** Kontur [v1 ... v2] aus dem Aussenwalk ab Anker-Dart (simpel gefordert). */
function contourOf(E: Emb, aOut: number, bOut: number, v1: number, v2: number): number[] | null {
  const walk = faceWalk(E, aOut, bOut);
  if (!walk || walk.length < 2) return null;
  if (new Set(walk).size !== walk.length) return null;
  const C: number[] = [v1];
  if (aOut === v1) {
    // Zyklus v1 -> v2 -> x -> ... -> z -> v1; Kontur = v1, z, ..., x, v2
    for (let j = walk.length - 1; j >= 2; j--) C.push(walk[j]);
  } else {
    // Zyklus v2 -> v1 -> x -> ... -> z -> v2; Kontur = v1, x, ..., z, v2
    for (let j = 2; j < walk.length; j++) C.push(walk[j]);
  }
  C.push(v2);
  return C;
}

// ---------------------------------------------------------------------
// Reverse Peeling
// ---------------------------------------------------------------------
class Peeler {
  E: Emb;
  peeledNbrs: number[];
  v1: number; v2: number; vn: number;
  aOut: number; bOut: number;
  partsRev: number[][] = [];
  error = '';

  constructor(E: Emb, v1: number, v2: number, vn: number, aOut: number, bOut: number) {
    this.E = { n: E.n, rot: E.rot, alive: E.alive.slice() };
    this.peeledNbrs = new Array<number>(E.n).fill(0);
    this.v1 = v1; this.v2 = v2; this.vn = vn;
    this.aOut = aOut; this.bOut = bOut;
  }

  contour(): number[] | null {
    return contourOf(this.E, this.aOut, this.bOut, this.v1, this.v2);
  }

  tryRemove(part: number[], first: boolean): boolean {
    if (!first) for (const z of part) if (this.peeledNbrs[z] === 0) return false;
    for (const z of part) this.E.alive[z] = false;

    let ok = true;
    const C = this.contour();
    if (!C) ok = false;
    if (ok && !inducedBiconnected(this.E, -1, null)) ok = false;
    if (ok && !internallyTriconnectedEmb(this.E, C!)) ok = false;
    if (ok) {
      // (ii): lebendige Nachbarn des Teils liegen auf der neuen Kontur
      const onC = new Set(C!);
      outer: for (const z of part) {
        for (const y of this.E.rot[z]) {
          if (this.E.alive[y] && !onC.has(y)) { ok = false; break outer; }
        }
      }
    }
    if (!ok) {
      for (const z of part) this.E.alive[z] = true;
      return false;
    }
    for (const z of part)
      for (const y of this.E.rot[z]) if (this.E.alive[y]) this.peeledNbrs[y]++;
    this.partsRev.push(part);
    return true;
  }

  isCycle(): boolean {
    for (let u = 0; u < this.E.n; u++)
      if (this.E.alive[u] && degAlive(this.E, u) !== 2) return false;
    return true;
  }

  run(): boolean {
    if (!this.tryRemove([this.vn], true)) {
      this.error = 'vn nicht als erster Singleton schaelbar';
      return false;
    }
    while (!this.isCycle()) {
      const C = this.contour();
      if (!C) { this.error = 'Kontur inkonsistent'; return false; }
      let progressed = false;
      // Ketten: maximale Laeufe innerer Konturknoten mit Grad 2
      for (let j = 1; j + 1 < C.length && !progressed; j++) {
        if (degAlive(this.E, C[j]) !== 2) continue;
        let k2 = j;
        const run1: number[] = [];
        while (k2 + 1 < C.length && degAlive(this.E, C[k2]) === 2) {
          run1.push(C[k2]);
          k2++;
        }
        if (this.tryRemove(run1, false)) progressed = true;
        else j = k2 - 1; // hinter den Lauf springen
      }
      // Singletons (Grad >= 3)
      for (let j = 1; j + 1 < C.length && !progressed; j++) {
        if (degAlive(this.E, C[j]) < 3) continue;
        if (this.tryRemove([C[j]], false)) progressed = true;
      }
      if (!progressed) { this.error = 'Kein legaler Schaelschritt'; return false; }
    }
    const C = this.contour();
    if (!C || C.length < 3) { this.error = 'Restzyklus inkonsistent'; return false; }
    this.partsRev.push(C.slice(1, C.length - 1));
    return true;
  }
}

// ---------------------------------------------------------------------
// Berechnung
// ---------------------------------------------------------------------
export function computeCanonicalOrder(
  eg: EmbeddedGraph,
): { order?: CanonicalOrder; error?: string } {
  const n = eg.n;
  if (n < 3) return { error: 'Kanonische Ordnung braucht n >= 3.' };
  const E0 = buildEmb(eg);

  if (n === 3) {
    const order: CanonicalOrder = { parts: [[0, 1], [2]], v1: 0, v2: 1, vn: 2 };
    const err = checkCanonicalOrder(eg, order);
    return err ? { error: err } : { order };
  }

  let mind = Infinity;
  for (let u = 0; u < n; u++) mind = Math.min(mind, E0.rot[u].length);

  let lastError = '';
  for (let u = 0; u < n; u++) {
    if (E0.rot[u].length !== mind) continue;
    for (const x of E0.rot[u]) {
      const F = faceWalk(E0, u, x);
      if (!F || F.length < 3) continue;
      const L = F.length;
      for (let dir = 0; dir < 2; dir++) {
        const v1 = dir === 0 ? F[1] : F[L - 1];
        const v2 = dir === 0 ? F[2] : F[L - 2];
        const aOut = dir === 0 ? v1 : v2;
        const bOut = dir === 0 ? v2 : v1;
        if (v1 === u || v2 === u || v1 === v2) continue;
        const P = new Peeler(E0, v1, v2, u, aOut, bOut);
        if (!P.run()) { if (!lastError) lastError = P.error; continue; }
        const parts: number[][] = [[v1, v2]];
        for (let i = P.partsRev.length - 1; i >= 0; i--) parts.push(P.partsRev[i]);
        const order: CanonicalOrder = { parts, v1, v2, vn: u };
        const cerr = checkCanonicalOrder(eg, order);
        if (!cerr) return { order };
        lastError = 'Checker lehnt Ordnung ab: ' + cerr;
      }
    }
  }
  return { error: lastError || 'Keine kanonische Ordnung gefunden.' };
}

// ---------------------------------------------------------------------
// Checker: validiert (i)-(iv) unabhaengig von der Berechnung
// ---------------------------------------------------------------------
export function checkCanonicalOrder(eg: EmbeddedGraph, order: CanonicalOrder): string | null {
  const n = eg.n;
  const { parts, v1, v2, vn } = order;
  const m = parts.length - 1;
  if (m < 1) return 'Ordnung hat weniger als zwei Teile.';

  const E = buildEmb(eg);

  // Partition + Teilindex
  const pidx = new Array<number>(n).fill(-1);
  for (let i = 0; i <= m; i++) {
    if (parts[i].length === 0) return 'Leerer Teil.';
    for (const u of parts[i]) {
      if (pidx[u] !== -1) return 'Knoten mehrfach in der Partition.';
      pidx[u] = i;
    }
  }
  for (let u = 0; u < n; u++) if (pidx[u] < 0) return 'Knoten fehlt in der Partition.';

  if (parts[0].length !== 2 ||
      !((parts[0][0] === v1 && parts[0][1] === v2) ||
        (parts[0][0] === v2 && parts[0][1] === v1))) return 'P_0 != {v1, v2}.';
  if (parts[m].length !== 1 || parts[m][0] !== vn) return 'P_m != {vn}.';
  if (!adjacent(E, v1, v2)) return 'Kante (v1,v2) fehlt.';
  if (!adjacent(E, v1, vn)) return 'Kante (v1,vn) fehlt.';

  // Aussenflaeche: einer der beiden Walks an (v1,v2) muss auch die Kante
  // (v1,vn) enthalten (vn konsekutiv zu v1).
  let aOut = -1, bOut = -1;
  for (const [a, b] of [[v1, v2], [v2, v1]] as Array<[number, number]>) {
    const F = faceWalk(E, a, b);
    if (!F) continue;
    const L = F.length;
    for (let j = 0; j < L; j++) {
      const x = F[j], y = F[(j + 1) % L];
      if ((x === v1 && y === vn) || (x === vn && y === v1)) { aOut = a; bOut = b; break; }
    }
    if (aOut >= 0) break;
  }
  if (aOut < 0) return '(v1,v2) und (v1,vn) liegen auf keiner gemeinsamen Flaeche.';

  // Levelweise Pruefung
  E.alive.fill(false);
  E.alive[v1] = E.alive[v2] = true;
  let Cprev: number[] = [v1, v2];

  for (let i = 1; i <= m; i++) {
    // (ii) vor der Aktivierung
    const onC = new Set(Cprev);
    for (const z of parts[i]) {
      for (const y of E.rot[z]) {
        if (E.alive[y] && !onC.has(y))
          return `(ii) verletzt: Nachbar von P_${i} nicht auf C_${i - 1}.`;
      }
    }
    for (const z of parts[i]) E.alive[z] = true;

    // (iii)
    if (parts[i].length >= 2) {
      for (let a = 0; a < parts[i].length; a++) {
        if (degAlive(E, parts[i][a]) !== 2)
          return `(iii) verletzt: Kettenknoten in P_${i} hat Grad != 2.`;
        if (a + 1 < parts[i].length && !adjacent(E, parts[i][a], parts[i][a + 1]))
          return `P_${i} ist kein Pfad.`;
      }
    }

    const C = contourOf(E, aOut, bOut, v1, v2);
    if (!C) return `Aussenzyklus von G_${i} nicht simpel.`;

    if (i <= m - 1) {
      if (!inducedBiconnected(E, -1, null))
        return `(i) verletzt: G_${i} nicht bikonnektiert.`;
      if (!internallyTriconnectedEmb(E, C))
        return `(i) verletzt: G_${i} nicht intern 3-zusammenhaengend.`;
      for (const z of parts[i]) {
        let later = false;
        for (const y of E.rot[z]) if (pidx[y] > i) { later = true; break; }
        if (!later) return `(iv) verletzt: Knoten in P_${i} ohne spaeteren Nachbarn.`;
      }
    }
    Cprev = C;
  }
  return null;
}
