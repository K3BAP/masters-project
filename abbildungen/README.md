# Abbildungen

## Herkunft

Die Zeichnungen stammen aus der Webanwendung (`webapp/`, `npm run dev`) und
wurden als SVG aus dem DOM exportiert, nicht abfotografiert. Damit sind sie
Vektorgrafiken und bleiben beim Zoomen scharf.

| Datei | Inhalt |
| --- | --- |
| `thm4-w8.svg` | Rad W₈ nach Theorem 4, Export aus der Ergebnisansicht (dunkles Thema) |
| `thm1-w8.svg` | Rad W₈ nach Theorem 1 mit k = 12 (dunkles Thema) |
| `legend-thm1.svg` | Steigungsmenge S für Δ_eff = 8 (dunkles Thema) |
| `*-light.svg` | dieselben Grafiken mit hellem Farbschema für den Druck |
| `*.pdf` | daraus erzeugte Vektor-PDFs, die der Projektbericht einbindet |

## Neu erzeugen

1. Webanwendung starten, Graph laden, „Zeichnung berechnen“.
2. Für Theorem 1: Haken bei „k automatisch“ entfernen und k = 12 setzen,
   sonst ist das Gitter 70 × 15566 und die Zeichnung unlesbar.
3. SVG aus dem DOM exportieren (`svg.drawing-canvas`), dabei die berechneten
   Stile inline schreiben, da die Farben aus der CSS-Datei kommen.
4. Farben auf helles Schema umstellen (Hintergrund weiß, Beschriftung dunkel,
   gelbe und türkise Kanten abdunkeln).
5. Nach PDF wandeln:

```bash
python -c "from svglib.svglib import svg2rlg; from reportlab.graphics import renderPDF; renderPDF.drawToFile(svg2rlg('x-light.svg'),'x.pdf')"
```

`svglib` und `reportlab` sind reine Python-Pakete, es wird also weder Inkscape
noch Cairo benötigt.

## Paper-Vergleich

`paper-fig1.graphml` ist der Beispielgraph aus Abbildung 1 von
Bekos et al. (13 Knoten, 25 Kanten, Δ = 5), abgelesen aus dem PDF und
gegengeprüft: Die Implementierung meldet für ihn Δ = 5, keine Augmentierung,
7 = 3Δ−8 Steigungen und den Sonderfall deg(vₙ) = Δ, wie es das Paper erwarten
lässt. Import über „Import“ im Grapheditor.

`paper-thm1.svg` entstand daraus mit Theorem 1, den Wurzelknoten v₁, v₂, v₁₃
und k = 4 wie im Paper. Die Knotenbeschriftung wurde für die Abbildung von der
0-basierten Zählung der Anwendung auf die Paper-Nummerierung v₁…v₁₃ umgestellt
und vergrößert.
