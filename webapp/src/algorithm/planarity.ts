// Planaritaetstest mit Einbettungsberechnung nach Demoucron, Malgrange,
// Pertuiset (O(n^2)) -- das Browser-Pendant zu LEDAs PLANAR(G, true).
//
// Pro Block (bikonnektierte Komponente): Startzyklus einbetten, dann
// wiederholt ein Fragment (Bruecke) waehlen und einen Pfad davon in eine
// zulaessige Flaeche einsetzen. Hat ein Fragment keine zulaessige
// Flaeche, ist der Graph nicht planar (Satz von Demoucron: die greedy
// Wahl -- Fragmente mit genau einer zulaessigen Flaeche zuerst -- fuehrt
// bei planaren Graphen immer zum Ziel). Blöcke werden an Schnittknoten
// durch Konkatenation der Rotationen zusammengesetzt.

import { biconnectedComponents } from './augment';
import { isPlanarRotation, traverseFaces } from './embedding';
import type { Dart, EmbeddedGraph } from './types';

/**
 * Berechnet eine kombinatorische planare Einbettung (Rotationssystem)
 * fuer einen zusammenhaengenden, schlichten Graphen.
 * Rueckgabe null, falls der Graph nicht planar ist.
 */
export function planarEmbedding(
  n: number,
  edgesIn: Array<[number, number]>,
): EmbeddedGraph | null {
  const eg: EmbeddedGraph = {
    n,
    edges: edgesIn.map(([u, v]) => ({ u, v, aug: false })),
    rot: Array.from({ length: n }, () => []),
  };
  if (edgesIn.length === 0) return eg;

  // Schneller notwendiger Test: planare Graphen haben m <= 3n - 6
  if (n >= 3 && edgesIn.length > 3 * n - 6) return null;

  // Blockzerlegung (biconnectedComponents nutzt nur eg.edges)
  const { comp } = biconnectedComponents(eg);
  const blockIds = [...new Set(comp)];

  for (const b of blockIds) {
    const gids: number[] = [];
    comp.forEach((c, e) => { if (c === b) gids.push(e); });
    const local = gids.map((g) => [eg.edges[g].u, eg.edges[g].v] as [number, number]);
    const rotLocal = embedBlock(n, local);
    if (!rotLocal) return null;
    // Rotationen des Blocks als zusammenhaengende Gruppe anhaengen
    // (Bloecke teilen sich nur Schnittknoten; Konkatenation ist planar).
    for (let v = 0; v < n; v++) {
      for (const d of rotLocal[v]) {
        eg.rot[v].push({ e: gids[d.e], to: d.to });
      }
    }
  }

  // Sicherheitsnetz: Euler-Genus-Pruefung des Gesamtsystems
  if (!isPlanarRotation(eg)) return null;
  return eg;
}

// ---------------------------------------------------------------------
// Demoucron fuer einen einzelnen Block (lokale Kanten-Ids)
// ---------------------------------------------------------------------
function embedBlock(n: number, local: Array<[number, number]>): Dart[][] | null {
  const eg: EmbeddedGraph = {
    n,
    edges: local.map(([u, v]) => ({ u, v, aug: false })),
    rot: Array.from({ length: n }, () => []),
  };
  const m = local.length;

  if (m === 1) {
    const [u, v] = local[0];
    eg.rot[u].push({ e: 0, to: v });
    eg.rot[v].push({ e: 0, to: u });
    return eg.rot;
  }

  // Adjazenz des Blocks
  const adj: Array<Array<{ e: number; to: number }>> = Array.from({ length: n }, () => []);
  local.forEach(([u, v], e) => {
    adj[u].push({ e, to: v });
    adj[v].push({ e, to: u });
  });

  // 1) Startzyklus per DFS finden und einbetten
  const cycle = findCycle(n, adj, local[0][0]);
  if (!cycle) return null; // Block mit m >= 2 hat immer einen Zyklus
  const embedded = new Array<boolean>(m).fill(false);
  const inH = new Array<boolean>(n).fill(false);
  const len = cycle.verts.length;
  for (let i = 0; i < len; i++) {
    const v = cycle.verts[i];
    const nextV = cycle.verts[(i + 1) % len];
    const prevV = cycle.verts[(i - 1 + len) % len];
    eg.rot[v].push({ e: cycle.edges[i], to: nextV });
    eg.rot[v].push({ e: cycle.edges[(i - 1 + len) % len], to: prevV });
    embedded[cycle.edges[i]] = true;
    inH[v] = true;
  }

  // 2) Fragmente nacheinander einsetzen
  let remaining = m - len;
  let guard = 0;
  while (remaining > 0) {
    if (++guard > m + 2) return null; // Endlosschleifen-Schutz (intern)

    const fragments = computeFragments(local, adj, embedded, inH);
    const faces = traverseFaces(eg);
    const faceVerts = faces.map((f) => new Set(f.map((c) => c.v)));

    // Zulaessige Flaechen je Fragment; Fragment ohne zulaessige Flaeche => nicht planar
    let chosen = -1;
    let chosenFace = -1;
    for (let fi = 0; fi < fragments.length; fi++) {
      const adm: number[] = [];
      for (let k = 0; k < faces.length; k++) {
        let all = true;
        for (const a of fragments[fi].attachments) {
          if (!faceVerts[k].has(a)) { all = false; break; }
        }
        if (all) adm.push(k);
      }
      if (adm.length === 0) return null;                    // nicht planar
      if (adm.length === 1) { chosen = fi; chosenFace = adm[0]; break; }
      if (chosen < 0) { chosen = fi; chosenFace = adm[0]; }
    }
    if (chosen < 0) return null;

    // Pfad durch das Fragment zwischen zwei Anlagerungsknoten suchen
    const frag = fragments[chosen];
    const path = fragmentPath(n, adj, frag, inH);
    if (!path) return null;

    // Pfad in die Flaeche einsetzen
    const face = faces[chosenFace];
    const a = path.verts[0];
    const w = path.verts[path.verts.length - 1];
    const ca = face.find((c) => c.v === a);
    const cw = face.find((c) => c.v === w);
    if (!ca || !cw) return null;
    eg.rot[a].splice(ca.insertPos, 0, { e: path.edges[0], to: path.verts[1] });
    eg.rot[w].splice(cw.insertPos, 0, {
      e: path.edges[path.edges.length - 1],
      to: path.verts[path.verts.length - 2],
    });
    for (let i = 1; i + 1 < path.verts.length; i++) {
      const v = path.verts[i];
      eg.rot[v].push({ e: path.edges[i - 1], to: path.verts[i - 1] });
      eg.rot[v].push({ e: path.edges[i], to: path.verts[i + 1] });
      inH[v] = true;
    }
    for (const e of path.edges) { embedded[e] = true; remaining--; }
  }

  return eg.rot;
}

