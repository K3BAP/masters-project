// @vitest-environment jsdom
//
// GraphML-Import/-Export: Rundlauf, Kreis-Fallback, Dedupe, Fehlerfaelle.
// jsdom stellt einen spec-treuen DOMParser bereit (Import); Export ist
// reines String-Bauen. (happy-dom parst die GraphML-Standardattribute
// attr.name/attr.type nicht korrekt und ist daher ungeeignet.)

import { describe, expect, it } from 'vitest';
import type { InputGraph } from '../algorithm/types';
import { EXAMPLES } from '../examples';
import { GraphMLError, graphMLToGraph, graphToGraphML } from '../graphml';

/** Kantenmenge als ungerichtete, kanonisierte Schluesselmenge. */
function edgeSet(g: InputGraph): Set<string> {
  return new Set(g.edges.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));
}

describe('GraphML-Rundlauf (Beispielgraphen)', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.id}: Export -> Import reproduziert den Graphen exakt`, () => {
      const g = ex.graph;
      const back = graphMLToGraph(graphToGraphML(g));
      expect(back.n).toBe(g.n);
      expect(edgeSet(back)).toEqual(edgeSet(g));
      // Positionen exakt (volle Double-Genauigkeit im Export).
      back.pos.forEach((p, v) => {
        expect(p.x).toBe(g.pos[v].x);
        expect(p.y).toBe(g.pos[v].y);
      });
    });
  }
});

describe('GraphML-Import (handgeschrieben)', () => {
  it('liest Knoten (beliebige IDs) und Kanten mit Koordinaten', () => {
    const xml = `<?xml version="1.0"?>
      <graphml xmlns="http://graphml.graphdrawing.org/xmlns">
        <key id="x" for="node" attr.name="x" attr.type="double"/>
        <key id="y" for="node" attr.name="y" attr.type="double"/>
        <graph edgedefault="undirected">
          <node id="a"><data key="x">10</data><data key="y">20</data></node>
          <node id="b"><data key="x">30</data><data key="y">40</data></node>
          <node id="c"><data key="x">50</data><data key="y">60</data></node>
          <edge source="a" target="b"/>
          <edge source="b" target="c"/>
        </graph>
      </graphml>`;
    const g = graphMLToGraph(xml);
    expect(g.n).toBe(3);
    expect(edgeSet(g)).toEqual(new Set(['0-1', '1-2']));
    expect(g.pos[0]).toEqual({ x: 10, y: 20 });
    expect(g.pos[2]).toEqual({ x: 50, y: 60 });
  });

  it('erkennt fremde Schluessel-IDs ueber attr.name', () => {
    const xml = `<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
      <key id="d0" for="node" attr.name="x" attr.type="double"/>
      <key id="d1" for="node" attr.name="y" attr.type="double"/>
      <graph>
        <node id="0"><data key="d0">7</data><data key="d1">8</data></node>
        <node id="1"><data key="d0">9</data><data key="d1">11</data></node>
      </graph></graphml>`;
    const g = graphMLToGraph(xml);
    expect(g.pos[0]).toEqual({ x: 7, y: 8 });
    expect(g.pos[1]).toEqual({ x: 9, y: 11 });
  });

  it('liest yEd-Geometrie als Fallback', () => {
    const xml = `<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
        xmlns:y="http://www.yworks.com/xml/graphml">
      <key id="d6" for="node" yfiles.type="nodegraphics"/>
      <graph>
        <node id="n0"><data key="d6"><y:ShapeNode>
          <y:Geometry x="100" y="200" width="30" height="30"/>
        </y:ShapeNode></data></node>
        <node id="n1"><data key="d6"><y:ShapeNode>
          <y:Geometry x="300" y="400" width="30" height="30"/>
        </y:ShapeNode></data></node>
        <edge source="n0" target="n1"/>
      </graph></graphml>`;
    const g = graphMLToGraph(xml);
    expect(g.n).toBe(2);
    expect(g.pos[0]).toEqual({ x: 100, y: 200 });
    expect(g.pos[1]).toEqual({ x: 300, y: 400 });
  });

  it('fehlende Koordinaten -> Kreis-Layout (verschieden, im View-Bereich)', () => {
    const xml = `<graphml><graph>
      <node id="0"/><node id="1"/><node id="2"/><node id="3"/>
      <edge source="0" target="1"/>
    </graph></graphml>`;
    const g = graphMLToGraph(xml);
    expect(g.n).toBe(4);
    const keys = new Set(g.pos.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
    expect(keys.size).toBe(4); // paarweise verschieden
    for (const p of g.pos) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(640);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(640);
    }
  });

  it('entfernt Schleifen und doppelte/antiparallele Kanten', () => {
    const xml = `<graphml><graph>
      <node id="0"/><node id="1"/><node id="2"/>
      <edge source="0" target="1"/>
      <edge source="1" target="0"/>
      <edge source="0" target="1"/>
      <edge source="2" target="2"/>
      <edge source="1" target="2"/>
    </graph></graphml>`;
    const g = graphMLToGraph(xml);
    expect(edgeSet(g)).toEqual(new Set(['0-1', '1-2']));
    expect(g.edges.length).toBe(2);
  });
});

describe('GraphML-Import (Fehlerfaelle)', () => {
  const expectCode = (fn: () => unknown, code: string) => {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(GraphMLError);
      expect((e as GraphMLError).code).toBe(code);
      return;
    }
    throw new Error(`erwartete GraphMLError(${code}), aber kein Fehler`);
  };

  it('leerer Text -> empty', () => {
    expectCode(() => graphMLToGraph('   '), 'empty');
  });

  it('kaputtes XML -> invalid-xml', () => {
    expectCode(() => graphMLToGraph('<graphml><node id="a"></graphml>'), 'invalid-xml');
  });

  it('kein <graph> -> no-graph', () => {
    expectCode(
      () => graphMLToGraph('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="x"/></graphml>'),
      'no-graph',
    );
  });

  it('Graph ohne Knoten -> empty', () => {
    expectCode(() => graphMLToGraph('<graphml><graph></graph></graphml>'), 'empty');
  });

  it('Kante auf unbekannte Knoten-ID -> unknown-node', () => {
    expectCode(
      () => graphMLToGraph('<graphml><graph><node id="0"/><edge source="0" target="99"/></graph></graphml>'),
      'unknown-node',
    );
  });
});

describe('GraphML-Export', () => {
  it('schreibt Knoten, Kanten und Koordinaten-Schluessel', () => {
    const g: InputGraph = {
      n: 2,
      edges: [[0, 1]],
      pos: [{ x: 1.5, y: 2 }, { x: 3, y: 4.25 }],
    };
    const xml = graphToGraphML(g);
    expect(xml).toContain('edgedefault="undirected"');
    expect(xml).toContain('attr.name="x"');
    expect(xml).toContain('<node id="n0">');
    expect(xml).toContain('<data key="x">1.5</data>');
    expect(xml).toContain('<edge source="n0" target="n1"/>');
    // wohlgeformt: Rundlauf gelingt
    expect(graphMLToGraph(xml).n).toBe(2);
  });
});
