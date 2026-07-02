# Webapp: Planare Zeichnungen mit ⌈Δ/2⌉ Steigungen

Interaktive SPA-Demonstration des Algorithmus aus **Theorem 4 + Korollar 5** von
Bekos, Katsanou, Kindermann, Pavlidi: *„How Many Slopes Does Polynomial Area Cost?"*
(arXiv:2605.31098) — 2-Bend-planare Gitterzeichnungen mit höchstens ⌈Δ/2⌉ Steigungen
(⌈Δ/2⌉+1 bei Bikonnektivitäts-Augmentierung) auf einem O(n) × O(Δn²)-Gitter.

Die Referenzimplementierung in C++/LEDA liegt im Repository-Wurzelverzeichnis
(`slopes_core.cpp`, Details in `IMPLEMENTIERUNGSBERICHT_SLOPES.md`). Da LEDA
proprietär ist, enthält die Webapp einen eigenständigen **TypeScript-Port** des
Algorithmus (`src/algorithm/`), der dieselben Invarianten mit einem geometrischen
Verifier (BigInt-Arithmetik) nachprüft.

## Funktionen

- **Grapheditor**: Knoten setzen, Kanten ziehen, verschieben, löschen — mit
  kontextabhängigen Cursorn und Hover-Feedback. Kreuzungsfreie Zeichnungen behalten
  ihre gezeichnete Einbettung (Rotationssystem aus der Geometrie). Zeichnungen mit
  Kreuzungen werden trotzdem akzeptiert: ein Planaritätstest nach
  **Demoucron-Malgrange-Pertuiset** berechnet automatisch eine planare Einbettung
  (das Pendant zu LEDAs `PLANAR(G, true)`); nicht-planare Graphen (K₅, K₃,₃, …)
  werden mit Meldung abgelehnt.
- **Beispiele + Zufallsgenerator**: Oktaeder (die 3-Steigungen-Ausnahme), Räder,
  Stern, Gitter; zufällige planare Graphen über Delaunay-Triangulierung mit
  Dichteregler.
- **Schrittansicht**: inkrementeller Aufbau entlang der st-Nummerierung mit
  Pending-Kanten-Stummeln, Median-Hervorhebung und Erklärungstexten.
- **Ergebnisansicht**: Segmentfärbung nach Steigung, Steigungsmengen-Legende,
  Pan/Zoom, Umschalter kompakt (y anisotrop gestaucht — Parallelität bleibt
  erhalten) / maßstabsgetreu; Hilfskanten der Augmentierung einblendbar.
- **Verifikation**: nach jedem Lauf werden Planarität, ≤ 2 Knicke, die strikte
  Steigungsschranke und die Flächenschranken exakt nachgemessen (PASS/FAIL).

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Vitest-Property-Suite (Beispiele + Delaunay-Zufallsgraphen)
npm run build      # Produktions-Build nach dist/
```

## Abweichungen gegenüber der C++-Referenz

- Einbettung aus der Zeichnungsgeometrie (kreuzungsfreie Zeichnungen) bzw.
  Demoucron-Planarisierung (O(n²)) statt LEDA `PLANAR`.
- st-Nummerierung über offene Ohren-Dekomposition (statt LEDA `ST_NUMBERING`).
- Bikonnektivitäts-Augmentierung über **Flächen-Chorden** (Verallgemeinerung der
  Bypass-Kanten aus der C++-Version; vermeidet Gradanhäufung z. B. bei
  Spinnen-Bäumen und hält den Maximalgradzuwachs ≤ 2).

Alle drei Punkte sind durch die Property-Tests (`src/algorithm/__tests__/`) gegen
die Papier-Spezifikationen abgesichert.
