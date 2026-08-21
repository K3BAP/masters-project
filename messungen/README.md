# Messungen

Rohdaten und Auswertung der systematischen Vermessung (Abschnitt 6 des
Berichts, Anhang B).

## Erzeugen

```
cmake -S . -B build && cmake --build build --target measure
./build/measure --seeds 10 --out messungen/roh.csv
python3 messungen/auswerten.py
```

Der Selbsttest prüft das Werkzeug gegen vier unabhängig feststehende Werte:

```
./build/measure --selbsttest
```

Beide Schritte sind vom Wurzelverzeichnis dieses Repositories aus
aufzurufen: `measure` sucht den Beispielgraphen des Papers unter
`abbildungen/paper-fig1.graphml` und schreibt die Rohdaten nach
`messungen/`. Andere Ablagen lassen sich über `--paper` und `--out` angeben.

## Dateien

| Datei | Inhalt |
|---|---|
| `roh.csv` | eine Zeile je Lauf, wird eingecheckt |
| `lauf.log` | stderr der Kampagne (Phasen, Dauer, Fehlschläge) |
| `auswerten.py` | Aggregation, nur Standardbibliothek |
| `flaeche-thm4.csv`, `flaeche-thm1.csv` | Fläche über n je Familie (Median, Min, Max, Schranke) |
| `steigungen-thm4.csv`, `steigungen-thm1.csv` | Steigungen über Delta, getrennt nach augmentiert |
| `ksweep-*.csv` | k-Sweep je Instanz |
| `kwahl.csv` | Seitenverhältnis und Fläche für drei Wahlen von k |
| `zeit.csv` | Laufzeit über n auf maximal-planaren Graphen |
| `tabelle-thm4.tex`, `tabelle-thm1.tex` | Tabellenrümpfe für Anhang B |
| `kennzahlen.tex` | `\newcommand`-Makros für jede Zahl im Fließtext |

`kennzahlen.tex` und die beiden Tabellenrümpfe werden vom Projektbericht
eingelesen, der in einem eigenen Repository liegt. Keine Zahl aus der
Messung steht von Hand im Text -- wer die Kampagne neu laufen lässt,
aktualisiert damit auch den Bericht.

## Lauf dieses Berichts

1016 Läufe, alle verifiziert, 193 Sekunden auf einem Apple-M-Prozessor
unter macOS 15 mit LEDA 7. Davon 676 Hauptkampagne, 60 k-Sweep und
280 k-Wahl-Experiment (85 Instanzen zu je drei bis vier Läufen).