interface Fragment {
  edges: number[];
  attachments: number[];
}

/**
 * Fragmente (Bruecken) bzgl. des eingebetteten Teilgraphen H: zwei nicht
 * eingebettete Kanten gehoeren zusammen, wenn sie ueber Nicht-H-Knoten
 * verbunden sind; Chorden (beide Enden in H) sind Einzelfragmente.
 */
function computeFragments(
  local: Array<[number, number]>,
  adj: Array<Array<{ e: number; to: number }>>,
  embedded: boolean[],
  inH: boolean[],
): Fragment[] {
  const m = local.length;
  const fragOf = new Array<number>(m).fill(-1);
  const fragments: Fragment[] = [];

  for (let e0 = 0; e0 < m; e0++) {
    if (embedded[e0] || fragOf[e0] !== -1) continue;
    const edges: number[] = [];
    const attachments = new Set<number>();
    const stack = [e0];
    fragOf[e0] = fragments.length;
    while (stack.length) {
      const e = stack.pop()!;
      edges.push(e);
      for (const v of local[e]) {
        if (inH[v]) { attachments.add(v); continue; }
        for (const { e: e2 } of adj[v]) {
          if (!embedded[e2] && fragOf[e2] === -1) {
            fragOf[e2] = fragments.length;
            stack.push(e2);
          }
        }
      }
    }
    fragments.push({ edges, attachments: [...attachments] });
  }
  return fragments;
}

/**
 * Pfad von einem Anlagerungsknoten durch das Fragmentinnere zu einem
 * anderen Anlagerungsknoten (BFS; H-Knoten nur als Endpunkte).
 */
function fragmentPath(
  n: number,
  adj: Array<Array<{ e: number; to: number }>>,
  frag: Fragment,
  inH: boolean[],
): { verts: number[]; edges: number[] } | null {
  const inFrag = new Set(frag.edges);
  const a = frag.attachments[0];
  const prevV = new Array<number>(n).fill(-1);
  const prevE = new Array<number>(n).fill(-1);
  const seen = new Array<boolean>(n).fill(false);
  seen[a] = true;
  const queue = [a];
  let hit = -1;
  while (queue.length && hit < 0) {
    const v = queue.shift()!;
    if (v !== a && inH[v]) continue; // H-Knoten nicht durchqueren
    for (const { e, to } of adj[v]) {
      if (!inFrag.has(e) || seen[to]) continue;
      seen[to] = true;
      prevV[to] = v;
      prevE[to] = e;
      if (inH[to]) { hit = to; break; }
      queue.push(to);
    }
  }
  if (hit < 0) return null;
  const verts: number[] = [];
  const edges: number[] = [];
  for (let v = hit; v !== -1; v = prevV[v]) {
    verts.push(v);
    if (prevE[v] !== -1) edges.push(prevE[v]);
  }
  verts.reverse();
  edges.reverse();
  return { verts, edges };
}

/** Irgendeinen Zyklus im Block finden (DFS mit Rueckkante). */
function findCycle(
  n: number,
  adj: Array<Array<{ e: number; to: number }>>,
  start: number,
): { verts: number[]; edges: number[] } | null {
  const parentV = new Array<number>(n).fill(-1);
  const parentE = new Array<number>(n).fill(-1);
  const state = new Array<number>(n).fill(0); // 0 = neu, 1 = offen, 2 = fertig
  const stack: Array<{ v: number; iter: number }> = [{ v: start, iter: 0 }];
  state[start] = 1;
  while (stack.length) {
    const frame = stack[stack.length - 1];
    const v = frame.v;
    if (frame.iter < adj[v].length) {
      const { e, to } = adj[v][frame.iter++];
      if (e === parentE[v]) continue;
      if (state[to] === 1) {
        // Rueckkante (v -> to): Zyklus v -> parent -> ... -> to -> v.
        // Aufsammeln ergibt direkt edges[i] zwischen verts[i], verts[i+1]:
        // parentE[x] verbindet x mit parentV[x]; die Rueckkante schliesst
        // von to (letzter Knoten) zurueck zu v (erster Knoten).
        const verts: number[] = [];
        const edges: number[] = [];
        let x = v;
        while (x !== to) {
          verts.push(x);
          edges.push(parentE[x]);
          x = parentV[x];
        }
        verts.push(to);
        edges.push(e);
        return { verts, edges };
      }
      if (state[to] === 0) {
        state[to] = 1;
        parentV[to] = v;
        parentE[to] = e;
        stack.push({ v: to, iter: 0 });
      }
    } else {
      state[v] = 2;
      stack.pop();
    }
  }
  return null;
}
