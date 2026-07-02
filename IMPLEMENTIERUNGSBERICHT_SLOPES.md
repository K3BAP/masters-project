# Implementierungsbericht: 2-Bend-planare Zeichnungen mit ⌈Δ/2⌉ Steigungen

**Implementierung von Theorem 4 und Korollar 5 aus Bekos, Katsanou, Kindermann, Pavlidi: „How Many Slopes Does Polynomial Area Cost?" (arXiv:2605.31098) auf Basis von LEDA/GraphWin**

Stand: 2. Juli 2026

---

## Zusammenfassung

Dieser Bericht dokumentiert die Implementierung des Zeichenalgorithmus aus Abschnitt 4 des oben genannten Papers: Jeder bikonnektierte planare Graph mit Maximalgrad Δ ≥ 3 erhält eine planare Gitterzeichnung mit höchstens **zwei Knicken pro Kante** und höchstens **⌈Δ/2⌉ Steigungen** auf einem Gitter der Größe **O(n) × O(Δn²)**; nicht-bikonnektierte planare Graphen benötigen nach Augmentierung höchstens eine zusätzliche Steigung (Korollar 5). Der Algorithmus ist die direkte Verallgemeinerung des Biedl-Kant-Algorithmus (Δ ≤ 4, zwei Steigungen), dessen Implementierung in diesem Repository (`biedl_kant.cpp`) als strukturelle Vorlage diente.

Die Implementierung wurde gegen die Spezifikationen des Papers mit einem exakt rechnenden geometrischen Verifier und einem randomisierten Stresstest über **ca. 8 400 Testinstanzen** validiert (null Fehlschläge); die Aussagekraft des Verifiers selbst wurde durch einen Mutationstest belegt. Zwei wohlbegründete Abweichungen von der Papierkonstruktion waren notwendig, weil LEDA-Primitive (`ST_NUMBERING`, `Make_Biconnected`) die vom Paper vorausgesetzten Eigenschaften nicht liefern; beide Abweichungen sind theoretisch fundiert und ändern keine der bewiesenen Schranken (Abschnitt 5).

---

## 1 Einleitung und Zielsetzung

Der Algorithmus von Biedl und Kant [BK98] zeichnet planare Graphen mit Maximalgrad Δ ≤ 4 orthogonal (zwei Steigungen: horizontal und vertikal) mit höchstens zwei Knicken pro Kante auf einem Gitter polynomieller Größe. Keszegh, Pach und Pálvölgyi [KPP13] verallgemeinerten die Methode auf beliebigen Maximalgrad: ⌈Δ/2⌉ äquidistante Steigungen genügen (einzige Ausnahme: der Oktaeder, der drei Steigungen benötigt). Die KPP-Konstruktion liefert jedoch keine Gitterzeichnung polynomieller Fläche.

Bekos, Katsanou, Kindermann und Pavlidi [BKKP26] schließen diese Lücke: **Theorem 4** ersetzt die äquidistanten Steigungen durch die ganzzahlige Steigungsmenge

> S = { −⌊Δ/4⌋+1, …, −1, 0, 1, …, ⌈Δ/4⌉−1 } ∪ { ∞ }   (|S| = ⌈Δ/2⌉ für gerades Δ)

und erreicht damit, dass alle Knoten **und alle Knickpunkte** auf Gitterpunkten eines O(n) × O(Δn²)-Gitters liegen. **Korollar 5** überträgt das Resultat mittels Bikonnektivitäts-Augmentierung (Kant-Bodlaender-Stil, Maximalgrad wächst um höchstens 2) auf beliebige planare Graphen mit einer Zusatzsteigung.

Ziel der vorliegenden Arbeit war eine Implementierung dieses Algorithmus als eigenständige GraphWin-Anwendung neben der bestehenden Biedl-Kant-Implementierung, einschließlich einer automatisierten Verifikation der Papier-Spezifikationen.

