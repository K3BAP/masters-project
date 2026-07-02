// Geometrischer Verifier (Port von verify_slopes_drawing):
// Planaritaet, Knickzahl, Steigungsmenge, strikte Papier-Schranke,
// Gitter- und Flaechenschranken -- exakt in BigInt-Arithmetik.

import type { DrawingResult, Point } from './types';

interface Seg { ax: bigint; ay: bigint; bx: bigint; by: bigint; edge: number }

function sgn(v: bigint): number { return v > 0n ? 1 : v < 0n ? -1 : 0; }

function cross(ox: bigint, oy: bigint, ax: bigint, ay: bigint, bx: bigint, by: bigint): bigint {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}

function onSegment(px: bigint, py: bigint, s: Seg): boolean {
  if (cross(s.ax, s.ay, s.bx, s.by, px, py) !== 0n) return false;
  const minx = s.ax < s.bx ? s.ax : s.bx, maxx = s.ax < s.bx ? s.bx : s.ax;
  const miny = s.ay < s.by ? s.ay : s.by, maxy = s.ay < s.by ? s.by : s.ay;
  return px >= minx && px <= maxx && py >= miny && py <= maxy;
}

/** 0 = disjunkt, 1 = Beruehrung in genau einem Punkt, 2 = Kreuzung/Ueberlappung. */
function segIntersect(s: Seg, t: Seg): { r: 0 | 1 | 2; tx?: bigint; ty?: bigint } {
  const d1 = sgn(cross(s.ax, s.ay, s.bx, s.by, t.ax, t.ay));
  const d2 = sgn(cross(s.ax, s.ay, s.bx, s.by, t.bx, t.by));
  const d3 = sgn(cross(t.ax, t.ay, t.bx, t.by, s.ax, s.ay));
  const d4 = sgn(cross(t.ax, t.ay, t.bx, t.by, s.bx, s.by));
  if (d1 * d2 < 0 && d3 * d4 < 0) return { r: 2 };

  const cand: Array<[bigint, bigint, Seg]> = [
    [t.ax, t.ay, s], [t.bx, t.by, s], [s.ax, s.ay, t], [s.bx, s.by, t],
  ];
  let seen = false, tx = 0n, ty = 0n;
  for (const [px, py, seg] of cand) {
    if (onSegment(px, py, seg)) {
      if (!seen) { tx = px; ty = py; seen = true; }
      else if (px !== tx || py !== ty) return { r: 2 };
    }
  }
  return seen ? { r: 1, tx, ty } : { r: 0 };
}

