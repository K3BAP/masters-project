# Implementierungsbericht: Planare Gitterzeichnungen mit wenigen Steigungen

**Implementierung zweier Algorithmen aus Bekos, Katsanou, Kindermann, Pavlidi: „How Many Slopes Does Polynomial Area Cost?" (arXiv:2605.31098):**

- **Teil I** — *Theorem 4 + Korollar 5*: 2-Bend-planare Zeichnungen mit ⌈Δ/2⌉ Steigungen (LEDA/GraphWin).
- **Teil II** — *Theorem 1 + Korollar 2*: 1-Bend-planare Zeichnungen mit 3Δ−8 Steigungen (LEDA/GraphWin-Referenz **und** eigenständiger TypeScript-Port in der Webanwendung), einschließlich des frei wählbaren Steigungsparameters k.

Stand: 12. Juli 2026 (Teil II ergänzt; Umstrukturierung in zwei Teile)

---

## Zusammenfassung

Dieser Bericht dokumentiert die Implementierung **beider** Hauptalgorithmen des oben genannten Papers und ist entsprechend in zwei Teile gegliedert.

**Teil I (Theorem 4 + Korollar 5, Abschnitte 1–8).** Jeder bikonnektierte planare Graph mit Maximalgrad Δ ≥ 3 erhält eine planare Gitterzeichnung mit höchstens **zwei Knicken pro Kante** und höchstens **⌈Δ/2⌉ Steigungen** auf einem Gitter der Größe **O(n) × O(Δn²)**; nicht-bikonnektierte planare Graphen benötigen nach Augmentierung höchstens eine zusätzliche Steigung (Korollar 5). Der Algorithmus ist die direkte Verallgemeinerung des Biedl-Kant-Algorithmus (Δ ≤ 4, zwei Steigungen), dessen Implementierung in diesem Repository (`biedl_kant.cpp`) als strukturelle Vorlage diente. Die Umsetzung wurde gegen die Spezifikationen mit einem exakt rechnenden geometrischen Verifier und einem randomisierten Stresstest über **ca. 8 400 Testinstanzen** validiert (null Fehlschläge); die Aussagekraft des Verifiers selbst wurde durch einen Mutationstest belegt. Zwei wohlbegründete Abweichungen von der Papierkonstruktion waren notwendig, weil LEDA-Primitive (`ST_NUMBERING`, `Make_Biconnected`) die vorausgesetzten Eigenschaften nicht liefern; beide sind theoretisch fundiert und ändern keine der bewiesenen Schranken (Abschnitt 5).

**Teil II (Theorem 1 + Korollar 2, Abschnitte 9–14).** Jeder **3-fach zusammenhängende** planare Graph mit Δ ≥ 5 erhält eine planare Gitterzeichnung mit höchstens **einem Knick pro Kante** und höchstens **3Δ−8 Steigungen**; beliebige planare Graphen folgen über eine gradbeschränkte Augmentierung zu 3-Zusammenhang (Korollar 2, ⌈9Δ/2⌉+1 Steigungen). Anders als Theorem 4 lässt sich hier die Geometrie **nicht** aufschieben: Der Algorithmus arbeitet mit expliziter kanonischer Ordnung, einer Schnyder-artigen 4-Kantenfärbung und einer **Cut-basierten horizontalen Streckung**. Teil II besteht aus einer LEDA/GraphWin-Referenzimplementierung (`onebend_core.cpp`, `canonical_order.cpp`, `planar_aug.cpp`) **und** einem eigenständigen, ebenfalls verifizierten **TypeScript-Port** in der begleitenden Webanwendung. Beide wurden über einen exakten 1-Bend-Verifier stressgetestet (C++ `onebend_test`: **297 Instanzen**, TypeScript-Suite: **189 Tests**, je null Fehlschläge). Zwei bewusste Erweiterungen gegenüber der Papierkonstruktion sind in der Webapp verfügbar: Der zentrale Geometrieparameter **k** ist frei wählbar (Abschnitt 12; die Papier-Wahl k = 4Δn² wird nur für den Flächenbeweis benötigt, nicht für die Korrektheit), und die **Wurzelknoten v₁, v₂, v_n** der kanonischen Ordnung sind vorgebbar (Abschnitt 13, etwa zum Vergleich mit den Abbildungen des Papers).

---