## 2 Zeichnungsmodell und theoretische Grundlagen

### 2.1 Kantenmodell

Jede Kante (v_i, v_j) mit i < j in der st-Ordnung wird als Polygonzug aus drei Teilstücken gezeichnet:

1. ein erstes, nicht-vertikales Segment am unteren Knoten v_i mit ganzzahliger Steigung aus S (Länge möglicherweise null),
2. ein **vertikales Mittelsegment** in der Gitterspalte x(e),
3. ein letztes, nicht-vertikales Segment am oberen Knoten v_j (Länge möglicherweise null).

Daraus folgen unmittelbar höchstens zwei Knicke pro Kante. Da jede endliche Steigung ganzzahlig ist und Spalten ganzzahlige x-Koordinaten haben, liegen beide Knickpunkte auf Gitterpunkten.

### 2.2 Ports

Jede Steigung definiert an einem Knoten zwei gerichtete Strahlen („Ports"); ein Knoten besitzt also 2·⌈Δ/2⌉ ≥ Δ Ports, identifiziert durch das Paar (Steigung, Halbebene) bzw. (∞, oben/unten). Für Δ = 4 degeneriert das Modell zu S = {0, ∞} mit den vier orthogonalen Ports des Biedl-Kant-Algorithmus — die Implementierung enthält den orthogonalen Fall somit als Spezialfall (vgl. Abschnitt 6.4).

### 2.3 Inkrementelle Konstruktion

Wie bei Biedl-Kant wird eine st-Nummerierung v_1, …, v_n berechnet; Knoten v_i erhält die Zeile y(v_i) = (i−1)·R mit Zeilenabstand

> R = (Δ_eff/2)·(2m−n) + 1.

Die „pending edges" (Kanten von G_i nach G ∖ G_i) werden als vertikale Segmente in Spalten geführt. Beim Einfügen von v_i wird der Knoten **über der Median-In-Kante** platziert (deren letztes Segment entfällt, sie erhält nur einen Knick); die übrigen In-Kanten schließen mit schrägen Segmenten an, die Out-Kanten erhalten frisch allokierte Spalten. Da jedes nicht-vertikale Segment eine vertikale Ausdehnung von höchstens ⌊Δ/4⌋·(2m−n) besitzt, garantiert der Zeilenabstand R, dass sich Segmente benachbarter Zeilen niemals berühren — auch dann nicht, wenn Ports „umschlagen" (Abschnitt 4.2). Die Breite ist durch 2m−n = Σ_v (deg(v)−1) beschränkt, die Höhe durch (n−1)·R ∈ O(Δn²).

## 3 Architektur

| Datei | Inhalt |
|---|---|
| `slopes_core.h` / `slopes_core.cpp` | Algorithmuskern und geometrischer Verifier; bewusst **ohne GraphWin-/X11-Abhängigkeit**, damit derselbe Code interaktiv und headless nutzbar ist |
| `biedl_kant_slopes.cpp` | interaktive GraphWin-Anwendung, Arbeitsablauf identisch zur bestehenden `biedl_kant`-App (Zeichnen → „Done" → Layout → Statistik-/Verifikationsmeldung → Reset) |
| `slopes_test.cpp` | Headless-Stresstest: Zufallsgraphen, Spezialfälle, `.gw`-Dateien; Optionen `-v`, `-s <seed>`, `-n <maxgröße>` |
| `CMakeLists.txt` | zwei neue Targets `biedl_kant_slopes` und `slopes_test`; die bestehende Biedl-Kant-Implementierung bleibt unberührt |

Der Kern exponiert zwei Funktionen:

```cpp
bool compute_slopes_drawing(graph& G, SlopesResult& result,
                            node_array<int>* st_num_out, bool verbose);
bool verify_slopes_drawing(const graph& G, SlopesResult& result, std::string& report);
```

`SlopesResult` enthält logische (ganzzahlige) Gitterkoordinaten für Knoten und Knickpunkte sowie Statistiken (Δ, Δ_eff, benutzte Steigungen, Gittermaße, Augmentierungs-Flags). Die GUI skaliert lediglich mit einem Pixelfaktor.

## 4 Algorithmische Umsetzung

### 4.1 Aufgeschobene Geometrie (zentrale Designentscheidung)

Die Biedl-Kant-Implementierung dieses Repositories speichert Knickpunkte bereits während des Routings und verschiebt sie bei Spalteneinfügungen (`shift_right`) mit. Für orthogonale Segmente ist das korrekt, denn horizontale Segmente dürfen beliebig gestreckt werden. **Für schräge Segmente gilt das nicht:** Das Einfügen einer Spalte zwischen den Endpunkten eines schrägen Segments veränderte dessen Steigung — genau die Eigenschaft, die der Algorithmus garantieren soll. (Dies entspricht der Beobachtung im Paper, dass „Cuts" nur horizontale Segmente strecken dürfen.)

Die Implementierung löst das strukturell: Das Routing vergibt ausschließlich **Kombinatorik** —

- `x_node[v]` (Knotenspalte), `x_edge[e]` (Spalte des vertikalen Mittelsegments),
- `slope_src[e]`, `slope_tgt[e]` (Portsteigungen an beiden Endpunkten).

`shift_right` inkrementiert nur Spaltenindizes. Erst ein einziger Abschlussdurchlauf berechnet sämtliche Koordinaten geschlossen:

> b₁ = ( x(e), y(u) + ℓ_src·(x(e) − x(u)) ),  b₂ = ( x(e), y(w) − ℓ_tgt·(x(w) − x(e)) ).

Damit ist Verschiebungssicherheit trivial gewährleistet, und die Knickformeln liefern per Konstruktion Gitterpunkte.

### 4.2 Universelle Portvergabe statt Fallunterscheidung

Die 4×4-Fallunterscheidung (In-/Out-Grad 0–4) der orthogonalen Implementierung wird durch eine einzige Regel ersetzt. Am Knoten v mit In-Kanten e_1, …, e_k (nach Spalten aufsteigend; dies ist die Pending-Reihenfolge) und Out-Kanten o_1, …, o_q (links nach rechts, aus der Rotation der planaren Einbettung):

1. Die **Median-In-Kante** e_med, med = ⌈k/2⌉, wird auf den Port (∞, unten) gepinnt; es gilt x(v) = x(e_med).
2. Alle k+q Kanten erhalten **konsekutive Ports gegen den Uhrzeigersinn** in der Folge e_1, …, e_k, o_q, …, o_1.

Diese Regel ist exakt die „contiguous interval"-Invariante von KPP und reproduziert für Δ = 4 sämtliche Fälle der Biedl-Kant-Implementierung. Hohe Grade führen zu **umschlagenden Ports** („wrap-around"): Eine Out-Kante auf einem nach unten gerichteten Port erhält ein erstes Segment, das unter die Zeile eintaucht; eine In-Kante auf einem nach oben gerichteten Port ein Mittelsegment, das über die Zeile hinausschießt. Beides sind die kontinuierlichen Verallgemeinerungen der „Hook"-Konstruktionen (±0,5-Zeilen) der orthogonalen Implementierung — allerdings **ohne zusätzliche Knicke**, da das schräge Segment den Umweg übernimmt. Die Korrektheit der Interleavings (steilere Ports zu näheren Spalten derselben Seite, flachere Umschlag-Ports stets flacher als alle gleichseitigen In-Ports) folgt aus der Konsekutivregel; die geometrischen Einzelfälle wurden während der Entwurfsphase durchgerechnet und werden zusätzlich vom Verifier abgesichert.

Die Vertikal-Ports erzwingen zwei Randbedingungen: (∞, unten) ist für die Median-In-Kante reserviert, (∞, oben) darf nie von einer In-Kante belegt werden. Ein Abzählargument zeigt, dass beides genau dann garantiert ist, wenn deg(v_n) < Δ_eff und deg(v_1) < Δ_eff gilt — daher die Wahl der st-Kante über Knoten minimalen Grades und der „Bump" aus Abschnitt 5.3.

### 4.3 Spaltenallokation

Out-Kanten werden gemäß Portseite links bzw. rechts von x(v) platziert: nL Shifts am Pivot x(v) geben die Spalten x(v)−nL, …, x(v)−1 frei (links), nR Shifts am Pivot x(v)+1 die Spalten x(v)+1, …, x(v)+nR (rechts); eine Out-Kante auf (∞, oben) erbt x(v) — die Spalte der soeben konsumierten Median-In-Kante wird also wiederverwendet (Spaltenreuse wie bei Biedl-Kant). Es gilt stets x(o_1) < … < x(o_q), und pro Zeitpunkt trägt jede Spalte höchstens eine pending edge.

Die durch die Bikonnektivitäts-Augmentierung eingefügten Hilfskanten („Ghost-Kanten") werden — anders als in der orthogonalen Implementierung, die sie nachträglich injiziert — **vollständig gleichberechtigt** geroutet (Ports, Spalten, Steigungen) und erst vor der Ausgabe gelöscht. Die Zeichnung des augmentierten Graphen ist nach Theorem 4 planar; das Entfernen von Kanten erhält Planarität. Damit entfällt die fehleranfällige Ghost-Injektionslogik ersatzlos.

## 5 Abweichungen vom Paper und LEDA-Fallstricke

Dieser Abschnitt dokumentiert die während der Verifikationsschleife identifizierten Problemquellen („Culprits") und deren Lösungen. Beide inhaltlichen Abweichungen von der Papierkonstruktion wurden erst durch systematische Stresstests sichtbar.

### 5.1 LEDAs `ST_NUMBERING` liefert keine Lemma-9-Ordnung

**Symptom.** Mit der wörtlichen Umsetzung der Papierkonstruktion (Bodenkante (v_1,v_2), v_2 in Zeile 0) schlugen **129 von 273** Testinstanzen fehl; der Routingkern meldete Verletzungen der Pending-Invariante („Spaltenordnung der In-Kanten verletzt"), konzentriert auf größere Zufallsgraphen.

**Ursache.** Theorem 4 übernimmt von KPP die Voraussetzung aus Biedl-Kant-Lemma 9: eine st-Ordnung, bei der (v_1, v_2) eine **Kante der Außenfläche** der verwendeten Einbettung ist und v_n auf der Außenfläche liegt. LEDAs `ST_NUMBERING(G, stnum, stlist, e_st)` (Even-Tarjan, DFS-basiert) kennt die Einbettung nicht: v_2 ist ein beliebiger Nachbar von v_1. Liegt (v_1, v_2) im Inneren, ist die im Paper vorausgesetzte Konsistenz zwischen Pending-Reihenfolge (Außenflächenordnung) und Rotationssystem verletzt; für 3-fach zusammenhängende Graphen ist die Einbettung überdies eindeutig, sodass auch kein Re-Embedding helfen kann.

**Lösung.** Die Implementierung benötigt Lemma 9 nicht. Sie stützt sich stattdessen auf die klassische Theorie **planarer st-Graphen** (Rosenstiehl-Tarjan 1986; Tamassia-Tollis 1986 — dieselbe Grundlage wie Sichtbarkeitsrepräsentationen): Ist e_st = (v_1, v_n) eine **Kante** des Graphen und wählt man als Außenfläche eine der beiden an e_st angrenzenden Flächen, so gilt in jeder planaren Einbettung (i) die Bipolarität aller Rotationen (ein- und auslaufende Kanten bilden je ein zusammenhängendes Intervall) und (ii) die Konsistenz der Pending-Reihenfolgen über alle Präfixe G_i. Konkret:

- Die st-Kante wird so gewählt, dass ihr Ziel ein Knoten minimalen Grades ist (planar ⇒ deg ≤ 5, wie vom Paper für v_n gefordert) und ihre Quelle ein Nachbar minimalen Grades.
- **v_2 wird als vollständig generischer Knoten behandelt** (Zeile R, einzige In-Kante (v_1,v_2), Median-Pinning wie überall); die Sonderkonstruktion „Bodenkante unterhalb der Zeichnung" entfällt ersatzlos.
- Die Rotation von v_1 wird an e_st **verankert**: e_st wird linkeste Pending-Kante, die Außenfläche der Zeichnung ist die an e_st angrenzende Fläche.
- Die Orientierung der LEDA-Adjazenzlisten (Uhrzeigersinn) wird nicht blind vorausgesetzt: Schlägt der Routingversuch fehl, wird einmalig mit gespiegelter Interpretation wiederholt („Flip-Retry"); beide Invariantenprüfungen (Bipolarität, streng aufsteigende In-Spalten) bleiben als harte Fehlerpfade aktiv.

Diese Variante ist auf allen Spezifikationsmetriken gleich gut oder besser als die Papierkonstruktion (gleiches Knick- und Steigungsbudget; die Bodenkante mit ihren zwei Vertikalabfällen der Tiefe ⌊Δ/4⌋(2m−n)+1 entfällt sogar). Nach der Umstellung verblieb genau **ein** Fehlschlag (trivialer Grad-1-Senkenfall bei n = 2, gesondert behandelt); anschließend bestanden alle 273 Instanzen.

### 5.2 LEDAs `Make_Biconnected` verletzt die Gradschranke von Korollar 5

**Symptom.** Nachdem der Verifier von der selbstreferenziellen Schranke „benutzte Steigungen ≤ Δ_eff/2" auf die **strikte Papier-Schranke** „⌈Δ/2⌉ bzw. ⌈Δ/2⌉+1 bei Augmentierung" umgestellt worden war, schlugen pro Seed 5–8 Instanzen fehl — ausschließlich dünne, nicht-bikonnektierte Zufallsgraphen.

**Ursache.** Korollar 5 setzt eine Augmentierung im Stil von Kant-Bodlaender voraus, bei der **jeder Knoten höchstens zwei** Hilfskanten erhält (Δ_aug ≤ Δ+2). LEDAs `Make_Biconnected` gibt keine solche Garantie und konzentriert Hilfskanten massiv auf einzelne Knoten; gemessen wurden u. a. Δ = 4 → Δ_aug ≈ 8, Δ = 8 → Δ_aug ≈ 14, Δ = 12 → Δ_aug ≈ 16. Da die Steigungszahl an Δ_eff = Δ_aug (gerade gerundet) gekoppelt ist, wurde die Schranke ⌈Δ/2⌉+1 dadurch stillschweigend überschritten.

**Lösung.** Eigene, gradbeschränkte Augmentierung in `slopes_core.cpp`:

- `augment_connected_bounded`: Zusammenhangskomponenten werden zu einer **Kette** verbunden; pro Komponente werden Ein- und Ausstiegsknoten minimalen Grades gewählt (verschieden, sofern die Komponente ≥ 2 Knoten hat) — jeder Knoten erhält hierbei höchstens zwei Kettenkanten.
- `augment_biconnected_bounded`: Sind an einem Knoten c zwei **in der Rotation benachbarte** Kanten (c,u), (c,w) in verschiedenen Blöcken (LEDA `BICONNECTED_COMPONENTS`), so liegen u, c, w an einer gemeinsamen Fläche; die Bypass-Kante (u,w) ist somit **planar einfügbar** und verschmilzt beide Blöcke. (Da u, w in verschiedenen Blöcken liegen, kann (u,w) nicht bereits existieren — der Graph bleibt schlicht.) Pro Runde wird unter allen Blockgrenzen aller Knoten die Luecke mit minimalem max(deg(u), deg(w)) gewählt und genau eine Kante eingefügt; danach werden Einbettung und Blockstruktur neu berechnet. Die Schleife terminiert, da jede Runde mindestens zwei Blöcke verschmilzt.

Dieses Vorgehen entspricht konzeptionell der Kant-Bodlaender-Konstruktion (Bypass-Kanten zwischen Nachbarn des Schnittknotens statt Kanten am Schnittknoten selbst). Die gierige Minimalgrad-Auswahl hält den Maximalgradzuwachs praktisch bei ≤ 2; die Einhaltung der Steigungsschranke wird nicht angenommen, sondern vom Verifier für jede Instanz nachgeprüft (Abschnitt 6). Nach der Umstellung: null Fehlschläge.

### 5.3 Regularitäts- und Quellen-Bump

Zwei Randbedingungen erfordern freie Ports über den Knotengrad hinaus:

- **v_n** (Senke) benötigt deg(v_n) < Δ_eff, damit keine In-Kante den Port (∞, oben) belegen muss (dieser erzwänge Spalte x(e) = x(v), die der Median-Kante vorbehalten ist). In Δ_eff-regulären Graphen existiert kein solcher Knoten.
- **v_1** (Quelle) benötigt deg(v_1) < Δ_eff, damit ein Portslot für die Außenfläche frei bleibt und keine Out-Kante auf (∞, unten) fällt.

In beiden Fällen wird Δ_eff um 2 erhöht (eine Zusatzsteigung). Das deckt insbesondere den **Oktaeder** ab — die einzige im Paper/KPP ausgewiesene Ausnahme, die beweisbar 3 statt ⌈4/2⌉ = 2 Steigungen benötigt — ohne jede Sonderbehandlung im Code: Der 4-reguläre Oktaeder erhält Δ_eff = 6 und wird mit exakt 3 Steigungen gezeichnet. Für andere 4-reguläre planare Graphen liefert die Implementierung damit 3 Steigungen (die bestehende Biedl-Kant-Anwendung deckt den orthogonalen Fall ab; das Paper selbst delegiert Δ = 4 explizit an [BK98]). Reguläre planare Graphen mit Δ ≥ 5 sind unkritisch: 5-reguläre erhalten ohnehin Δ_eff = 6, 6-reguläre planare Graphen existieren nicht.

### 5.4 Weitere LEDA-Fallstricke

- **`edge_array` wächst nicht dynamisch:** Zugriffe auf Kanten, die nach der Initialisierung des Arrays erzeugt wurden (Augmentierungskanten, Reversals), führen zum Laufzeitfehler „illegal edge". Alle Ergebnis-Arrays werden daher vor der Augmentierung an G gebunden und ausschließlich für überlebende Originalkanten beschrieben; Hilfsstrukturen werden nach der Augmentierung angelegt.
- **Reversal-Semantik:** Erst `PLANAR(G, true)` etabliert die planare Map samt Reversal-Zeigern; eigene Hilfskanten müssen paarweise mit `set_reversal` registriert werden, bevor erneut eingebettet wird.
- **Deterministischer Zufallsgenerator:** LEDAs Generatoren (`random_planar_graph` etc.) sind pro Prozessstart deterministisch; ohne explizites `rand_int.set_seed` testen wiederholte Läufe identische Instanzen. Der Stresstest setzt Seeds daher explizit (`-s`).
- **Grad-1-Senke (n = 2):** Die Linearisierung der Senkenrotation über die eindeutige Spalten-Aufstiegsstelle ist für deg = 1 nicht definiert und wird gesondert behandelt.

## 6 Verifikation

Die Verifikation folgt dem Prinzip, keine Eigenschaft der eigenen Konstruktion zu **vertrauen**, sondern jede Spezifikation des Papers auf der fertigen Zeichnung unabhängig **nachzumessen**.

### 6.1 Geometrischer Verifier

`verify_slopes_drawing` prüft auf den logischen Ganzzahlkoordinaten (Orientierungstests in 128-Bit-Ganzzahlarithmetik, keine Gleitkommatoleranzen):

1. **Planarität:** paarweise Schnitttests aller Segmente (O(S²), S ≤ 3(m+1)); erlaubt sind ausschließlich Berührungen in gemeinsamen Endknoten beider Kanten bzw. am gemeinsamen Knick aufeinanderfolgender Segmente derselben Kante; kollineare Überlappungen sind stets Fehler. Zusätzlich: kein Knoten im Inneren eines fremden Segments, keine zwei Knoten auf demselben Gitterpunkt.
2. **Knickzahl:** höchstens zwei Knicke pro Kante (nach Entfernung degenerierter Punkte).
3. **Steigungen:** jedes Segment vertikal oder mit ganzzahliger Steigung in [−⌊Δ_eff/4⌋+1, ⌈Δ_eff/4⌉−1]; die Anzahl **verschiedener** benutzter Steigungen wird gegen die **strikte Papier-Schranke** ⌈Δ/2⌉ (bikonnektierte Eingabe) bzw. ⌈Δ/2⌉+1 (Augmentierung oder Bump) geprüft — bewusst gegen das ursprüngliche Δ der Eingabe, nicht gegen interne Größen, um Selbstreferenzialität auszuschließen (vgl. 5.2).
4. **Gitter und Fläche:** Ganzzahligkeit aller Koordinaten; Breite ≤ 2m−n; Höhe ≤ (n−1)·R + 2L (Papier-Formeln des augmentierten Graphen).
5. **Modelltreue:** jede Kante enthält ein vertikales Segment.

### 6.2 Testkorpus

Der Headless-Treiber `slopes_test` erzeugt pro Lauf 279 Instanzen:

- **Spezialfälle:** K₄, Oktaeder, Pfade (n = 2, 3, 10), Sterne (k = 3…14; erzwingen starke Augmentierung), Räder und Doppelräder (k = 4…16; hohe Nabengrade), Gittergraphen;
- **Zufallsfamilien** (LEDA-Generatoren): `maximal_planar_graph`, `triangulated_planar_graph`, `random_planar_graph` mit Dichten m ∈ {n, 1,5n, 2n, 3n−6} für n ∈ {4, …, 48}, je fünf Wiederholungen; optional große Instanzen bis n = 256;
- die drei im Repository vorhandenen `.gw`-Beispielgraphen.

Eingaben werden zuvor bereinigt (Schleifen, Mehrfach- und antiparallele Kanten); getestete Maximalgrade lagen bei bis zu Δ = 25 (⇒ 13 Steigungen).

### 6.3 Validierung des Verifiers (Mutationstest)

Ein Verifier, der nie fehlschlägt, ist wertlos, wenn er Fehler nicht erkennen kann. Zur Absicherung wurde eine gezielte Mutation in den Routingkern injiziert (Vorzeichenumkehr der In-Kanten-Steigungen): Der Verifier erkannte die dadurch entstehenden Kreuzungen und Steigungsverletzungen in **227 von 273** Instanzen (die übrigen sind zu klein, um durch die Mutation geometrisch zu entarten). Die Mutation wurde anschließend rückgängig gemacht und die Testsuite erneut vollständig bestanden.

### 6.4 Ergebnisse

- **30 Seeds × 279 Instanzen = 8 370 Testfälle: 0 Fehlschläge** (einschließlich der strikten Steigungs- und Flächenschranken).
- **Oktaeder:** 3 Steigungen auf 9 × 281 — exakt die beweisbare Ausnahme-Schranke.
- **`biconnected.gw`** (Δ = 4, bikonnektiert): **2 Steigungen** — die Zeichnung degeneriert wie theoretisch vorhergesagt zum orthogonalen Biedl-Kant-Fall und dient damit als Kreuzvalidierung gegen die bestehende Implementierung.
- **`graph.gw`** (Δ = 5, augmentiert): 3 Steigungen = ⌈5/2⌉; **`not_biconnected.gw`** (Δ = 4, augmentiert): 3 Steigungen = ⌈4/2⌉+1.
- Beispiel einer großen Instanz: maximal-planar, n = 48, Δ = 25 → 13 Steigungen = ⌈25/2⌉, Gitter 137 × 140 040 (Breite ≤ 2m−n = 228 ✓).

Die interaktive Anwendung führt denselben Verifier nach jedem Layout aus und meldet Ergebnis und Statistik im Meldungsfenster; die Konsole enthält den vollständigen Bericht.

## 7 Bau und Bedienung

```bash
cd build && cmake .. && make          # Targets: biedl_kant, biedl_kant_slopes, slopes_test
./biedl_kant_slopes                   # interaktiv (X-Server erforderlich)
./slopes_test                         # Standardsuite (Exitcode 0 = alles bestanden)
./slopes_test -v -s 42 -n 256        # ausführlich, Seed 42, große Instanzen bis n=256
./slopes_test graph.gw               # einzelne .gw-Datei prüfen
```

Fehlschlagende Instanzen werden als `slopes_fail_NNN.gw` gespeichert und sind damit reproduzierbar.

## 8 Grenzen und offene Punkte

- **Visuelle Abnahme:** Die Korrektheit ist geometrisch verifiziert; eine visuelle Prüfung der GraphWin-Darstellung auf einem stabilen X-Server steht noch aus (XQuartz zeigte sich instabil). Zu erwarten ist ein extremes Seitenverhältnis, da die Höhe O(Δn²) beträgt — das ist eine Eigenschaft des Algorithmus, keine der Implementierung.
- **Kompaktheit:** Der Zeilenabstand R ist die worst-case-Schranke des Papers; eine adaptive Verdichtung (z. B. zeilenweises R aus der tatsächlichen Breite) wäre eine naheliegende, spezifikationserhaltende Optimierung.
- **Gradschranke der Augmentierung:** Die gierige Bypass-Auswahl garantiert die Kant-Bodlaender-Schranke Δ_aug ≤ Δ+2 nicht formal in allen Fällen; sie wird jedoch für jede Instanz durch die strikte Steigungsprüfung des Verifiers erzwungen und wurde in ~8 400 Fällen nie verletzt. Eine formal beweisende Umsetzung von [KB92] wäre eine mögliche Erweiterung.
- **4-reguläre Nicht-Oktaeder-Graphen** erhalten 3 statt 2 Steigungen (Abschnitt 5.3); der orthogonale Fall wird von der bestehenden `biedl_kant`-Anwendung abgedeckt, das Paper delegiert diesen Fall ebenfalls.

## Literatur

- **[BKKP26]** M. A. Bekos, E. Katsanou, P. Kindermann, M. E. Pavlidi: *How Many Slopes Does Polynomial Area Cost?* arXiv:2605.31098, 2026.
- **[BK98]** T. Biedl, G. Kant: *A better heuristic for orthogonal graph drawings.* Comput. Geom. 9(3):159–180, 1998.
- **[KPP13]** B. Keszegh, J. Pach, D. Pálvölgyi: *Drawing planar graphs of bounded degree with few slopes.* SIAM J. Discrete Math. 27(2):1171–1183, 2013 (arXiv:1009.1315).
- **[KB92]** G. Kant, H. L. Bodlaender: *Triangulating planar graphs while minimizing the maximum degree.* SWAT 1992, LNCS 621, S. 258–271.
- **[RT86]** P. Rosenstiehl, R. E. Tarjan: *Rectilinear planar layouts and bipolar orientations of planar graphs.* Discrete Comput. Geom. 1:343–353, 1986.
- **[TT86]** R. Tamassia, I. G. Tollis: *A unified approach to visibility representations of planar graphs.* Discrete Comput. Geom. 1:321–341, 1986.
