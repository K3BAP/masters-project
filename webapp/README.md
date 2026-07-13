# Webapp: Planare Zeichnungen mit wenigen Steigungen

Interaktive SPA-Demonstration zweier Algorithmen aus
Bekos, Katsanou, Kindermann, Pavlidi: *„How Many Slopes Does Polynomial Area Cost?"*
(arXiv:2605.31098), umschaltbar in der Kopfzeile:

- **Theorem 4 + Korollar 5** — 2-Bend-planare Gitterzeichnungen mit höchstens
  ⌈Δ/2⌉ Steigungen (⌈Δ/2⌉+1 bei Bikonnektivitäts-Augmentierung) auf einem
  O(n) × O(Δn²)-Gitter (st-Nummerierung, Ports, Spaltenrouting).
- **Theorem 1 + Korollar 2** — 1-Bend-planare Gitterzeichnungen mit höchstens
  3Δ−8 Steigungen (⌈9Δ/2⌉+1 bei 3-Zusammenhangs-Augmentierung) auf einem
  O(Δn²) × O(Δn³)-Gitter (kanonische Ordnung, Schnyder-artige 4-Kantenfärbung,
  Cut-basierte horizontale Streckung).

Die Referenzimplementierungen in C++/LEDA liegen im Repository-Wurzelverzeichnis
(`slopes_core.cpp` bzw. `onebend_core.cpp`, `canonical_order.cpp`, `planar_aug.cpp`;
Details in `IMPLEMENTIERUNGSBERICHT_SLOPES.md`). Da LEDA proprietär ist, enthält
die Webapp eigenständige **TypeScript-Ports** (`src/algorithm/`,
`src/algorithm/onebend/`), die dieselben Invarianten mit geometrischen Verifiern
(BigInt-Arithmetik) nachprüfen.

## Funktionen

- **Algorithmus-Umschalter**: „2 Knicke · ⌈Δ/2⌉" (Theorem 4) oder
  „1 Knick · 3Δ−8" (Theorem 1) in der Kopfzeile.
- **Parameter k (Theorem 1)**: statt der Papier-Wahl k = 4·Δ_eff·n² (nötig für
  den Flächenbeweis) lässt sich k manuell setzen (ganzzahlig, ≥ Δ_eff−2).
  Kleines k macht die Zeichnung dramatisch flacher — die steilen Steigungen
  ±k/j werden als echte Schrägen sichtbar — auf Kosten der (dann nicht mehr
  durch 12Δn² beschränkten) Breite; der Verifier prüft stattdessen die
  k-parametrisierte Höheninvariante H ≤ n·(B+k). Ein Koordinaten-Guard bricht
  bei extremem Breitenwachstum sauber ab.
- **Wurzeln v₁, v₂, vₙ (Theorem 1)**: die Wurzeln der kanonischen Ordnung
  (P₀ = {v₁, v₂}, letzter Knoten vₙ) lassen sich einzeln vorgeben (leer =
  automatisch), z. B. um eine Zeichnung mit einer Abbildung aus dem Paper zu
  vergleichen. (v₁,v₂) und (v₁,vₙ) müssen Kanten auf einer gemeinsamen
  Fläche sein; ungültige Vorgaben liefern eine klare Fehlermeldung.
- **Grapheditor**: Knoten setzen, Kanten ziehen, verschieben, löschen — mit
  kontextabhängigen Cursorn und Hover-Feedback. Kreuzungsfreie Zeichnungen behalten
  ihre gezeichnete Einbettung (Rotationssystem aus der Geometrie). Zeichnungen mit
  Kreuzungen werden trotzdem akzeptiert: ein Planaritätstest nach
  **Demoucron-Malgrange-Pertuiset** berechnet automatisch eine planare Einbettung
  (das Pendant zu LEDAs `PLANAR(G, true)`); nicht-planare Graphen (K₅, K₃,₃, …)
  werden mit Meldung abgelehnt.
- **Beispiele + Zufallsgenerator**: Oktaeder (Theorem-4-Ausnahme), Ikosaeder
  (Theorem-1-Sonderfall deg(vₙ)=Δ), Antiprisma, Räder, Stern, Gitter; zufällige
  planare Graphen über Delaunay-Triangulierung mit Dichteregler.
- **GraphML-Import/-Export**: der aktuelle Editorgraph lässt sich als
  standardkonformes GraphML herunterladen (die Zeichnungskoordinaten werden
  über eigene `x`/`y`-Schlüssel mitgeschrieben, ein Export → Import reproduziert
  den Graphen exakt) und eine GraphML-Datei wieder einlesen. Der Importer ist
  tolerant (beliebige Knoten-IDs, Richtung wird ignoriert, Schleifen/Duplikate
  entfernt; fehlende Koordinaten → Kreis-Layout, auch yEd-`<y:Geometry>`) und
  meldet ungültige Dateien mit übersetzter Fehlermeldung.
- **Schrittansicht**: Theorem 4 inkrementell entlang der st-Nummerierung
  (Pending-Kanten-Stummel, Median-Hervorhebung); Theorem 1 über vollständige
  **Snapshots** pro Konstruktionsschritt — die Cut-Streckungen verschieben auch
  bereits platzierte Teile, sodass sich Zwischenstände nicht aus dem Endbild
  ableiten lassen.
- **Ergebnisansicht**: Segmentfärbung nach Steigung, Steigungsmengen-Legende
  (Theorem 1: rationale Steigungen ±k/j und j/(Δ−3), steile schematisch gespreizt),
  Pan/Zoom, Umschalter kompakt (y anisotrop gestaucht — Parallelität bleibt
  erhalten) / maßstabsgetreu; Hilfskanten der Augmentierung einblendbar.
- **Verifikation**: nach jedem Lauf werden Planarität, Knickzahl (≤ 2 bzw. ≤ 1),
  die exakte Steigungsmengen-Zugehörigkeit (Theorem 1: rationale Tests, Kantenform
  je Farbe, Knoten-y ≡ 0 mod k) und die Flächenschranken exakt nachgemessen
  (PASS/FAIL).
- **Mehrsprachig**: Deutsch, Englisch und Griechisch; Umschalter in der Kopfzeile
  (leichtgewichtiges eigenes i18n-Modul in `src/i18n.tsx`, Wahl wird gespeichert).

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Vitest-Property-Suite (beide Algorithmen)
npm run build      # Produktions-Build nach dist/
```

## Abweichungen gegenüber der C++-Referenz

- Einbettung aus der Zeichnungsgeometrie (kreuzungsfreie Zeichnungen) bzw.
  Demoucron-Planarisierung (O(n²)) statt LEDA `PLANAR`.
- st-Nummerierung über offene Ohren-Dekomposition (statt LEDA `ST_NUMBERING`).
- Bikonnektivitäts- und Trikonnektivitäts-Augmentierung über **Flächen-Chorden**
  (gradschonend; Separationspaare per Brute-Force statt LEDA `Is_Triconnected`).
- Kanonische Ordnung, 4-Kantenfärbung, Cut-Streckung und 1-Bend-Verifier sind
  direkte Ports von `canonical_order.cpp` / `onebend_core.cpp`.

Alle Punkte sind durch die Property-Tests (`src/algorithm/__tests__/`) gegen
die Papier-Spezifikationen abgesichert.
