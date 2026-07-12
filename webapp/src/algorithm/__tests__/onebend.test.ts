// Property-Suite fuer den 1-Bend-Algorithmus (Theorem 1 + Korollar 2):
// das Browser-Pendant zu onebend_test (C++). Jede Instanz muss den
// geometrischen 1-Bend-Verifier bestehen; kanonische Ordnungen werden
// zusaetzlich vom unabhaengigen Checker validiert.

import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { randomPlanarGraph } from '../../random';
import { augmentBiconnected } from '../augment';
import { buildEmbedding, isPlanarRotation, validateInput } from '../embedding';
import { planarEmbedding } from '../planarity';
import type { EmbeddedGraph, InputGraph } from '../types';
import { augmentTriconnected, isTriconnected } from '../onebend/augmentTriconnected';
import { checkCanonicalOrder, computeCanonicalOrder } from '../onebend/canonicalOrder';
import { computeOneBendDrawing, K_MAX } from '../onebend/pipeline';

// ---------------------------------------------------------------------
// Hilfen: Graphen aus Kantenlisten (Kreispositionen; bei Kreuzungen
// greift automatisch die Demoucron-Planarisierung der Pipeline)
// ---------------------------------------------------------------------
function onCircle(n: number, edges: Array<[number, number]>): InputGraph {
  const pos = Array.from({ length: n }, (_, i) => ({
    x: 320 + 260 * Math.cos((2 * Math.PI * i) / n),
    y: 320 + 260 * Math.sin((2 * Math.PI * i) / n),
  }));
  return { n, edges, pos };
}

function k4(): InputGraph {
  return onCircle(4, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]);
}

function octahedron(): InputGraph {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++) {
      if (Math.floor(i / 2) === Math.floor(j / 2)) continue;
      edges.push([i, j]);
    }
  return onCircle(6, edges);
}

/** Ikosaeder: 5-regulaer, erzwingt den Sonderfall deg(vn) = Delta. */
function icosahedron(): InputGraph {
  const edges: Array<[number, number]> = [];
  const top = 0, bot = 1;
  const u = (i: number) => 2 + i;
  const l = (i: number) => 7 + i;
  for (let i = 0; i < 5; i++) {
    edges.push([top, u(i)], [bot, l(i)]);
    edges.push([u(i), u((i + 1) % 5)], [l(i), l((i + 1) % 5)]);
    edges.push([u(i), l(i)], [l(i), u((i + 1) % 5)]);
  }
  return onCircle(12, edges);
}

function prism(k: number, anti: boolean): InputGraph {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < k; i++) {
    edges.push([i, (i + 1) % k]);
    edges.push([k + i, k + ((i + 1) % k)]);
    edges.push([i, k + i]);
    if (anti) edges.push([k + i, (i + 1) % k]);
  }
  return onCircle(2 * k, edges);
}

function wheel(k: number): InputGraph {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < k; i++) edges.push([i, (i + 1) % k], [k, i]);
  return onCircle(k + 1, edges);
}

function star(k: number): InputGraph {
  return onCircle(k + 1, Array.from({ length: k }, (_, i) => [0, i + 1] as [number, number]));
}

function spider(legs: number, len: number): InputGraph {
  const edges: Array<[number, number]> = [];
  let next = 1;
  for (let i = 0; i < legs; i++) {
    let prev = 0;
    for (let j = 0; j < len; j++) { edges.push([prev, next]); prev = next; next++; }
  }
  return onCircle(next, edges);
}

function grid(w: number, h: number): InputGraph {
  const edges: Array<[number, number]> = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x + 1 < w) edges.push([y * w + x, y * w + x + 1]);
      if (y + 1 < h) edges.push([y * w + x, (y + 1) * w + x]);
    }
  return onCircle(w * h, edges);
}

function path(k: number): InputGraph {
  return onCircle(k, Array.from({ length: k - 1 }, (_, i) => [i, i + 1] as [number, number]));
}

function expectPass(g: InputGraph, label: string) {
  const res = computeOneBendDrawing(g);
  expect(res.ok, `${label}: ${res.error ?? ''}`).toBe(true);
  expect(res.verified, `${label}:\n${res.report ?? ''}`).toBe(true);
  return res;
}

