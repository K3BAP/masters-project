// Geometrischer Verifier fuer 1-Bend-Zeichnungen (Port von
// verify_onebend_drawing): Planaritaet exakt (BigInt), <= 1 Knick,
// Steigungen exakt in S (rationale Tests), Kantenform je Farbe (I.5),
// Knoten-y = Vielfache von k (I.4), Gitterschranken 12*Deff*N^2 x
// 18*Deff*N^3. Strikte Steigungsschranke: 3*max(Delta,5)-8 fuer
// 3-zusammenhaengende Eingaben, ceil(9*Delta/2)+1 nach Augmentierung.

import type { Point } from '../types';
import type { OneBendResult } from './types';

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

type SlopeClass = 'vertical' | 'horizontal' | 'rsteep' | 'lsteep' | 'flat' | 'bad';

function classifySlope(dx: number, dy: number, k: number, D3: number): SlopeClass {
  if (dx === 0) return dy !== 0 ? 'vertical' : 'bad';
  if (dy === 0) return 'horizontal';
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const positive = dx > 0 === dy > 0;
  if (ay > ax) {
    // steil: |dy| * j == k * |dx| fuer ein j in 1..D3
    const num = k * ax;
    if (num % ay !== 0) return 'bad';
    const j = num / ay;
    if (j < 1 || j > D3) return 'bad';
    return positive ? 'rsteep' : 'lsteep';
  }
  // flach: |dy| * D3 == j * |dx| fuer ein j in 1..D3-1, Steigung > 0
  if (!positive) return 'bad';
  const num = ay * D3;
  if (num % ax !== 0) return 'bad';
  const j = num / ax;
  if (j < 1 || j > D3 - 1) return 'bad';
  return 'flat';
}

