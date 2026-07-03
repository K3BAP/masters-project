// Gemeinsamer Pan/Zoom-Hook der Ergebnisansichten (extrahiert aus
// DrawingView). Rechnung durchgehend in viewBox-Einheiten: svgPoint
// liefert den Zeiger im Wurzel-Koordinatensystem des SVG (inkl.
// Letterboxing); der Wheel-Listener ist non-passive, damit die Seite
// nicht scrollt und der Zoom auf den Cursor zentriert bleibt.

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { svgPoint } from './svgUtils';

export interface PanZoom {
  tf: { k: number; x: number; y: number };
  reset: () => void;
  /** true, solange die letzte Geste ein Drag war (Klick-Unterdrueckung). */
  movedRef: RefObject<boolean>;
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
  };
}

export function usePanZoom(svgRef: RefObject<SVGSVGElement | null>): PanZoom {
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  // Klick vs. Pan unterscheiden: erst ab 4px Bewegung gilt es als Drag
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const p = svgPoint(svg, e.clientX, e.clientY);
      setTf((t) => {
        const k = Math.min(80, Math.max(0.05, t.k * factor));
        const scale = k / t.k;
        // Weltpunkt unter dem Zeiger bleibt fest: t' = p - (p - t)·(k'/k)
        return { k, x: p.x - (p.x - t.x) * scale, y: p.y - (p.y - t.y) * scale };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef]);

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = svgPoint(svgRef.current!, e.clientX, e.clientY);
    dragStart.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    if (dragStart.current &&
        Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 4) {
      moved.current = true;
    }
    if (!moved.current) return;
    const p = svgPoint(svgRef.current!, e.clientX, e.clientY);
    const dx = p.x - drag.current.x, dy = p.y - drag.current.y;
    drag.current = p;
    setTf((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  };
  const onMouseUp = () => { drag.current = null; };

  return {
    tf,
    reset: () => setTf({ k: 1, x: 0, y: 0 }),
    movedRef: moved,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
  };
}
