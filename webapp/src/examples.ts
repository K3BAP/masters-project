// Beispielgraphen mit planaren Zeichnungskoordinaten (Bildschirm, y nach unten).

import type { InputGraph } from './algorithm/types';

export interface Example {
  id: string;
  name: string;
  description: string;
  graph: InputGraph;
}

function circle(cx: number, cy: number, r: number, k: number, phase = -Math.PI / 2) {
  return Array.from({ length: k }, (_, i) => ({
    x: cx + r * Math.cos(phase + (2 * Math.PI * i) / k),
    y: cy + r * Math.sin(phase + (2 * Math.PI * i) / k),
  }));
}

function k4(): InputGraph {
  return {
    n: 4,
    pos: [...circle(300, 280, 200, 3), { x: 300, y: 280 }],
    edges: [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]],
  };
}

function octahedron(): InputGraph {
  // K_2,2,2: Nicht-Nachbarpaare (0,3), (1,4), (2,5)
  const pos = [
    { x: 300, y: 60 },   // 0 = a  (aussen oben)
    { x: 80, y: 460 },   // 1 = b  (aussen links)
    { x: 520, y: 460 },  // 2 = c  (aussen rechts)
    { x: 300, y: 390 },  // 3 = a' (innen unten)
    { x: 390, y: 265 },  // 4 = b' (innen rechts)
    { x: 210, y: 265 },  // 5 = c' (innen links)
  ];
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 6; j++) {
      if (j - i === 3) continue; // gegenueberliegendes Paar
      edges.push([i, j]);
    }
  }
  return { n: 6, pos, edges };
}

function wheel(k: number): InputGraph {
  const pos = [...circle(300, 280, 220, k), { x: 300, y: 280 }];
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < k; i++) {
    edges.push([i, (i + 1) % k]);
    edges.push([i, k]);
  }
  return { n: k + 1, pos, edges };
}

function star(k: number): InputGraph {
  const pos = [{ x: 300, y: 280 }, ...circle(300, 280, 220, k)];
  const edges: Array<[number, number]> = [];
  for (let i = 1; i <= k; i++) edges.push([0, i]);
  return { n: k + 1, pos, edges };
}

function grid(w: number, h: number): InputGraph {
  const pos = [];
  const edges: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      pos.push({ x: 120 + x * 120, y: 100 + y * 120 });
      const id = y * w + x;
      if (x + 1 < w) edges.push([id, id + 1]);
      if (y + 1 < h) edges.push([id, id + w]);
    }
  }
  return { n: w * h, pos, edges };
}

function path(k: number): InputGraph {
  const pos = Array.from({ length: k }, (_, i) => ({ x: 80 + i * 90, y: 280 }));
  const edges: Array<[number, number]> = [];
  for (let i = 0; i + 1 < k; i++) edges.push([i, i + 1]);
  return { n: k, pos, edges };
}

function icosahedron(): InputGraph {
  // 5-regulaer, 3-zusammenhaengend; erzwingt in Theorem 1 den Sonderfall
  // deg(v_n) = Δ. Koordinaten: Tutte-Einbettung mit Aussenflaeche
  // (0, 2, 3), auf Gitterpunkte gerundet (kreuzungsfrei verifiziert).
  const pos = [
    { x: 300, y: 40 }, { x: 300, y: 418 }, { x: 40, y: 560 }, { x: 560, y: 560 },
    { x: 371, y: 339 }, { x: 300, y: 292 }, { x: 229, y: 339 }, { x: 300, y: 481 },
    { x: 371, y: 434 }, { x: 324, y: 371 }, { x: 276, y: 371 }, { x: 229, y: 434 },
  ];
  const top = 0, bot = 1;
  const u = (i: number) => 2 + i;
  const l = (i: number) => 7 + i;
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    edges.push([top, u(i)], [bot, l(i)]);
    edges.push([u(i), u((i + 1) % 5)], [l(i), l((i + 1) % 5)]);
    edges.push([u(i), l(i)], [l(i), u((i + 1) % 5)]);
  }
  return { n: 12, pos, edges };
}

function antiprism(k: number): InputGraph {
  // 4-regulaer, 3-zusammenhaengend: zwei konzentrische Ringe + Zickzack.
  const outer = circle(300, 280, 230, k);
  const inner = circle(300, 280, 110, k, -Math.PI / 2 + Math.PI / k);
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < k; i++) {
    edges.push([i, (i + 1) % k]);                 // aussen
    edges.push([k + i, k + ((i + 1) % k)]);       // innen
    edges.push([i, k + i]);                       // Zickzack
    edges.push([(i + 1) % k, k + i]);
  }
  return { n: 2 * k, pos: [...outer, ...inner], edges };
}

export const EXAMPLES: Example[] = [
  { id: 'k4', name: 'K4', description: 'Vollstaendiger Graph, Δ=3 → 2 Steigungen', graph: k4() },
  {
    id: 'octahedron', name: 'Oktaeder',
    description: '4-regulaer; die beweisbare Ausnahme: 3 Steigungen', graph: octahedron(),
  },
  { id: 'wheel8', name: 'Rad W₈', description: 'Nabe mit Grad 8 → 4 Steigungen', graph: wheel(8) },
  { id: 'wheel12', name: 'Rad W₁₂', description: 'Nabe mit Grad 12 → 6 Steigungen', graph: wheel(12) },
  {
    id: 'star10', name: 'Stern S₁₀',
    description: 'Baum, Δ=10; zeigt Bikonnektivitaets-Augmentierung', graph: star(10),
  },
  { id: 'grid44', name: 'Gitter 4×4', description: 'Bikonnektiert, Δ=4 → orthogonal (2 Steigungen)', graph: grid(4, 4) },
  { id: 'path6', name: 'Pfad P₆', description: 'Minimalbeispiel mit Augmentierung', graph: path(6) },
  {
    id: 'icosahedron', name: 'Ikosaeder',
    description: '5-regulaer, 3-zusammenhaengend; Theorem-1-Sonderfall deg(v_n)=Δ',
    graph: icosahedron(),
  },
  {
    id: 'antiprism6', name: 'Antiprisma A₆',
    description: '4-regulaer, 3-zusammenhaengend; Theorem 1 ohne Augmentierung',
    graph: antiprism(6),
  },
];