# Teil I — Theorem 4 + Korollar 5: 2 Knicke, ⌈Δ/2⌉ Steigungen

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

# Teil II — Theorem 1 + Korollar 2: 1 Knick, 3Δ−8 Steigungen

Neben Theorem 4 implementiert dieses Projekt den zweiten Hauptalgorithmus des Papers (Abschnitt 3.1): **Theorem 1** zeichnet jeden 3-fach zusammenhängenden planaren Graphen mit Δ ≥ 5 mit höchstens **einem Knick pro Kante** und höchstens **3Δ−8 Steigungen** auf einem 12Δn² × 18Δn³-Gitter; **Korollar 2** überträgt das Ergebnis über eine gradbeschränkte Augmentierung zu 3-Zusammenhang (Kant-Bodlaender-Stil, Δ' ≤ ⌈3Δ/2⌉+3) auf beliebige planare Graphen mit ⌈9Δ/2⌉+1 Steigungen. Teil II umfasst eine LEDA/GraphWin-Referenzimplementierung und einen eigenständigen TypeScript-Port in der Webanwendung; wo sich beide unterscheiden, ist es vermerkt.

## 9 Zeichnungsmodell und Grundlagen (Theorem 1)

### 9.1 Kanten-, Steigungs- und Gittermodell

Jede Kante erhält höchstens **einen** Knick und besteht damit aus höchstens zwei Segmenten. Die zulässige Steigungsmenge ist rational und durch einen ganzzahligen Parameter **k** und die Größe D₃ = Δ_eff−3 gesteuert (Δ_eff = max(Δ', 5)):

> S = { ∞ (vertikal) } ∪ { 0 (horizontal) } ∪ { ±k/j : j = 1…D₃ } (steil) ∪ { j/D₃ : j = 1…D₃−1 } (flach),   |S| = 3Δ_eff−8.

Die steilen Steigungen haben Betrag > 1, die flachen Betrag < 1; diese Trennung entlang des Betrags 1 nutzt der Verifier zur Klassifikation. Der Parameter **k** ist der vertikale Zeilenabstand: Invariante I.4 verlangt, dass alle Knoten-y-Koordinaten Vielfache von k sind. Das Paper wählt k = 4·Δ_eff·n² (nur für den Flächenbeweis); die Webapp erlaubt zusätzlich ein frei gewähltes k (Abschnitt 12).

### 9.2 Kanonische Ordnung statt st-Nummerierung

Theorem 1 konstruiert entlang einer **kanonischen Ordnung** Π = (P₀, …, P_m) des 3-zusammenhängenden ebenen Graphen: P₀ = {v₁, v₂}, P_m = {v_n}, mit (v₁, v₂) und (v₁, v_n) als Außenkanten; jedes P_i ist ein einzelner Knoten (*Singleton*) oder eine *Kette* konsekutiver Konturknoten. Die Konturkanten tragen eine **Schnyder-artige 4-Kantenfärbung** (schwarz/blau/grün/rot), aus der die Kantenformen (Invariante I.5) folgen.

### 9.3 Wesentlicher Unterschied zu Theorem 4

Bei Theorem 4 ließ sich die Geometrie vollständig aufschieben (Abschnitt 4.1). Das ist hier **nicht** möglich: Die Platzierung eines neuen Knotens liest die aktuelle Höhe H(Γ) und die Knickpositionen der Kontur. Stattdessen wird explizite Geometrie geführt und die vom Paper geforderte Streckbarkeit über eine **Cut-basierte horizontale Streckung** operationalisiert (Abschnitt 11.4), die ausschließlich horizontale Segmente streckt und damit alle Steigungen exakt erhält.

## 10 Architektur (Theorem 1)

| Datei | Inhalt |
|---|---|
| `planar_aug.{h,cpp}` | Flächen-Traversierung auf LEDA-Maps; gradbeschränkte Bikonnektivitäts- **und** Trikonnektivitäts-Augmentierung über Flächen-Chorden (Korollar 2). Wird auch vom refaktorierten Theorem-4-Kern mitbenutzt (ersetzt dessen frühere Bypass-Variante) |
| `canonical_order.{h,cpp}` | kanonische Ordnung per Reverse Peeling + unabhängiger Ordnungs-Checker |
| `onebend_core.{h,cpp}` | Pipeline (Gates → Augmentierung → Einbettung/Außenfläche → kanonische Ordnung → Färbung → Zeichnen → Wiedereinsetzungen) und geometrischer 1-Bend-Verifier |
| `onebend_test.cpp` | Headless-Stresstest (297 Instanzen, Mutationsschalter `-m`) |
| `onebend_slopes.cpp` | interaktive GraphWin-Anwendung (analog `biedl_kant_slopes`) |

Der **TypeScript-Port** liegt in `webapp/src/algorithm/onebend/` und spiegelt diese Struktur: `canonicalOrder.ts`, `augmentTriconnected.ts`, `drawing.ts`, `verifier.ts`, `types.ts`, `pipeline.ts`. Er verwendet aus dem Theorem-4-Modul die vorhandenen Bausteine `validateInput`, `buildEmbedding`, die Demoucron-Planarisierung `planarEmbedding` (Pendant zu LEDA `PLANAR(G, true)`), `augmentBiconnected` sowie die Flächen-Traversierung `traverseFaces` wieder. Da LEDA proprietär ist, ist der Port kein Wrapper, sondern eine eigenständige Implementierung mit **eigenem, exakt rechnendem Verifier** (BigInt statt `__int128`).

## 11 Algorithmische Umsetzung

### 11.1 Kanonische Ordnung per Reverse Peeling

Die Ordnung wird durch **rückwärtiges Abschälen** vom aktuellen Außenzyklus C gewonnen (`computeCanonicalOrder` / `compute_canonical_order`). Wiederholt wird entweder ein **Singleton** z ∈ C∖{v₁, v₂} ohne Sehne, dessen Entfernung Bikonnektivität erhält, oder eine **Kette** aus konsekutiven C-Knoten mit Grad genau 2 entfernt; Stopp, sobald der Rest der Zyklus durch (v₁, v₂) ist (⇒ P₁). Der Schälschritt validiert die Bedingungen (i)–(iv) direkt:

- **(i)** G_i bikonnektiert und **intern 3-zusammenhängend** — Letzteres über einen **Apex-Trick** (temporärer, mit allen Konturknoten verbundener Zusatzknoten; ist der so erweiterte Graph 3-zusammenhängend, ist G_i intern 3-zusammenhängend);
- **(ii)** alle Nachbarn von P_i liegen auf C_{i−1};
- **(iii)** P_i ist Singleton oder Grad-2-Kette;
- **(iv)** jeder Knoten von P_i hat einen späteren Nachbarn.

Nach Kants Existenzlemma [Kant96] bleibt der Greedy dadurch nie stecken. Ein **unabhängiger Ordnungs-Checker** (`checkCanonicalOrder` / C++-Pendant) prüft eine fertige Ordnung nachträglich gegen (i)–(iv) und dient in den Tests als Referee — dieselbe „nachmessen statt vertrauen"-Methodik wie in Teil I.

### 11.2 Schnyder-artige 4-Kantenfärbung

Jede Kante erhält eine von vier Farben, aus denen die zulässige Form folgt (I.5): **schwarz** = ein horizontales Segment; **blau** = (vertikal oder rechts-steil) + horizontal; **grün** = (vertikal oder links-steil) + horizontal; **rot** = einzeln vertikal oder vertikal + flach. Die Basiskante (v₁, v₂) trägt die Sonderform *vertikal an v₁ + flach 1/D₃ an v₂*. Die Färbung ergibt sich pro Schritt aus der ersten/letzten neuen Konturkante (blau/grün), den Ketten-Innenkanten (schwarz) und den übrigen Singleton-Kanten (rot).

### 11.3 Inkrementelle Zeichnung: Fälle 1 und 2

`drawOneBend` (Klasse `Draw`, Port des `Draw`-Kerns aus `onebend_core.cpp`) platziert v₁, P₁, v₂ auf einer Basiszeile (Kante (v₁, v₂) vorher entfernt) und fügt dann Π schrittweise hinzu:

- **Fall 1 (`case1`) — Kette oder Grad-2-Singleton:** An den Kontur-Nachbarn v_ℓ, v_r werden freie Ports vergeben (rechts-steil bzw. links-steil, gegen den Uhrzeigersinn); die neue Zeile liegt bei y = H(Γ)+k, das Ketteninnere horizontal. Die Konturkanten (v_ℓ, v_ℓ′), (v_r, v_r′) werden gestreckt, bis die Knicke frei auf Gitterpunkten liegen.
- **Fall 2 (`case2`) — Singleton mit Grad > 2:** Der Knoten v_g bekommt eine vertikale rote Kante zu w_q; die Kanten (w_j, v_g) für j < q erhalten ein vertikales plus ein flaches Segment j/D₃, wobei (w_j, w_j′) so gestreckt wird, dass der Horizontalabstand ≡ 0 (mod D₃) ist; y(v_g) ist das kleinste Vielfache von k oberhalb aller Knick-Schranken. Die Randkanten (v_ℓ, v_g), (v_g, v_r) verhalten sich wie in Fall 1.

Weil Zeilen Vielfache von k sind, liegen die Knicke steiler Segmente (dx = dy·j/k) auf Gitterpunkten; flache Distanzen sind Vielfache von D₃. Ein **Koordinaten-Guard** (`coordGuard`, Schwelle 2⁴⁸) sichert nach jedem Schritt die Ganzzahl-Exaktheit ab (Abschnitt 12.4). Für die Schrittansicht der Webapp erzeugt `snapshot` vollständige Zwischenstände, da die Streckungen auch bereits platzierte Teile verschieben.

### 11.4 Cut-Streckung

Die Paper-Operation „Cut" (eine y-monotone Kurve, die nur horizontale Segmente kreuzt) ist als Abschlussregel implementiert (`stretch`): **R = Abschluss des rechten Endpunkts des horizontalen Segments der Konturkante e unter (a) nicht-horizontalen Segmenten (beide Richtungen, starr) und (b) horizontalen Segmenten in Richtung ihres rechten Endpunkts.** Alle Punkte (Knoten und Knicke) in R wandern um +d; ausschließlich horizontale Segmente ändern dabei ihre Länge, sodass **alle Steigungen exakt erhalten** bleiben. Auf kleinen Instanzen läuft der Verifier nach jeder Streckung (Debug-Pfad), was die Abschlussregel während der Entwicklung abgesichert hat.

### 11.5 Sonderfall deg(v_n) = Δ_eff

Hat die Senke v_n vollen Grad, kann die rechteste Kante (w_Δ, v_n) nicht regulär geführt werden. Die Konstruktion schiebt sie auf (`prepareReinserts`, `reinsertSpecial`): Vor dem Zeichnen der Sonderkante laufen alle mod-D₃-Ausrichtungsstreckungen; die Kante (w_{Δ−1}, v_n) wird grün umgefärbt, und (w_Δ, v_n) wird am Ende mit vertikalem Segment an w_Δ und flachem an v_n eingesetzt. Analog setzt `reinsertBase` die Basiskante (v₁, v₂) am Schluss unterhalb wieder ein. Dieser Fall tritt u. a. beim **Ikosaeder** (5-regulär, Δ_eff = 5) auf und ist ein eigener Testfall.

### 11.6 Korollar 2: gradbeschränkte Trikonnektivierung

Die Augmentierungskette ist zusammenhängend → bikonnektiert → **3-zusammenhängend**. Den letzten Schritt leisten `augment_triconnected_bounded` (C++, LEDA `Is_Triconnected` liefert die Separationspaare) bzw. `augmentTriconnected` (TS). Der TS-Port ermittelt Separationspaare per **Brute Force** (`separationPair`: für jeden Knoten x wird ein Artikulationspunkt von G−x gesucht — n ist klein). Zu jedem Separationspaar {a, b} wird eine Chorde zwischen zwei Knoten **verschiedener Komponenten** von G−{a, b} auf einer gemeinsamen Fläche eingefügt; a und b selbst sind **nie** Endpunkte (ihr Grad wächst nicht). Die Auswahl ist gierig (minimales max(deg), dann minimale Gradsumme); die Einbettung wird über die Face-Corners fortgeschrieben, Hilfskanten erhalten `aug = true`. Die Einhaltung der Steigungsschranke wird nicht angenommen, sondern für jede Instanz vom Verifier nachgeprüft (Abschnitt 14).

## 12 Frei wählbarer Steigungsparameter k

Der Parameter k aus Abschnitt 9.1 ist in der Webapp frei wählbar. Diese Funktion ist eine **bewusste, nicht-triviale Abweichung von der Papierkonstruktion** und wird hier gesondert dokumentiert.

### 12.1 Rolle von k und Motivation

In Theorem 1 parametrisiert k die Steigungsmenge S: die steilen Steigungen sind **±k/j** (j = 1, …, Δ_eff−3), und Invariante I.4 verlangt, dass alle Knoten-y-Koordinaten Vielfache von k sind — jede neue Konturzeile liegt also mindestens k über der vorhergehenden. Das Paper setzt

> k = 4·Δ_eff·n²

fest. Dieser Wert wird jedoch **ausschließlich für den Flächenbeweis** benötigt: Die Breiten-Rekursion (Gleichungen (1), (3), (5) des Papers) konvergiert genau dann zur Schranke O(Δn²), wenn k hinreichend groß ist. Für die **Korrektheit** der Konstruktion — Planarität, höchstens ein Knick, Steigungen aus S, sämtliche Invarianten I.1–I.5 — ist die konkrete Größe von k dagegen nahezu bedeutungslos.

Praktisch ist die Papier-Wahl astronomisch groß: Für den Ikosaeder (Δ_eff = 5, n = 12) ergibt sich k = 2880 und eine Zeichnung auf 44 × 25 945. Die steilen Segmente ±k/j erscheinen dann faktisch senkrecht; erst die anisotrope y-Stauchung der Ergebnisansicht macht sie erkennbar. Ein kleines k (etwa 10) liefert dieselbe, ebenso korrekte Konstruktion auf einem drastisch flacheren Gitter, in dem die Steigungen k/1, k/2, … als echte Schrägen sichtbar werden. Die Funktion dient damit zwei Zwecken: der **maßstabsgetreuen Darstellbarkeit** kleiner Instanzen und der **empirischen Untersuchung** der Frage, wie klein k werden darf, bevor die Fläche unhandlich wächst — also der experimentellen Beleuchtung der Papier-Wahl 4Δn².

### 12.2 Gültigkeitsbereich

k muss eine **ganze Zahl mit k ≥ Δ_eff−2** sein. Bei k ≤ Δ_eff−3 kollidierten die steilen Steigungen k/j (deren Betrag > 1 sein muss) mit den flachen Steigungen j/(Δ_eff−3) (Betrag < 1); S besäße dann weniger als 3Δ−8 verschiedene Elemente, und die Unterscheidung steil/flach des Verifiers (Betrag ≷ 1) klassifizierte falsch. Da Δ_eff erst **nach** der Trikonnektivitäts-Augmentierung (Korollar 2) feststeht, erfolgt die Prüfung in der Pipeline, nicht in der Oberfläche. Nach oben wird k auf 10⁹ begrenzt, damit alle ganzzahligen Rechnungen im exakt darstellbaren Bereich bleiben (Abschnitt 12.4).

### 12.3 Abweichung von den Papierschranken und Ersatzinvariante

Der einzige Teil des Verifiers, der wirklich an der Standardwahl von k hängt, ist die **Flächenprüfung**. Bei manuellem k gilt die absolute Breitenschranke 12Δn² nicht mehr — für kleines k wächst die Breite bewusst darüber hinaus. Die Prüfung wird daher umgestellt auf die **k-parametrisierte Höheninvariante**, die für *jedes* gültige k gilt: Aus den Gleichungen (2)/(4) des Papers hebt jeder Schritt die Höhe um höchstens W + k, und es gibt höchstens n Schritte, also

> H ≤ n·(W + k).

Der Verifier prüft bei manuellem k diese Invariante anstelle der absoluten Schranken; die Breite bleibt ohne feste Obergrenze (der Koordinaten-Guard aus 12.4 fängt unkontrolliertes Wachstum ab). Der Verifikationsbericht kennzeichnet die Abweichung explizit („k manuell; Papier-Flächenschranke entfällt"), sodass sie nicht stillschweigend geschieht.

### 12.4 Exaktheit und Koordinaten-Guard

Zwei Vorkehrungen sichern die Ganzzahl-Exaktheit, auf der die gesamte Verifikationsmethodik beruht (Abschnitte 6 und 14):

- **BigInt-Arithmetik der Steigungsklassifikation.** Bei kleinem manuellem k können Koordinaten und insbesondere die Produkte k·|dx| des Zugehörigkeitstests „Steigung ∈ S" den exakt darstellbaren Bereich von JavaScript-`Number` (2⁵³) verlassen. Die Klassifikation wurde daher auf BigInt umgestellt; die Zuordnung eines Segments zu einer Steigung aus S bleibt damit für beliebige Koordinatengrößen exakt.
- **Koordinaten-Guard.** Bei sehr kleinem k wächst die Breite pro Konstruktionsschritt etwa um den Faktor (1 + 2Δ/k). Ein Guard nach jedem Schritt (Schwelle 2⁴⁸) bricht sauber mit klarer Fehlermeldung ab, **bevor** ein Zwischenwert die exakte Ganzzahldarstellung verlassen könnte — ein einzelner Schritt aus einem noch gültigen Zustand bleibt nachweislich exakt. Ein andernfalls möglicher stiller Verlust der Exaktheit wird so in einen definierten, für die Nutzerin sichtbaren Fehlschlag überführt.

### 12.5 Verifikation und empirische Befunde

Die vitest-Suite des TypeScript-Ports wurde um k-Läufe erweitert: k-Durchläufe über feste Familien (Ikosaeder, Prismen, Antiprismen, Räder, Gitter) und Zufallsgraphen, die jeweils den exakten 1-Knick-Verifier bestehen müssen; Grenzwert-, Ganzzahl- und Obergrenzenprüfung; die Eigenschaft „kleines k ⇒ geringere Höhe"; sowie eine Guard-Eigenschaft (das Ergebnis ist entweder verifiziert oder ein klarer Fehler, niemals eine unverifizierte Zeichnung oder ein Absturz). Sämtliche Tests bestehen; die Produktionsbau-Prüfung bleibt fehlerfrei (Gesamtzahlen in Abschnitt 14.3).

Drei empirische Befunde sind bemerkenswert:

- Die Konstruktion verifiziert selbst am **theoretischen Minimum** k = Δ_eff−2 (= 3 beim Ikosaeder).
- Die **Höhe skaliert im Wesentlichen linear in k** bei nahezu konstanter Breite (Ikosaeder-Durchlauf: k = 10 → Höhe 115, k = 50 → 1 129, k = 500 → 10 579, k = 50 000 → 1 050 079). Das bestätigt, dass k — wie beabsichtigt — Höhe gegen Lesbarkeit eintauscht.
- Das **Breitenwachstum bleibt auch bei nahezu minimalem k weit unter dem Worst Case** (n = 96, k = 14: Breite ≈ 60 000, keine Explosion). Die Papier-Wahl 4Δn² ist somit für das *Beweisen* der Flächenschranke nötig, praktisch aber sehr konservativ.

Ein Durchlauf im Browser bestätigt den Nutzen unmittelbar: Der Ikosaeder mit k = 10 besteht die Verifikation auf einem **44 × 115**-Gitter statt 44 × 25 945 und ist damit erstmals maßstabsgetreu (ohne y-Stauchung) lesbar; die Eingabe k = 2 liefert die parametrisierte Bereichsmeldung, in allen drei Oberflächensprachen (Deutsch, Englisch, Griechisch) übersetzt.

## 13 Erweiterung: wählbare Wurzelknoten der kanonischen Ordnung

Eine zweite, kleinere Erweiterung der Webapp betrifft die **Wurzeln der kanonischen Ordnung**. Der Algorithmus aus Abschnitt 11.1 wählt sie automatisch: Er probiert alle Knoten minimalen Grades als v_n, deren inzidente Flächen und beide Umlaufrichtungen durch und übernimmt die **erste** vom Peeler und Checker akzeptierte Ordnung. Diese Wahl ist korrekt, aber willkürlich — derselbe Graph kann von vielen verschiedenen Startkonfigurationen aus gezeichnet werden. Beim Nachvollziehen der Abbildungen des Papers stört das: Die Implementierung startete etwa mit P₀ = {8, 0}, wo die Papier-Abbildung P₀ = {0, 1} verwendet. Die Webapp erlaubt daher, **v₁, v₂ und v_n einzeln vorzugeben** (leere Felder werden weiterhin automatisch gewählt).

### 13.1 Semantik und Umsetzung

Die Vorgaben ersetzen nicht die Konstruktion, sondern **filtern die bestehende Suche**: Ein erzwungenes v_n ersetzt den Minimalgrad-Filter der Kandidatenschleife; erzwungene v₁/v₂ schränken die Flächen- und Richtungskandidaten ein. Peeler und Checker bleiben unverändert — jede erzwungene Ordnung durchläuft dieselbe Validierung der Bedingungen (i)–(iv) wie eine automatische. Die Rollen sind asymmetrisch und werden nicht stillschweigend vertauscht: (v₁, v₂) und (v₁, v_n) müssen Kanten auf einer gemeinsamen Fläche sein (diese wird Außenfläche); v₁ liegt links und ist zu v_n adjazent. Wirkt eine Zeichnung gegenüber einer Vorlage gespiegelt, sind v₁ und v₂ zu tauschen.

Bemerkenswert ist der Wegfall der Minimalgrad-Heuristik bei erzwungenem v_n: Zulässig ist jeder Knoten, für den eine Ordnung existiert — einschließlich Knoten **vollen Grades**, da der Zeichenkern den Sonderfall deg(v_n) = Δ_eff behandelt (Abschnitt 11.5). Ein dedizierter Test erzwingt die Nabe des Rades W₈ (Grad 8 = Δ_eff) als v_n und prüft, dass der Sonderfallpfad greift und die Zeichnung verifiziert.

### 13.2 Gültigkeit und Fehlerbehandlung

Wie beim Parameter k erfolgt die Validierung **nach der Augmentierung** — die Knotenindizes bleiben stabil, weil die Augmentierung nur Kanten hinzufügt, und die Vorgaben dürfen sich auch auf Hilfskanten stützen. Zwei parametrisierte Fehlerklassen werden gemeldet und in allen drei Oberflächensprachen übersetzt: formale Fehler (nicht ganzzahlig, außerhalb von 0…n−1, nicht paarweise verschieden) sowie die inhaltliche Ablehnung „keine kanonische Ordnung mit den vorgegebenen Wurzelknoten" (etwa wenn (v₁, v₂) keine Kante ist oder (v₁, v₂) und (v₁, v_n) auf keiner gemeinsamen Fläche liegen); Nicht-Kanten werden dabei vor der Suche erkannt und mit der konkreten Ursache benannt.

### 13.3 Verifikation

Die vitest-Suite wurde um neun Tests erweitert: volle und teilweise Vorgaben auf festen Familien (Ikosaeder, Rad-Nabe als v_n, Dreieck n = 3), Ablehnung von Nicht-Kanten sowie Bereichs-/Verschiedenheitsfehlern, Vorgaben auf dem Korollar-2-Pfad, die Eigenschaft, dass die Wurzeln einer automatisch gefundenen Ordnung — erneut erzwungen — dasselbe verifizierte Ergebnis liefern (feste Familien und Zufallsgraphen), und ein erschöpfender Durchlauf aller v_n-Wahlen auf dem Prisma (jedes Ergebnis ist verifiziert oder ein klarer Vorgabefehler, niemals eine unverifizierte Zeichnung). Ein Browser-Durchlauf bestätigt den Anwendungsfall: Das Rad W₈ mit v₁ = 0, v₂ = 1 startet mit P₀ = {0, 1} statt {8, 0} und besteht die Verifikation.

## 14 Verifikation und Ergebnisse (Theorem 1)

Wie in Teil I wird jede Papier-Spezifikation auf der fertigen Zeichnung unabhängig **nachgemessen**, statt sie der Konstruktion zu glauben.

### 14.1 Geometrischer 1-Bend-Verifier

`verifyOneBendDrawing` (TS) bzw. `verify_onebend_drawing` (C++) prüfen auf exakten Ganzzahlkoordinaten (TS: BigInt, C++: `__int128`, keine Gleitkommatoleranzen):

1. **Planarität:** paarweise Segment-Schnitttests; erlaubt sind nur Berührungen in gemeinsamen Endknoten bzw. am gemeinsamen Knick derselben Kante; kollineare Überlappungen und Knoten im Inneren fremder Segmente sind Fehler.
2. **Knickzahl:** höchstens **ein** Knick pro Kante (nach Entfernung degenerierter Punkte).
3. **Steigungen (exakt, rational):** jedes Segment ist vertikal, horizontal, steil (|dy|·j = k·|dx| für ein j ∈ 1…D₃) oder flach (|dy|·D₃ = j·|dx|, Steigung > 0, j ∈ 1…D₃−1). Die Zahl **verschiedener** Steigungen wird gegen die **strikte** Schranke gemessen — 3·max(Δ, 5)−8 für 3-zusammenhängende Eingaben, ⌈9Δ/2⌉+1 nach Augmentierung — bewusst gegen das ursprüngliche Δ, nicht gegen interne Größen.
4. **Kantenform je Farbe (I.5):** schwarz/blau/grün/rot und die Basiskanten-Sonderform werden exakt gegen die zulässigen Segmentfolgen geprüft.
5. **Höhen-Invariante I.4:** jede Knoten-y-Koordinate ist ein Vielfaches von k.
6. **Gitter und Fläche:** Ganzzahligkeit; Breite ≤ 12Δ_eff·N² und Höhe ≤ 18Δ_eff·N³ (N = max(n, 6)) bei Papier-k; bei manuellem k die Ersatzinvariante H ≤ n·(B+k) aus Abschnitt 12.3.

### 14.2 Testkorpus und Mutationstest

Der C++-Treiber `onebend_test` erzeugt **297 Instanzen** pro Lauf: maximal-planare/triangulierte Graphen (direkt 3-zusammenhängend), zufällig 3-zusammenhängende, Räder, Prismen/Antiprismen, den **Ikosaeder** (deg(v_n) = Δ-Sonderfall) sowie nicht-3-zusammenhängende Eingaben (Bäume, Sterne, Spinnen, `random_planar_graph`) über den Korollar-2-Pfad. Der Ordnungs-Checker (Abschnitt 11.1) läuft über jede erzeugte Ordnung. Ein **Mutationsschalter** (`-m`) injiziert gezielte Fehler (Vorzeichen-/Portfehler); der Verifier muss anschlagen — das belegt seine Aussagekraft. Die TypeScript-Suite (vitest) spiegelt diesen Korpus als Property-Tests; sie umfasst insgesamt **189 Tests** (davon 96 im 1-Bend-Modul), einschließlich der k-Läufe aus Abschnitt 12.5 und der Wurzelvorgaben-Tests aus Abschnitt 13.3.

### 14.3 Ergebnisse

- **C++ `onebend_test`: 297/297 bestanden**, null Fehlschläge (inkl. strikter Steigungs- und Flächenschranken); **TypeScript-Suite: 189/189 bestanden**; der Produktionsbau (`npm run build`) bleibt fehlerfrei.
- **Ikosaeder** (5-regulär, Δ_eff = 5): korrekt gezeichnet inklusive des deg(v_n) = Δ-Sonderfalls (Abschnitt 11.5).
- **Kreuzvalidierung:** identische Beispielgraphen liefern in C++ und TypeScript dieselben Steigungszahlen und denselben PASS-Status.

Die interaktive GraphWin-Anwendung wie auch die Webapp führen denselben Verifier nach jedem Layout aus und melden Statistik und PASS/FAIL.

## Literatur

- **[BKKP26]** M. A. Bekos, E. Katsanou, P. Kindermann, M. E. Pavlidi: *How Many Slopes Does Polynomial Area Cost?* arXiv:2605.31098, 2026.
- **[BK98]** T. Biedl, G. Kant: *A better heuristic for orthogonal graph drawings.* Comput. Geom. 9(3):159–180, 1998.
- **[KPP13]** B. Keszegh, J. Pach, D. Pálvölgyi: *Drawing planar graphs of bounded degree with few slopes.* SIAM J. Discrete Math. 27(2):1171–1183, 2013 (arXiv:1009.1315).
- **[KB92]** G. Kant, H. L. Bodlaender: *Triangulating planar graphs while minimizing the maximum degree.* SWAT 1992, LNCS 621, S. 258–271.
- **[Kant96]** G. Kant: *Drawing planar graphs using the canonical ordering.* Algorithmica 16(1):4–32, 1996.
- **[RT86]** P. Rosenstiehl, R. E. Tarjan: *Rectilinear planar layouts and bipolar orientations of planar graphs.* Discrete Comput. Geom. 1:343–353, 1986.
- **[TT86]** R. Tamassia, I. G. Tollis: *A unified approach to visibility representations of planar graphs.* Discrete Comput. Geom. 1:321–341, 1986.
