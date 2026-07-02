// Property-Suite: das Browser-Pendant zu slopes_test (C++).
// Jede Instanz muss den geometrischen Verifier bestehen.

import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { randomPlanarGraph } from '../../random';
import { augmentBiconnected, isBiconnected } from '../augment';
import { buildEmbedding, isPlanarRotation, validateInput } from '../embedding';
import { computeSlopesDrawing } from '../pipeline';
import { stNumbering } from '../stNumbering';
import type { InputGraph } from '../types';

function expectPass(g: InputGraph, label: string) {
  const res = computeSlopesDrawing(g);
  expect(res.ok, `${label}: ${res.error ?? ''}`).toBe(true);
  expect(res.verified, `${label}:\n${res.report ?? ''}`).toBe(true);
}

describe('Beispielgraphen', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.name} besteht die Verifikation`, () => {
      expect(validateInput(ex.graph).ok, 'Beispielzeichnung muss kreuzungsfrei sein').toBe(true);
      expectPass(ex.graph, ex.name);
    });
  }

  it('Oktaeder benoetigt genau 3 Steigungen', () => {
    const res = computeSlopesDrawing(EXAMPLES.find((e) => e.id === 'octahedron')!.graph);
    expect(res.verified).toBe(true);
    expect(res.stats.slopesUsed).toBe(3);
    expect(res.stats.bumped).toBe(true);
  });

  it('K4 kommt mit 2 Steigungen aus (orthogonal)', () => {
    const res = computeSlopesDrawing(EXAMPLES.find((e) => e.id === 'k4')!.graph);
    expect(res.verified).toBe(true);
    expect(res.stats.slopesUsed).toBeLessThanOrEqual(2);
  });
});

describe('Zufallsgraphen (Delaunay)', () => {
  const sizes = [5, 8, 12, 20, 32, 48];
  const densities = [0, 0.3, 0.7, 1];
  let count = 0;
  for (const n of sizes) {
    for (const d of densities) {
      for (let s = 1; s <= 3; s++) {
        const seed = n * 1000 + Math.round(d * 100) * 10 + s;
        count++;
        it(`n=${n} density=${d} seed=${seed}`, () => {
          const g = randomPlanarGraph(n, d, seed);
          expect(validateInput(g).ok, 'Generator muss kreuzungsfreie Zeichnung liefern').toBe(true);
          expectPass(g, `random n=${n} d=${d} s=${seed}`);
        });
      }
    }
  }
  it('deckt genuegend Instanzen ab', () => expect(count).toBeGreaterThanOrEqual(72));
});

describe('Augmentierung', () => {
  it('macht Graphen bikonnektiert, bleibt planar, Gradzuwachs <= 2', () => {
    for (let s = 1; s <= 30; s++) {
      const g = randomPlanarGraph(6 + (s % 20), (s % 4) * 0.25, 900 + s);
      const eg = buildEmbedding(g);
      const degBefore = Math.max(...eg.rot.map((r) => r.length));
      const added = augmentBiconnected(eg);
      expect(added, `Seed ${900 + s}`).toBeGreaterThanOrEqual(0);
      expect(isBiconnected(eg), `Seed ${900 + s}: bikonnektiert`).toBe(true);
      expect(isPlanarRotation(eg), `Seed ${900 + s}: planar (Euler)`).toBe(true);
      const degAfter = Math.max(...eg.rot.map((r) => r.length));
      expect(degAfter - degBefore, `Seed ${900 + s}: Gradzuwachs`).toBeLessThanOrEqual(2);
    }
  });
});

describe('st-Nummerierung', () => {
  it('erfuellt die st-Eigenschaft auf augmentierten Zufallsgraphen', () => {
    for (let s = 1; s <= 30; s++) {
      const g = randomPlanarGraph(5 + (s % 25), ((s * 7) % 5) * 0.25, 4000 + s);
      const eg = buildEmbedding(g);
      augmentBiconnected(eg);
      const e0 = eg.edges[0];
      const st = stNumbering(eg, e0.u, e0.v);
      expect(st, `Seed ${4000 + s}`).not.toBeNull();
      const order = st!;
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: eg.n }, (_, i) => i + 1));
      expect(order[e0.u]).toBe(1);
      expect(order[e0.v]).toBe(eg.n);
      for (let v = 0; v < eg.n; v++) {
        if (order[v] === 1 || order[v] === eg.n) continue;
        const nb = eg.rot[v].map((d) => order[d.to]);
        expect(Math.min(...nb), `Knoten ${v}`).toBeLessThan(order[v]);
        expect(Math.max(...nb), `Knoten ${v}`).toBeGreaterThan(order[v]);
      }
    }
  });
});