/** Triconnected-augmentierte Einbettung eines Eingabegraphen. */
function triconnectedEmbedding(g: InputGraph): EmbeddedGraph {
  const eg = validateInput(g).ok ? buildEmbedding(g) : planarEmbedding(g.n, g.edges)!;
  expect(eg).toBeTruthy();
  expect(augmentBiconnected(eg)).toBeGreaterThanOrEqual(0);
  expect(augmentTriconnected(eg)).toBeGreaterThanOrEqual(0);
  return eg;
}

// ---------------------------------------------------------------------
describe('Feste Familien (Theorem 1)', () => {
  it('K4', () => { expectPass(k4(), 'K4'); });
  it('Oktaeder', () => { expectPass(octahedron(), 'Oktaeder'); });

  it('Ikosaeder (Sonderfall deg(vn) = Delta)', () => {
    const res = expectPass(icosahedron(), 'Ikosaeder');
    expect(res.stats.specialVn).toBe(true);
    expect(res.stats.augmented).toBe(false);
    expect(res.stats.deltaEff).toBe(5);
    expect(res.stats.slopesUsed).toBeLessThanOrEqual(3 * 5 - 8);
  });

  for (let k = 3; k <= 7; k++) {
    it(`Prisma k=${k}`, () => { expectPass(prism(k, false), `Prisma ${k}`); });
    it(`Antiprisma k=${k}`, () => { expectPass(prism(k, true), `Antiprisma ${k}`); });
    it(`Rad k=${k + 2}`, () => { expectPass(wheel(k + 2), `Rad ${k + 2}`); });
  }
});

describe('Korollar-2-Pfad (nicht 3-zusammenhaengende Eingaben)', () => {
  it('Pfade', () => {
    expectPass(path(2), 'Pfad 2');
    expectPass(path(3), 'Pfad 3');
    expectPass(path(10), 'Pfad 10');
  });
  for (const k of [3, 5, 8, 12]) {
    it(`Stern k=${k}`, () => {
      const res = expectPass(star(k), `Stern ${k}`);
      expect(res.stats.augmented).toBe(true);
      expect(res.stats.slopesUsed).toBeLessThanOrEqual(Math.ceil((9 * k) / 2) + 1);
    });
  }
  for (const [legs, len] of [[3, 2], [5, 2], [8, 2], [5, 3]] as Array<[number, number]>) {
    it(`Spinne ${legs}x${len}`, () => { expectPass(spider(legs, len), `Spinne ${legs}x${len}`); });
  }
  it('Gitter', () => {
    expectPass(grid(4, 4), 'Gitter 4x4');
    expectPass(grid(6, 3), 'Gitter 6x3');
  });
});

