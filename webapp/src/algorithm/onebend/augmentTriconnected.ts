// Gradbeschraenkte Trikonnektivierungs-Augmentierung ueber Flaechen-
// Chorden (Korollar 2; Port von augment_triconnected_bounded aus
// planar_aug.cpp).
//
// Zu jedem Separationspaar {a,b} wird eine Chorde zwischen zwei Knoten
// VERSCHIEDENER Komponenten von G - {a,b} auf einer gemeinsamen Flaeche
// eingefuegt; a, b selbst sind nie Endpunkte (ihr Grad waechst nicht).
// Auswahl greedy: minimales max(deg), dann minimale Gradsumme. Die
// Einbettung wird ueber die Face-Corners fortgeschrieben (wie bei
// augmentBiconnected); Kanten erhalten aug = true.

import { isBiconnected } from '../augment';
import { isPlanarRotation, traverseFaces } from '../embedding';
import type { Dart, EmbeddedGraph } from '../types';

/**
 * Separationspaar eines bikonnektierten Graphen oder null (Brute-Force
 * wie LEDAs Is_Triconnected): fuer jeden Knoten x wird ein
 * Artikulationspunkt y von G - x gesucht.
 */
export function separationPair(eg: EmbeddedGraph): [number, number] | null {
  for (let x = 0; x < eg.n; x++) {
    const y = articulationWithout(eg, x);
    if (y !== null) return [x, y];
  }
  return null;
}

export function isTriconnected(eg: EmbeddedGraph): boolean {
  if (eg.n <= 3) return true; // Konvention wie LEDA
  if (!isBiconnected(eg)) return false;
  return separationPair(eg) === null;
}

/** Artikulationspunkt von G - skip (oder null, wenn G - skip bikonnektiert). */
function articulationWithout(eg: EmbeddedGraph, skip: number): number | null {
  const n = eg.n;
  const num = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const par = new Array<number>(n).fill(-1);
  let cnt = 0;
  let art: number | null = null;

  let start = -1;
  let V = 0;
  for (let u = 0; u < n; u++) if (u !== skip) { V++; if (start < 0) start = u; }
  if (V <= 2) return null;

  const stack: Array<{ u: number; i: number; children: number }> = [
    { u: start, i: 0, children: 0 },
  ];
  num[start] = low[start] = cnt++;
  while (stack.length && art === null) {
    const f = stack[stack.length - 1];
    const rot = eg.rot[f.u];
    if (f.i < rot.length) {
      const w = rot[f.i++].to;
      if (w === skip) continue;
      if (num[w] < 0) {
        par[w] = f.u;
        f.children++;
        num[w] = low[w] = cnt++;
        stack.push({ u: w, i: 0, children: 0 });
      } else if (w !== par[f.u]) {
        low[f.u] = Math.min(low[f.u], num[w]);
      }
    } else {
      stack.pop();
      if (par[f.u] < 0 && f.children >= 2) art = f.u;
      if (stack.length) {
        const p = stack[stack.length - 1];
        low[p.u] = Math.min(low[p.u], low[f.u]);
        if (par[p.u] >= 0 && low[f.u] >= num[p.u]) art = p.u;
      }
    }
  }
  if (art !== null) return art;
  if (cnt !== V) {
    // G - skip unzusammenhaengend: jeder Knoten einer anderen Komponente
    // bildet mit skip ein Separationspaar -- liefere irgendeinen Zeugen.
    for (let u = 0; u < n; u++) if (u !== skip && num[u] < 0) return u;
  }
  return null;
}

/** Komponenten von G - {a,b}; -1 fuer a, b. */
function componentsWithout(eg: EmbeddedGraph, a: number, b: number): { comp: number[]; count: number } {
  const comp = new Array<number>(eg.n).fill(-1);
  let count = 0;
  for (let s = 0; s < eg.n; s++) {
    if (s === a || s === b || comp[s] >= 0) continue;
    const queue = [s];
    comp[s] = count;
    for (let qi = 0; qi < queue.length; qi++) {
      for (const d of eg.rot[queue[qi]]) {
        const w = d.to;
        if (w === a || w === b || comp[w] >= 0) continue;
        comp[w] = count;
        queue.push(w);
      }
    }
    count++;
  }
  return { comp, count };
}

/**
 * Fuegt Flaechen-Chorden ein, bis der Graph 3-zusammenhaengend ist.
 * Vorbedingung: eg bikonnektiert (augmentBiconnected vorher ausfuehren).
 * Rueckgabe: Anzahl eingefuegter Kanten (aug=true), oder -1 bei Fehler.
 */
export function augmentTriconnected(eg: EmbeddedGraph): number {
  let added = 0;

  // n <= 3: zu K_n vervollstaendigen (3-Zusammenhang erst ab n >= 4 gehaltvoll)
  if (eg.n <= 3) {
    for (let u = 0; u < eg.n; u++)
      for (let w = u + 1; w < eg.n; w++) {
        if (eg.rot[u].some((d) => d.to === w)) continue;
        const eid = eg.edges.length;
        eg.edges.push({ u, v: w, aug: true });
        eg.rot[u].push({ e: eid, to: w });
        eg.rot[w].push({ e: eid, to: u });
        added++;
      }
    return added;
  }

  const maxRounds = eg.n * eg.n + 16;
  for (let round = 0; round < maxRounds; round++) {
    if (isTriconnected(eg)) return added;
    const pair = separationPair(eg);
    if (!pair) return -1; // nicht bikonnektiert?
    const [a, b] = pair;
    const { comp, count } = componentsWithout(eg, a, b);
    if (count < 2) return -1;

    // Chorde zwischen verschiedenen Komponenten auf gemeinsamer Flaeche;
    // a/b nie als Endpunkte.
    let best: { u: number; w: number; posU: number; posW: number } | null = null;
    let bestMax = Number.MAX_SAFE_INTEGER;
    let bestSum = Number.MAX_SAFE_INTEGER;
    for (const face of traverseFaces(eg)) {
      for (let i = 0; i < face.length; i++) {
        for (let j = i + 1; j < face.length; j++) {
          const u = face[i].v, w = face[j].v;
          if (u === w || u === a || u === b || w === a || w === b) continue;
          if (comp[u] === comp[w]) continue; // impliziert: nicht benachbart
          const du = eg.rot[u].length, dw = eg.rot[w].length;
          const mx = Math.max(du, dw), sm = du + dw;
          if (mx < bestMax || (mx === bestMax && sm < bestSum)) {
            bestMax = mx; bestSum = sm;
            best = { u, w, posU: face[i].insertPos, posW: face[j].insertPos };
          }
        }
      }
    }
    if (!best) return -1;

    const eid = eg.edges.length;
    eg.edges.push({ u: best.u, v: best.w, aug: true });
    const dartU: Dart = { e: eid, to: best.w };
    const dartW: Dart = { e: eid, to: best.u };
    eg.rot[best.u].splice(best.posU, 0, dartU);
    eg.rot[best.w].splice(best.posW, 0, dartW);
    if (!isPlanarRotation(eg)) return -1; // darf nach Konstruktion nicht passieren
    added++;
  }
  return -1;
}