export function verifyOneBendDrawing(result: OneBendResult): { ok: boolean; report: string } {
  const lines: string[] = [];
  let ok = true;
  const err = (msg: string) => { lines.push('FEHLER: ' + msg); ok = false; };

  const { pos, polylines, edges, colors, stats } = result;
  const deltaEff = Math.max(5, stats.deltaEff);
  const D3 = deltaEff - 3;
  const k = Math.max(1, stats.k);
  const n = pos.length;

  // Knoten: Gitter, Eindeutigkeit, I.4
  const nodeKeys = new Set<string>();
  pos.forEach((p, v) => {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) err(`Knoten ${v} nicht auf Gitterpunkt`);
    const key = p.x + ',' + p.y;
    if (n > 1 && nodeKeys.has(key)) err('Zwei Knoten auf derselben Position');
    nodeKeys.add(key);
    if (n >= 3 && p.y % k !== 0) err(`Knoten ${v}: y kein Vielfaches von k (I.4)`);
  });

  // Segmente sammeln, Steigungen/Formen pruefen
  const segs: Seg[] = [];
  const slopesUsed = new Set<string>();

  polylines.forEach((pl, e) => {
    const clean: Point[] = [];
    for (const p of pl) {
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) err(`Kante ${e}: Knick nicht auf Gitterpunkt`);
      if (!clean.length || clean[clean.length - 1].x !== p.x || clean[clean.length - 1].y !== p.y) clean.push(p);
    }
    const bends = clean.length - 2;
    if (bends > 1) err(`Kante ${e} mit ${bends} Knicken (> 1)`);

    const cls: SlopeClass[] = [];
    for (let j = 0; j + 1 < clean.length; j++) {
      const a = clean[j], b = clean[j + 1];
      segs.push({ ax: BigInt(a.x), ay: BigInt(a.y), bx: BigInt(b.x), by: BigInt(b.y), edge: e });
      const dx = b.x - a.x, dy = b.y - a.y;
      const c = classifySlope(dx, dy, k, D3);
      cls.push(c);
      if (c === 'bad') err(`Kante ${e}: Segmentsteigung nicht in S`);
      if (dx === 0) slopesUsed.add('inf');
      else {
        const g = gcd(Math.abs(dx), Math.abs(dy)) || 1;
        const nx = dx / g, ny = dy / g;
        slopesUsed.add(nx > 0 ? ny + '/' + nx : -ny + '/' + -nx);
      }
    }

    // Kantenform je Farbe (I.5); Basiskante (v1,v2) hat die Sonderform
    // [vertikal an v1, flach 1/D3 an v2] -- polylines sind ab rec.u
    // orientiert, fuer die Basiskante also ab v1.
    if (n >= 3) {
      const eu = edges[e].u, ev = edges[e].v;
      const isBase = (eu === result.v1 && ev === result.v2) || (eu === result.v2 && ev === result.v1);
      const col = colors[e];
      let shapeOk = true;
      if (isBase) {
        shapeOk = cls.length === 2 && cls[0] === 'vertical' && cls[1] === 'flat';
      } else if (col === 'black') {
        shapeOk = cls.length === 1 && cls[0] === 'horizontal';
      } else if (col === 'blue') {
        shapeOk = cls.length === 2 && (cls[0] === 'vertical' || cls[0] === 'rsteep') && cls[1] === 'horizontal';
      } else if (col === 'green') {
        shapeOk = cls.length === 2 && (cls[0] === 'vertical' || cls[0] === 'lsteep') && cls[1] === 'horizontal';
      } else if (col === 'red') {
        shapeOk = (cls.length === 1 && cls[0] === 'vertical') ||
                  (cls.length === 2 && cls[0] === 'vertical' && cls[1] === 'flat');
      }
      if (!shapeOk) err(`Kante ${e}: Form verletzt I.5 (Farbe ${col}, ${cls.length} Segmente)`);
    }
  });

  stats.slopesUsed = slopesUsed.size;
  if (n >= 3 && slopesUsed.size > stats.slopesAllowed) {
    err(`${slopesUsed.size} Steigungen > |S| = ${stats.slopesAllowed}`);
  }
  if (slopesUsed.size > stats.slopesAllowedStrict) {
    err(`${slopesUsed.size} Steigungen, strikte Schranke ist ${stats.slopesAllowedStrict}`);
  }

  // Planaritaet
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
  for (let v = 0; v < n; v++) {
    const px = BigInt(pos[v].x), py = BigInt(pos[v].y);
    for (const s of segs) {
      const e = edges[s.edge];
      if (e.u === v || e.v === v) continue;
      if (onSegment(px, py, s)) { err(`Knoten ${v} liegt auf Kante ${s.edge}`); break; }
    }
  }

  // Flaechenschranken: 12*Deff*N^2 x 18*Deff*N^3, N = max(n, 6)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const extend = (p: Point) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  };
  pos.forEach(extend);
  polylines.forEach((pl) => pl.forEach(extend));
  stats.width = n ? maxX - minX : 0;
  stats.height = n ? maxY - minY : 0;
  if (n >= 3) {
    const N = Math.max(n, 6);
    const wb = 12 * deltaEff * N * N;
    const hb = 18 * deltaEff * N * N * N;
    if (stats.width > wb) err(`Breite ${stats.width} > 12*Deff*N^2 = ${wb}`);
    if (stats.height > hb) err(`Hoehe ${stats.height} > 18*Deff*N^3 = ${hb}`);
  }

  const head =
    `n=${stats.n} m=${stats.m} Delta=${stats.deltaOrig} Deff=${stats.deltaEff} k=${stats.k} | ` +
    `Steigungen: ${stats.slopesUsed}/${stats.slopesAllowed} | ` +
    `Gitter: ${stats.width} x ${stats.height} | Teile: ${stats.parts}` +
    (stats.augmented ? ' | augmentiert' : '') +
    (stats.specialVn ? ' | Sonderfall vn' : '');
  const report = [head, ...lines, ok ? 'VERIFIKATION: PASS' : 'VERIFIKATION: FAIL'].join('\n');
  return { ok, report };
}

function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}
