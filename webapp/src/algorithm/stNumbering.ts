// st-Nummerierung ueber eine offene Ohren-Dekomposition.
//
// Fuer bikonnektiertes G mit Kante (s,t) wird eine lineare Ordnung
// aufgebaut: Startzyklus durch (s,t), danach werden Ohren (Pfade mit
// verschiedenen Endpunkten a < b in der bisherigen Ordnung und neuen
// inneren Knoten) unmittelbar hinter a eingefuegt. Jeder innere Knoten
// erhaelt so einen kleineren und einen groesseren Nachbarn; s bleibt
// erster, t letzter Knoten. Laufzeit O(n*m) -- fuer Demogroessen genug.

import type { EmbeddedGraph } from './types';

/** Liefert st[v] in 1..n mit st[s]=1, st[t]=n. Vorbedingung: G bikonnektiert, (s,t) Kante. */
export function stNumbering(eg: EmbeddedGraph, s: number, t: number): number[] | null {
  const n = eg.n;
  if (n === 1) return [1];
  const adj: number[][] = Array.from({ length: n }, () => []);
  eg.edges.forEach((e) => { adj[e.u].push(e.v); adj[e.v].push(e.u); });

  // Startzyklus: Pfad s -> t ohne die Kante (s,t) selbst (BFS).
  const cyclePath = bfsPath(n, adj, s, t, (a, b) => !(a === s && b === t) && !(a === t && b === s));
  if (!cyclePath) return null;

  const order: number[] = [...cyclePath]; // s, ..., t
  const inH = new Array<boolean>(n).fill(false);
  for (const v of order) inH[v] = true;

  let remaining = n - order.length;
  while (remaining > 0) {
    // Kante (u,x) mit u in H, x nicht in H suchen
    let u = -1, x = -1;
    outer: for (let v = 0; v < n; v++) {
      if (!inH[v]) continue;
      for (const w of adj[v]) if (!inH[w]) { u = v; x = w; break outer; }
    }
    if (u < 0) return null; // unzusammenhaengend -- sollte nicht vorkommen

    // BFS von x durch Nicht-H-Knoten, u gemieden, bis irgendein H-Knoten w
    const earTail = bfsToH(n, adj, x, u, inH);
    if (!earTail) return null; // nicht bikonnektiert
    const w = earTail[earTail.length - 1]; // in H, != u
    const internal = earTail.slice(0, -1); // x, ..., letzter Nicht-H-Knoten

    // hinter dem frueheren der beiden Endpunkte einfuegen
    const pu = order.indexOf(u), pw = order.indexOf(w);
    const a = pu < pw ? u : w;
    const chain = a === u ? internal : [...internal].reverse();
    order.splice(order.indexOf(a) + 1, 0, ...chain);
    for (const v of internal) inH[v] = true;
    remaining -= internal.length;
  }

  const st = new Array<number>(n).fill(0);
  order.forEach((v, idx) => { st[v] = idx + 1; });
  return st;
}

function bfsPath(
  n: number, adj: number[][], from: number, to: number,
  edgeOk: (a: number, b: number) => boolean,
): number[] | null {
  const prev = new Array<number>(n).fill(-1);
  const seen = new Array<boolean>(n).fill(false);
  seen[from] = true;
  const queue = [from];
  while (queue.length) {
    const v = queue.shift()!;
    if (v === to) break;
    for (const w of adj[v]) {
      if (seen[w] || !edgeOk(v, w)) continue;
      seen[w] = true;
      prev[w] = v;
      queue.push(w);
    }
  }
  if (!seen[to]) return null;
  const path: number[] = [];
  for (let v = to; v !== -1; v = prev[v]) path.push(v);
  return path.reverse();
}

/** BFS von x ueber Nicht-H-Knoten (u gemieden) bis zu einem H-Knoten; liefert x..w. */
function bfsToH(
  n: number, adj: number[][], x: number, u: number, inH: boolean[],
): number[] | null {
  const prev = new Array<number>(n).fill(-1);
  const seen = new Array<boolean>(n).fill(false);
  seen[x] = true;
  seen[u] = true; // u meiden
  const queue = [x];
  let hit = -1;
  while (queue.length && hit < 0) {
    const v = queue.shift()!;
    for (const w of adj[v]) {
      if (seen[w]) continue;
      if (inH[w]) { prev[w] = v; hit = w; break; }
      seen[w] = true;
      prev[w] = v;
      queue.push(w);
    }
  }
  if (hit < 0) return null;
  const path: number[] = [];
  for (let v = hit; v !== -1; v = prev[v]) path.push(v);
  return path.reverse(); // x, ..., hit
}
