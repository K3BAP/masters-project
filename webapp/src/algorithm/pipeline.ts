// Orchestrierung (Pendant zu compute_slopes_drawing):
// Einbettung aus Geometrie -> Augmentierung -> st-Nummerierung ->
// Routing -> Geometrie -> Verifikation.

import { augmentBiconnected } from './augment';
import { buildEmbedding, validateInput } from './embedding';
import { computeGeometry } from './geometry';
import { route } from './router';
import { stNumbering } from './stNumbering';
import type { DrawingResult, InputGraph } from './types';
import { verifyDrawing } from './verifier';

export function computeSlopesDrawing(input: InputGraph): DrawingResult {
  const failed = (error: string): DrawingResult => ({
    ok: false, error, pos: [], edges: [], polylines: [], xEdge: [], st: [],
    stats: emptyStats(), trace: [],
  });

  if (input.n === 0) return failed('Leerer Graph.');
  if (input.n === 1) {
    return {
      ok: true, pos: [{ x: 0, y: 0 }], edges: [], polylines: [], xEdge: [],
      st: [1], stats: { ...emptyStats(), n: 1 }, trace: [], verified: true,
      report: 'n=1 | trivial\nVERIFIKATION: PASS',
    };
  }

  // Eingabe-Gate (Editor prueft dies bereits; hier defensiv)
  const issues = validateInput(input);
  if (issues.disconnected) return failed('Der Graph ist nicht zusammenhaengend.');
  if (!issues.ok) return failed('Die Zeichnung ist nicht kreuzungsfrei.');

  // Einbettung aus der Zeichnung, dann gradbeschraenkte Augmentierung
  const eg = buildEmbedding(input);
  const deltaOrig = Math.max(...eg.rot.map((r) => r.length));
  const added = augmentBiconnected(eg);
  if (added < 0) return failed('Bikonnektivitaets-Augmentierung fehlgeschlagen.');
  const augmented = added > 0;

  const deg = eg.rot.map((r) => r.length);
  const deltaAug = Math.max(...deg);
  const minDeg = Math.min(...deg);

  // st-Kante: Ziel = Knoten minimalen Grades, Quelle = Nachbar minimalen Grades
  let tMin = 0;
  for (let v = 0; v < eg.n; v++) if (deg[v] < deg[tMin]) tMin = v;
  let eSt = -1;
  for (const d of eg.rot[tMin]) {
    if (eSt < 0 || deg[d.to] < deg[otherEnd(eg, eSt, tMin)]) eSt = d.e;
  }
  if (eSt < 0) return failed('Keine ST-Kante gefunden.');
  const v1 = otherEnd(eg, eSt, tMin);

  let deltaEff = deltaAug + (deltaAug % 2);
  if (deltaEff < 4) deltaEff = 4;
  let bumped = false;
  if (minDeg >= deltaEff || deg[v1] >= deltaEff) { deltaEff += 2; bumped = true; }

  const st = stNumbering(eg, v1, tMin);
  if (!st) return failed('st-Nummerierung fehlgeschlagen (Graph nicht bikonnektiert?).');

  const routed = route(eg, st, eSt, deltaEff);
  if (!routed.ok) return failed('Routing fehlgeschlagen: ' + routed.error);

  const geo = computeGeometry(eg, st, routed.result, deltaEff);

  const m = eg.edges.length;
  const result: DrawingResult = {
    ok: true,
    pos: geo.pos,
    edges: eg.edges,
    polylines: geo.polylines,
    xEdge: routed.result.xEdge.slice(),
    st,
    stats: {
      n: eg.n, m,
      deltaOrig, deltaEff,
      slopesAllowedStrict: Math.max(2, Math.ceil(deltaOrig / 2) + (augmented || bumped ? 1 : 0)),
      slopesUsed: 0,
      augmented, bumped,
      width: 0, height: 0,
      rowSpacing: geo.rowSpacing,
    },
    trace: routed.result.trace,
  };

  const verification = verifyDrawing(result);
  result.verified = verification.ok;
  result.report = verification.report;
  return result;
}

function otherEnd(eg: { edges: Array<{ u: number; v: number }> }, e: number, v: number): number {
  const edge = eg.edges[e];
  return edge.u === v ? edge.v : edge.u;
}

function emptyStats() {
  return {
    n: 0, m: 0, deltaOrig: 0, deltaEff: 0, slopesAllowedStrict: 0,
    slopesUsed: 0, augmented: false, bumped: false, width: 0, height: 0, rowSpacing: 0,
  };
}
