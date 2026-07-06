// Orchestrierung des 1-Bend-Algorithmus (Pendant zu
// compute_onebend_drawing): Einbettung -> Bikonnektivierung ->
// Trikonnektivierung (Korollar 2) -> kanonische Ordnung -> Zeichnung ->
// Verifikation. Wiederverwendet werden validateInput/buildEmbedding,
// die Demoucron-Planarisierung und augmentBiconnected aus dem
// Theorem-4-Modul.

import { augmentBiconnected } from '../augment';
import { buildEmbedding, validateInput } from '../embedding';
import { planarEmbedding } from '../planarity';
import type { EmbeddedGraph, InputGraph } from '../types';
import { augmentTriconnected } from './augmentTriconnected';
import { computeCanonicalOrder } from './canonicalOrder';
import { drawOneBend } from './drawing';
import { emptyOneBendStats, type OneBendResult } from './types';
import { verifyOneBendDrawing } from './verifier';

export interface OneBendOptions {
  /**
   * Manuelles k (Zeilenabstand / steile Steigungen +-k/j). Muss ganzzahlig
   * und mindestens deltaEff - 2 sein, damit die steilen Steigungen k/j > 1
   * bleiben und nicht mit den flachen j/(deltaEff-3) < 1 kollidieren.
   * Ohne Angabe gilt die Papier-Wahl k = 4 * deltaEff * n^2 (Flaechenbeweis).
   */
  k?: number;
}

/** Obergrenze fuer manuelles k (haelt alle Rechnungen im exakten Bereich). */
export const K_MAX = 1_000_000_000;

export function computeOneBendDrawing(
  input: InputGraph,
  options?: OneBendOptions,
): OneBendResult {
  const failed = (error: string): OneBendResult => ({
    ok: false, error, pos: [], edges: [], polylines: [], colors: [],
    part: [], v1: -1, v2: -1, vn: -1, stats: emptyOneBendStats(), snapshots: [],
  });

  if (input.n === 0) return failed('Leerer Graph.');
  if (input.n === 1) {
    return {
      ok: true, pos: [{ x: 0, y: 0 }], edges: [], polylines: [], colors: [],
      part: [0], v1: 0, v2: 0, vn: 0,
      stats: { ...emptyOneBendStats(), n: 1, k: 1 }, snapshots: [],
      verified: true, report: 'n=1 | trivial\nVERIFIKATION: PASS',
    };
  }

  const issues = validateInput(input);
  if (issues.disconnected) return failed('Der Graph ist nicht zusammenhaengend.');

  if (input.n === 2) {
    const edges = input.edges.map(([u, v]) => ({ u, v, aug: false }));
    return {
      ok: true,
      pos: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      edges,
      polylines: edges.map(() => [{ x: 0, y: 0 }, { x: 1, y: 0 }]),
      colors: edges.map(() => 'black' as const),
      part: [0, 0], v1: 0, v2: 1, vn: 1,
      stats: {
        ...emptyOneBendStats(), n: 2, m: edges.length, k: 1,
        deltaOrig: edges.length, slopesAllowedStrict: 2, slopesAllowed: 2,
      },
      snapshots: [],
      verified: true, report: 'n=2 | trivial\nVERIFIKATION: PASS',
    };
  }

  // Einbettung: gezeichnete uebernehmen oder per Demoucron berechnen
  let eg: EmbeddedGraph;
  if (issues.ok) {
    eg = buildEmbedding(input);
  } else {
    const pe = planarEmbedding(input.n, input.edges);
    if (!pe) return failed('Der Graph ist nicht planar.');
    eg = pe;
  }
  const deltaOrig = Math.max(...eg.rot.map((r) => r.length));

  // Korollar 2: bikonnektiert, dann 3-zusammenhaengend (Flaechen-Chorden)
  const added1 = augmentBiconnected(eg);
  if (added1 < 0) return failed('Bikonnektivitaets-Augmentierung fehlgeschlagen.');
  const added2 = augmentTriconnected(eg);
  if (added2 < 0) return failed('Trikonnektivierungs-Augmentierung fehlgeschlagen.');
  const augmented = added1 + added2 > 0;

  const deltaAug = Math.max(...eg.rot.map((r) => r.length));
  const deltaEff = Math.max(deltaAug, 5);

  // k: Papier-Wahl 4*deltaEff*n^2 oder manueller Wert (erst hier
  // validierbar, weil deltaEff von der Augmentierung abhaengt).
  const kCustom = options?.k !== undefined;
  const kMin = deltaEff - 2;
  let k = 4 * deltaEff * eg.n * eg.n;
  if (kCustom) {
    const kc = options!.k!;
    if (!Number.isInteger(kc) || kc < kMin || kc > K_MAX) {
      return failed(`Parameter k muss eine ganze Zahl zwischen ${kMin} und ${K_MAX} sein.`);
    }
    k = kc;
  }

  const co = computeCanonicalOrder(eg);
  if (!co.order) return failed('Kanonische Ordnung: ' + (co.error ?? 'unbekannt'));
  const order = co.order;

  const draw = drawOneBend(eg.n, eg.edges, order, deltaEff, k);
  if (!draw.ok) return failed('Zeichnung fehlgeschlagen: ' + (draw.error ?? 'unbekannt'));

  const part = new Array<number>(eg.n).fill(0);
  order.parts.forEach((p, i) => p.forEach((v) => { part[v] = i; }));

  const result: OneBendResult = {
    ok: true,
    pos: draw.X.map((x, v) => ({ x, y: draw.Y[v] })),
    edges: eg.edges,
    polylines: draw.recs.map((r) => [
      { x: draw.X[r.u], y: draw.Y[r.u] },
      ...(r.bend ? [r.bend] : []),
      { x: draw.X[r.v], y: draw.Y[r.v] },
    ]),
    colors: draw.recs.map((r) => r.color),
    part,
    v1: order.v1, v2: order.v2, vn: order.vn,
    stats: {
      n: eg.n,
      m: eg.edges.length,
      deltaOrig,
      deltaAug,
      deltaEff,
      k,
      kCustom,
      slopesAllowed: 3 * deltaEff - 8,
      slopesAllowedStrict: augmented
        ? Math.ceil((9 * deltaOrig) / 2) + 1
        : 3 * Math.max(deltaOrig, 5) - 8,
      slopesUsed: 0,
      augmented,
      specialVn: draw.specialVn,
      parts: order.parts.length,
      width: 0,
      height: 0,
    },
    snapshots: draw.snapshots,
  };

  const verification = verifyOneBendDrawing(result);
  result.verified = verification.ok;
  result.report = verification.report;
  return result;
}