describe('Beispielgraphen der Galerie', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.id} besteht die 1-Bend-Verifikation`, () => {
      expectPass(ex.graph, ex.id);
    });
  }
});

describe('Zufallsgraphen (Delaunay)', () => {
  const sizes = [5, 8, 12, 20, 32, 48];
  const densities = [0, 0.5, 1];
  for (const n of sizes) {
    for (const d of densities) {
      for (let s = 1; s <= 2; s++) {
        const seed = n * 1000 + Math.round(d * 100) * 10 + s;
        it(`n=${n} density=${d} seed=${seed}`, () => {
          expectPass(randomPlanarGraph(n, d, seed), `random n=${n} d=${d} s=${seed}`);
        });
      }
    }
  }
});

describe('Trikonnektivierungs-Augmentierung', () => {
  it('macht Graphen 3-zusammenhaengend, bleibt planar', () => {
    for (let s = 1; s <= 25; s++) {
      const g = randomPlanarGraph(5 + (s % 20), (s % 4) * 0.3, 7000 + s);
      const eg = triconnectedEmbedding(g);
      expect(isTriconnected(eg), `Seed ${7000 + s}: 3-zusammenhaengend`).toBe(true);
      expect(isPlanarRotation(eg), `Seed ${7000 + s}: planar (Euler)`).toBe(true);
    }
  });

  it('laesst 3-zusammenhaengende Graphen unveraendert', () => {
    const eg = triconnectedEmbedding(icosahedron());
    expect(eg.edges.every((e) => !e.aug)).toBe(true);
  });
});

describe('Kanonische Ordnung', () => {
  it('besteht den Checker auf Zufallsgraphen; vn hat Minimalgrad', () => {
    for (let s = 1; s <= 25; s++) {
      const g = randomPlanarGraph(4 + (s % 24), ((s * 3) % 4) * 0.33, 8000 + s);
      const eg = triconnectedEmbedding(g);
      const co = computeCanonicalOrder(eg);
      expect(co.order, `Seed ${8000 + s}: ${co.error ?? ''}`).toBeTruthy();
      expect(checkCanonicalOrder(eg, co.order!), `Seed ${8000 + s}`).toBeNull();
      const deg = eg.rot.map((r) => r.length);
      expect(deg[co.order!.vn]).toBe(Math.min(...deg));
    }
  });

  it('lehnt manipulierte Ordnungen ab (Checker-Selbsttest)', () => {
    const eg = triconnectedEmbedding(octahedron());
    const co = computeCanonicalOrder(eg);
    expect(co.order).toBeTruthy();
    const order = co.order!;
    // Zwei mittlere Teile vertauschen muss (mindestens) eine Bedingung brechen
    if (order.parts.length >= 4) {
      const parts = order.parts.map((p) => p.slice());
      [parts[1], parts[2]] = [parts[2], parts[1]];
      expect(checkCanonicalOrder(eg, { ...order, parts })).not.toBeNull();
    }
    // vn austauschen bricht P_m = {vn}
    expect(checkCanonicalOrder(eg, { ...order, vn: order.v1 })).not.toBeNull();
  });
});

describe('Snapshots (Stepper-Grundlage)', () => {
  it('liefert monoton wachsende, konsistente Zwischenstaende', () => {
    const res = expectPass(prism(5, true), 'Antiprisma 5');
    expect(res.snapshots.length).toBeGreaterThanOrEqual(3);
    expect(res.snapshots[0].kind).toBe('base');
    expect(res.snapshots[res.snapshots.length - 1].kind).toBe('closing');
    let prevPlaced = 0;
    let prevDrawn = 0;
    for (const s of res.snapshots) {
      const placed = s.pos.filter((p) => p !== null).length;
      const drawn = s.polylines.filter((p) => p !== null).length;
      expect(placed).toBeGreaterThanOrEqual(prevPlaced);
      expect(drawn).toBeGreaterThanOrEqual(prevDrawn);
      prevPlaced = placed;
      prevDrawn = drawn;
      for (const v of s.newNodes) expect(s.pos[v]).not.toBeNull();
      for (const e of s.newEdges) expect(s.polylines[e]).not.toBeNull();
    }
    const last = res.snapshots[res.snapshots.length - 1];
    expect(last.pos.every((p) => p !== null)).toBe(true);
    expect(last.polylines.every((p) => p !== null)).toBe(true);
  });

  it('Ikosaeder enthaelt einen special-Schritt', () => {
    const res = expectPass(icosahedron(), 'Ikosaeder');
    expect(res.snapshots.some((s) => s.kind === 'special')).toBe(true);
  });
});

describe('Manueller Parameter k', () => {
  it('Ikosaeder besteht mit vielen k-Werten (Deff=5, Minimum 3)', () => {
    for (const k of [3, 4, 7, 100, 2880, 1_000_000]) {
      const res = computeOneBendDrawing(icosahedron(), { k });
      expect(res.ok, `k=${k}: ${res.error ?? ''}`).toBe(true);
      expect(res.verified, `k=${k}:\n${res.report ?? ''}`).toBe(true);
      expect(res.stats.k).toBe(k);
      expect(res.stats.kCustom).toBe(true);
      expect(res.stats.slopesUsed).toBeLessThanOrEqual(7);
    }
  });

  it('kleines k macht die Zeichnung flacher', () => {
    const auto = computeOneBendDrawing(icosahedron());
    const small = computeOneBendDrawing(icosahedron(), { k: 3 });
    expect(auto.verified).toBe(true);
    expect(small.verified).toBe(true);
    expect(small.stats.height).toBeLessThan(auto.stats.height);
  });

  it('weitere Familien mit manuellem k', () => {
    for (const k of [10, 1000]) {
      for (const [g, label] of [
        [prism(5, true), 'Antiprisma 5'],
        [wheel(9), 'Rad 9'],
        [grid(4, 4), 'Gitter 4x4'],
      ] as Array<[InputGraph, string]>) {
        const res = computeOneBendDrawing(g, { k });
        expect(res.ok, `${label} k=${k}: ${res.error ?? ''}`).toBe(true);
        expect(res.verified, `${label} k=${k}:\n${res.report ?? ''}`).toBe(true);
      }
    }
  });

  it('Zufallsgraphen mit manuellem k bestehen die Verifikation', () => {
    for (let s = 1; s <= 10; s++) {
      const g = randomPlanarGraph(6 + s, (s % 3) * 0.5, 12000 + s);
      for (const k of [50, 5000]) {
        const res = computeOneBendDrawing(g, { k });
        expect(res.ok, `Seed ${12000 + s} k=${k}: ${res.error ?? ''}`).toBe(true);
        expect(res.verified, `Seed ${12000 + s} k=${k}:\n${res.report ?? ''}`).toBe(true);
      }
    }
  });

  it('validiert Untergrenze, Ganzzahligkeit und Obergrenze', () => {
    for (const bad of [2, 0, -5, 2.5, NaN, K_MAX + 1]) {
      const res = computeOneBendDrawing(icosahedron(), { k: bad });
      expect(res.ok, `k=${bad} muss abgelehnt werden`).toBe(false);
      expect(res.error).toMatch(/Parameter k/);
    }
  });

  it('ohne Option bleibt die Papier-Wahl 4·Deff·n² aktiv', () => {
    const res = computeOneBendDrawing(icosahedron());
    expect(res.stats.k).toBe(4 * 5 * 12 * 12);
    expect(res.stats.kCustom).toBe(false);
  });

  it('bricht bei drohendem Koordinatenueberlauf sauber ab', () => {
    // Minimal-nahes k auf groesseren Graphen: die Breite waechst pro
    // Schritt etwa um den Faktor 1+2Delta/k. Entweder das Ergebnis ist
    // sauber verifiziert oder der Guard liefert einen klaren Fehler --
    // niemals eine unverifizierte Zeichnung oder ein Absturz.
    for (let s = 1; s <= 5; s++) {
      const g = randomPlanarGraph(40 + s, 1, 13000 + s);
      const res = computeOneBendDrawing(g, { k: 20 });
      if (res.ok) {
        expect(res.verified, `Seed ${13000 + s}:\n${res.report ?? ''}`).toBe(true);
      } else {
        expect(res.error).toMatch(/Koordinatenbereich|Parameter k/);
      }
    }
  });
});

describe('Wurzelvorgaben v1/v2/vn', () => {
  it('volle Vorgabe auf dem Ikosaeder wird uebernommen', () => {
    // (2,3,0) ist eine Dreiecksflaeche (u0, u1, top): (v1,v2) und (v1,vn)
    // sind Kanten auf einer gemeinsamen Flaeche.
    const res = computeOneBendDrawing(icosahedron(), { v1: 2, v2: 3, vn: 0 });
    expect(res.ok, res.error ?? '').toBe(true);
    expect(res.verified, res.report ?? '').toBe(true);
    expect([res.v1, res.v2, res.vn]).toEqual([2, 3, 0]);
    expect(res.stats.parts).toBeGreaterThan(1);
  });

  it('vn mit vollem Grad (Rad-Nabe) nutzt den Sonderfall', () => {
    // W8: Nabe 8 hat deg = Delta_eff = 8; (0,1,8) ist eine Dreiecksflaeche.
    const res = computeOneBendDrawing(wheel(8), { v1: 0, v2: 1, vn: 8 });
    expect(res.ok, res.error ?? '').toBe(true);
    expect(res.verified, res.report ?? '').toBe(true);
    expect([res.v1, res.v2, res.vn]).toEqual([0, 1, 8]);
    expect(res.stats.specialVn).toBe(true);
  });

  it('Teilvorgaben: nur v1+v2 bzw. nur vn', () => {
    const a = computeOneBendDrawing(icosahedron(), { v1: 2, v2: 3 });
    expect(a.ok, a.error ?? '').toBe(true);
    expect(a.verified, a.report ?? '').toBe(true);
    expect([a.v1, a.v2]).toEqual([2, 3]);

    const b = computeOneBendDrawing(icosahedron(), { vn: 7 });
    expect(b.ok, b.error ?? '').toBe(true);
    expect(b.verified, b.report ?? '').toBe(true);
    expect(b.vn).toBe(7);
  });

  it('n=3: Vorgaben auf dem Dreieck', () => {
    const g = onCircle(3, [[0, 1], [1, 2], [2, 0]]);
    const res = computeOneBendDrawing(g, { v1: 2, v2: 0 });
    expect(res.ok, res.error ?? '').toBe(true);
    expect(res.verified, res.report ?? '').toBe(true);
    expect([res.v1, res.v2, res.vn]).toEqual([2, 0, 1]);
  });

  it('Nicht-Kante (v1,v2) wird mit klarer Meldung abgelehnt', () => {
    // 2 und 4 (u0, u2) sind im Ikosaeder nicht adjazent.
    const res = computeOneBendDrawing(icosahedron(), { v1: 2, v2: 4 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/vorgegebenen Wurzelknoten/);
    expect(res.error).toMatch(/Kante \(v1,v2\) fehlt/);
  });

  it('validiert Bereich und Verschiedenheit', () => {
    for (const roots of [
      { v1: 99 }, { vn: -1 }, { v1: 1.5 }, { v1: NaN },
      { v1: 3, vn: 3 }, { v1: 0, v2: 0 },
    ]) {
      const res = computeOneBendDrawing(icosahedron(), roots);
      expect(res.ok, JSON.stringify(roots)).toBe(false);
      expect(res.error).toMatch(/Wurzelknoten muessen verschiedene ganze Zahlen/);
    }
  });

  it('Korollar-2-Pfad: automatische Wurzeln lassen sich reproduzieren', () => {
    for (const [g, label] of [
      [star(6), 'Stern 6'], [spider(3, 2), 'Spinne 3x2'], [grid(3, 3), 'Gitter 3x3'],
    ] as Array<[InputGraph, string]>) {
      const auto = computeOneBendDrawing(g);
      expect(auto.ok, `${label}: ${auto.error ?? ''}`).toBe(true);
      const forced = computeOneBendDrawing(g, { v1: auto.v1, v2: auto.v2, vn: auto.vn });
      expect(forced.ok, `${label}: ${forced.error ?? ''}`).toBe(true);
      expect(forced.verified, `${label}:\n${forced.report ?? ''}`).toBe(true);
      expect([forced.v1, forced.v2, forced.vn]).toEqual([auto.v1, auto.v2, auto.vn]);
    }
  });

  it('Property: Wurzeln der Auto-Ordnung erzwingen liefert PASS (Zufall)', () => {
    for (let s = 1; s <= 6; s++) {
      const g = randomPlanarGraph(10 + 3 * s, 1.6, 14000 + s);
      const auto = computeOneBendDrawing(g);
      expect(auto.ok, `Seed ${14000 + s}: ${auto.error ?? ''}`).toBe(true);
      const forced = computeOneBendDrawing(g, { v1: auto.v1, v2: auto.v2, vn: auto.vn });
      expect(forced.ok, `Seed ${14000 + s}: ${forced.error ?? ''}`).toBe(true);
      expect(forced.verified, `Seed ${14000 + s}:\n${forced.report ?? ''}`).toBe(true);
      expect([forced.v1, forced.v2, forced.vn]).toEqual([auto.v1, auto.v2, auto.vn]);
    }
  });

  it('niemals eine unverifizierte Zeichnung: alle vn-Vorgaben auf dem Prisma', () => {
    // Jede Wahl liefert entweder ein verifiziertes Ergebnis oder einen
    // klaren Vorgabe-Fehler -- nie einen Absturz oder FAIL-Bericht.
    const g = prism(5, false);
    for (let vn = 0; vn < g.n; vn++) {
      const res = computeOneBendDrawing(g, { vn });
      if (res.ok) expect(res.verified, `vn=${vn}:\n${res.report ?? ''}`).toBe(true);
      else expect(res.error, `vn=${vn}`).toMatch(/Wurzelknoten|Kanonische Ordnung/);
    }
  });
});

describe('Nicht-planare Eingaben', () => {
  it('K5 wird abgelehnt', () => {
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) edges.push([i, j]);
    const res = computeOneBendDrawing(onCircle(5, edges));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/planar/);
  });
});
