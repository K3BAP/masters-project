// Pointer-Koordinaten exakt in SVG-viewBox-Einheiten umrechnen.
// getScreenCTM beruecksichtigt preserveAspectRatio (Letterboxing),
// viewBox-Offset und CSS-Skalierung -- im Gegensatz zur naiven Division
// durch getBoundingClientRect-Masse.

import type { Point } from '../algorithm/types';

export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
