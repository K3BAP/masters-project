// Gradbeschraenkte Bikonnektivitaets-Augmentierung auf dem Rotationssystem
// (Weiterentwicklung von augment_biconnected_bounded aus slopes_core.cpp:
// statt nur rotationsbenachbarter Nachbarn eines Schnittknotens werden
// beliebige Flaechen-Chorden zugelassen -- das vermeidet erzwungene
// Gradanhaeufungen, z.B. bei Spinnen-Baeumen, und haelt den
// Maximalgradzuwachs bei <= 2 wie von Korollar 5 vorausgesetzt).

import { isPlanarRotation, traverseFaces } from './embedding';
import type { Dart, EmbeddedGraph } from './types';

/** Kanten-Ids der Bloecke (biconnected components); -1sind Schnittknoten moeglich. */
export function biconnectedComponents(eg: EmbeddedGraph): { comp: number[]; cutVertices: Set<number> } {
  const n = eg.n;
  const adj: Array<Array<{ e: number; to: number }>> = Array.from({ length: n }, () => []);
  eg.edges.forEach((e, idx) => {
    adj[e.u].push({ e: idx, to: e.v });
    adj[e.v].push({ e: idx, to: e.u });
  });

  const comp = new Array<number>(eg.edges.length).fill(-1);
  const cutVertices = new Set<number>();
  const disc = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const edgeStack: number[] = [];
  let time = 0;
  let compCount = 0;

  for (let root = 0; root < n; root++) {
    if (disc[root] !== -1) continue;
    // iterative DFS
    const stack: Array<{ v: number; parentEdge: number; iter: number; children: number }> = [
      { v: root, parentEdge: -1, iter: 0, children: 0 },
    ];
    disc[root] = low[root] = time++;
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const v = frame.v;
      if (frame.iter < adj[v].length) {
        const { e, to } = adj[v][frame.iter++];
        if (e === frame.parentEdge) continue;
        if (disc[to] === -1) {
          edgeStack.push(e);
          disc[to] = low[to] = time++;
          frame.children++;
          stack.push({ v: to, parentEdge: e, iter: 0, children: 0 });
        } else if (disc[to] < disc[v] && comp[e] === -1) {
          edgeStack.push(e);
          low[v] = Math.min(low[v], disc[to]);
        }
      } else {
        stack.pop();
        if (stack.length) {
          const parent = stack[stack.length - 1];
          const p = parent.v;
          low[p] = Math.min(low[p], low[v]);
          if (low[v] >= disc[p]) {
            // Block unterhalb von p abschliessen; p ist Schnittknoten,
            // sofern p nicht Wurzel mit nur einem Kind ist.
            if (p !== root || parent.children > 1) cutVertices.add(p);
            let e;
            do {
              e = edgeStack.pop()!;
              comp[e] = compCount;
            } while (e !== frame.parentEdge);
            compCount++;
          }
        }
      }
    }
  }
  return { comp, cutVertices };
}

export function isBiconnected(eg: EmbeddedGraph): boolean {
  if (eg.n < 3) return true;
  const { comp, cutVertices } = biconnectedComponents(eg);
  if (cutVertices.size > 0) return false;
  return comp.every((c) => c === comp[0]);
}

/**
 * Fuegt Flaechen-Chorden ein, bis der Graph bikonnektiert ist
 * (Kant-Bodlaender-Stil). Zwei Knoten u, w derselben Flaeche, die in
 * keinem gemeinsamen Block liegen, koennen planar verbunden werden und
 * verschmelzen Bloecke. Die Auswahl minimiert max(deg(u), deg(w)) --
 * dadurch bleibt der Maximalgradzuwachs klein (Ziel: <= 2), was die
 * Steigungsschranke von Korollar 5 sichert. Der Verifier misst dies nach.
 *
 * Rueckgabe: Anzahl eingefuegter Kanten (aug=true), oder -1 bei Fehler.
 */
export function augmentBiconnected(eg: EmbeddedGraph): number {
  if (eg.n < 3) return 0;
  let added = 0;
  const maxRounds = eg.n + eg.edges.length + 8;
  for (let round = 0; round < maxRounds; round++) {
    if (isBiconnected(eg)) return added;
    const { comp } = biconnectedComponents(eg);

    // Block-Mengen pro Knoten und Adjazenzmenge
    const blocksOf: Array<Set<number>> = Array.from({ length: eg.n }, () => new Set());
    const adjacent = new Set<string>();
    eg.edges.forEach((e, idx) => {
      blocksOf[e.u].add(comp[idx]);
      blocksOf[e.v].add(comp[idx]);
      adjacent.add(edgeKey(e.u, e.v));
    });

    // beste Flaechen-Chorde suchen
    let best: { u: number; w: number; posU: number; posW: number } | null = null;
    let bestMax = Number.MAX_SAFE_INTEGER;
    let bestSum = Number.MAX_SAFE_INTEGER;
    for (const face of traverseFaces(eg)) {
      for (let a = 0; a < face.length; a++) {
        for (let b = a + 1; b < face.length; b++) {
          const u = face[a].v, w = face[b].v;
          if (u === w || adjacent.has(edgeKey(u, w))) continue;
          if (sharesBlock(blocksOf[u], blocksOf[w])) continue;
          const du = eg.rot[u].length, dw = eg.rot[w].length;
          const mx = Math.max(du, dw), sm = du + dw;
          if (mx < bestMax || (mx === bestMax && sm < bestSum)) {
            bestMax = mx; bestSum = sm;
            best = { u, w, posU: face[a].insertPos, posW: face[b].insertPos };
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

function edgeKey(a: number, b: number): string {
  return Math.min(a, b) + ',' + Math.max(a, b);
}

function sharesBlock(a: Set<number>, b: Set<number>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}
