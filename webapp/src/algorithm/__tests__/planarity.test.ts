// Tests fuer den Demoucron-Planaritaetstest mit Einbettungsberechnung.

import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { mulberry32, randomPlanarGraph } from '../../random';
import { isPlanarRotation } from '../embedding';
import { computeSlopesDrawing } from '../pipeline';
import { planarEmbedding } from '../planarity';
import type { InputGraph } from '../types';

function completeGraph(k: number): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) edges.push([i, j]);
  return edges;
}

function completeBipartite(a: number, b: number): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) edges.push([i, a + j]);
  return edges;
}

function petersen(): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    edges.push([i, (i + 1) % 5]);        // aeusserer Kreis
    edges.push([5 + i, 5 + ((i + 2) % 5)]); // innerer Pentagramm-Kreis
    edges.push([i, 5 + i]);              // Speichen
  }
  return edges;
}

/** Zufaellige Positionen -- erzeugt mit hoher Wahrscheinlichkeit Kreuzungen. */
function scramble(g: InputGraph, seed: number): InputGraph {
  const rnd = mulberry32(seed);
  return { ...g, pos: g.pos.map(() => ({ x: 40 + rnd() * 560, y: 40 + rnd() * 560 })) };
}

describe('planarEmbedding', () => {
  it('lehnt K5, K3,3 und Petersen ab', () => {
    expect(planarEmbedding(5, completeGraph(5))).toBeNull();
    expect(planarEmbedding(6, completeBipartite(3, 3))).toBeNull();
    expect(planarEmbedding(10, petersen())).toBeNull();
  });

  it('bettet K4 und K5 minus eine Kante ein', () => {
    const k4 = planarEmbedding(4, completeGraph(4));
    expect(k4).not.toBeNull();
    expect(isPlanarRotation(k4!)).toBe(true);
    const k5m = completeGraph(5).slice(1); // eine Kante entfernen
    const eg = planarEmbedding(5, k5m);
    expect(eg).not.toBeNull();
    expect(isPlanarRotation(eg!)).toBe(true);
  });

  it('bettet alle Beispielgraphen ein (nur Kantenliste, ohne Geometrie)', () => {
    for (const ex of EXAMPLES) {
      const eg = planarEmbedding(ex.graph.n, ex.graph.edges);
      expect(eg, ex.name).not.toBeNull();
      expect(isPlanarRotation(eg!), ex.name).toBe(true);
      // jede Kante genau einmal in der Rotation jedes Endpunkts
      const count = new Map<string, number>();
      eg!.rot.forEach((rot, v) => rot.forEach((d) => {
        const key = d.e + ':' + v;
        count.set(key, (count.get(key) ?? 0) + 1);
      }));
      eg!.edges.forEach((e, idx) => {
        expect(count.get(idx + ':' + e.u), ex.name).toBe(1);
        expect(count.get(idx + ':' + e.v), ex.name).toBe(1);
      });
    }
  });

  it('bettet Graphen mit Bruecken und Schnittknoten ein', () => {
    // zwei Dreiecke, verbunden ueber einen Pfad (Bloecke + Bruecken)
    const edges: Array<[number, number]> = [
      [0, 1], [1, 2], [2, 0],
      [2, 3], [3, 4],
      [4, 5], [5, 6], [6, 4],
    ];
    const eg = planarEmbedding(7, edges);
    expect(eg).not.toBeNull();
    expect(isPlanarRotation(eg!)).toBe(true);
  });
});

describe('Pipeline mit automatischer Einbettung', () => {
  it('verarbeitet verwuerfelte (kreuzende) Zeichnungen planarer Graphen', () => {
    for (let s = 1; s <= 25; s++) {
      const g = scramble(randomPlanarGraph(6 + (s % 20), (s % 4) * 0.33, 7000 + s), 100 + s);
      const res = computeSlopesDrawing(g);
      expect(res.ok, `Seed ${7000 + s}: ${res.error ?? ''}`).toBe(true);
      expect(res.verified, `Seed ${7000 + s}:\n${res.report ?? ''}`).toBe(true);
    }
  });

  it('verwuerfelte Beispielgraphen bestehen die Verifikation', () => {
    for (const ex of EXAMPLES) {
      const res = computeSlopesDrawing(scramble(ex.graph, 42));
      expect(res.ok, ex.name).toBe(true);
      expect(res.verified, `${ex.name}:\n${res.report ?? ''}`).toBe(true);
    }
  });

  it('meldet nicht-planare Graphen verstaendlich', () => {
    const pos = Array.from({ length: 5 }, (_, i) => ({ x: 100 + i * 50, y: 100 + (i % 2) * 200 }));
    const res = computeSlopesDrawing({ n: 5, edges: completeGraph(5), pos });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/planar/);
  });
});