/** Prueft alle Spezifikationen; fuellt stats.slopesUsed/width/height, liefert Bericht. */
export function verifyDrawing(result: DrawingResult): { ok: boolean; report: string } {
  const lines: string[] = [];
  let ok = true;
  const err = (msg: string) => { lines.push('FEHLER: ' + msg); ok = false; };

  const { pos, polylines, edges, stats } = result;
  const deltaEff = Math.max(4, stats.deltaEff);
  const hi = Math.ceil(deltaEff / 4) - 1;
  const lo = -(Math.floor(deltaEff / 4) - 1);

  // Ganzzahligkeit & Knotenkollisionen
  const nodeKeys = new Set<string>();
  for (const p of pos) {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) err('Knoten nicht auf Gitterpunkt');
    const key = p.x + ',' + p.y;
    if (pos.length > 1 && nodeKeys.has(key)) err('Zwei Knoten auf derselben Position');
    nodeKeys.add(key);
  }

  // Segmente sammeln, Knicke/Steigungen pruefen
  const segs: Seg[] = [];
  const slopesUsed = new Set<string>();
  let allVertical = true;

  polylines.forEach((pl, e) => {
    const clean: Point[] = [];
    for (const p of pl) {
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) err('Knick nicht auf Gitterpunkt');
      if (!clean.length || clean[clean.length - 1].x !== p.x || clean[clean.length - 1].y !== p.y) clean.push(p);
    }
    const bends = clean.length - 2;
    if (bends > 2) err(`Kante ${e} mit ${bends} Knicken (> 2)`);

    let hasVertical = false;
    for (let j = 0; j + 1 < clean.length; j++) {
      const a = clean[j], b = clean[j + 1];
      segs.push({ ax: BigInt(a.x), ay: BigInt(a.y), bx: BigInt(b.x), by: BigInt(b.y), edge: e });
      const dx = b.x - a.x, dy = b.y - a.y;
      if (dx === 0) { hasVertical = true; slopesUsed.add('inf'); }
      else if (dy % dx !== 0) err(`Kante ${e}: Segment mit nicht-ganzzahliger Steigung`);
      else {
        const s = dy / dx;
        if (s < lo || s > hi) err(`Kante ${e}: Steigung ${s} ausserhalb S = [${lo}..${hi}] u {inf}`);
        slopesUsed.add(String(s));
      }
    }
    if (clean.length >= 2 && !hasVertical) allVertical = false;
  });

  stats.slopesUsed = slopesUsed.size;
  if (slopesUsed.size > stats.slopesAllowedStrict) {
    err(`${slopesUsed.size} Steigungen benutzt, Papier-Schranke ist ${stats.slopesAllowedStrict}`);
  }
  if (!allVertical && polylines.length > 0) err('Kante ohne vertikales Segment (Modellverletzung)');

  // Planaritaet: paarweise Segmenttests
  let reported = 0;
  for (let a = 0; a < segs.length && reported < 20; a++) {
    for (let b = a + 1; b < segs.length && reported < 20; b++) {
      const res = segIntersect(segs[a], segs[b]);
      if (res.r === 0) continue;
      if (segs[a].edge === segs[b].edge) {
        if (res.r === 2) { err(`Kante ${segs[a].edge} ueberlappt/kreuzt sich selbst`); reported++; }
        continue;
      }
      if (res.r === 2) {
        err(`Kreuzung/Ueberlappung zwischen Kanten ${segs[a].edge} und ${segs[b].edge}`);
        reported++;
        continue;
      }
      // Beruehrung: nur an gemeinsamem Endknoten beider Kanten erlaubt
      const ea = edges[segs[a].edge], eb = edges[segs[b].edge];
      const common = [ea.u, ea.v].filter((x) => x === eb.u || x === eb.v);
      const atCommon = common.some((c) =>
        BigInt(pos[c].x) === res.tx && BigInt(pos[c].y) === res.ty);
      if (!atCommon) {
        err(`Beruehrung ausserhalb gemeinsamer Knoten (Kanten ${segs[a].edge}/${segs[b].edge})`);
        reported++;
      }
    }
  }

  // Knoten im Inneren fremder Kanten
  for (let v = 0; v < pos.length; v++) {
    const px = BigInt(pos[v].x), py = BigInt(pos[v].y);
    for (const s of segs) {
      const e = edges[s.edge];
      if (e.u === v || e.v === v) continue;
      if (onSegment(px, py, s)) { err(`Knoten ${v} liegt auf Kante ${s.edge}`); break; }
    }
  }

  // Flaechenschranken
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const extend = (p: Point) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  };
  pos.forEach(extend);
  polylines.forEach((pl) => pl.forEach(extend));
  stats.width = pos.length ? maxX - minX : 0;
  stats.height = pos.length ? maxY - minY : 0;

  const span = Math.max(1, 2 * stats.m - stats.n);
  if (stats.width > span) err(`Breite ${stats.width} > 2m-n = ${span}`);
  const L = Math.floor(deltaEff / 4) * span + 1;
  const heightBound = (stats.n - 1) * stats.rowSpacing + 2 * L;
  if (stats.n >= 2 && stats.height > heightBound) err(`Hoehe ${stats.height} > Schranke ${heightBound}`);

  const head =
    `n=${stats.n} m=${stats.m} Delta=${stats.deltaOrig} Delta_eff=${stats.deltaEff} | ` +
    `Steigungen: ${stats.slopesUsed}/${stats.slopesAllowedStrict} | ` +
    `Gitter: ${stats.width} x ${stats.height}` +
    (stats.augmented ? ' | augmentiert' : '') +
    (stats.bumped ? ' | Regularitaets-Bump' : '');
  const report = [head, ...lines, ok ? 'VERIFIKATION: PASS' : 'VERIFIKATION: FAIL'].join('\n');
  return { ok, report };
}
