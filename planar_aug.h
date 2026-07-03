// =====================================================================
// Gradbeschraenkte planare Augmentierung (Kant / Kant-Bodlaender-Stil)
//
// Ersatz fuer LEDAs Make_Connected / Make_Biconnected / Make_Triconnected,
// die den Maximalgrad stark aufblaehen koennen. Alle Augmentierungen
// arbeiten mit Flaechen-Chorden: zwei nicht benachbarte Knoten derselben
// Flaeche der planaren Einbettung koennen planar verbunden werden. Die
// Auswahl minimiert max(deg(u), deg(w)), dann deg(u)+deg(w) -- so bleibt
// der Gradzuwachs klein (Ziel: <= 2 fuer Bikonnektivierung, Korollar 5;
// Kant-Schranke fuer Trikonnektivierung, Korollar 2).
//
// Gemeinsame Vorbedingung fuer die *_bounded-Funktionen unten:
// G ist bidirektional (make_bidirected + Reversals) und planar; eingefuegte
// Chord-Paare werden ueber fwd/rev zurueckgemeldet, damit der Aufrufer sie
// nach der Berechnung wieder entfernen kann.
// =====================================================================
#ifndef PLANAR_AUG_H
#define PLANAR_AUG_H

#include <LEDA/graph/graph.h>
#include <LEDA/core/list.h>
#include <string>

// Ungerichtete Kante als Paar gerichteter Kanten mit Reversal-Info einfuegen.
leda::edge aug_add_undirected(leda::graph& G, leda::node a, leda::node b,
                              leda::list<leda::edge>& fwd,
                              leda::list<leda::edge>& rev);

// Komponenten zu einer Kette verbinden; pro Komponente werden Ein- und
// Ausstiegsknoten mit minimalem Grad gewaehlt (verschieden, wenn moeglich).
void augment_connected_bounded(leda::graph& G, leda::list<leda::edge>& fwd,
                               leda::list<leda::edge>& rev);

// Flaechen-Chorden einfuegen, bis G bikonnektiert ist: zwei Knoten u, w
// derselben Flaeche ohne gemeinsamen Block verschmelzen Bloecke.
// Vorbedingung: G zusammenhaengend. false + error bei internem Fehler.
bool augment_biconnected_bounded(leda::graph& G, leda::list<leda::edge>& fwd,
                                 leda::list<leda::edge>& rev,
                                 std::string& error);

// Flaechen-Chorden einfuegen, bis G 3-zusammenhaengend ist (Korollar 2):
// zu jedem Separationspaar {a,b} (LEDA Is_Triconnected) wird eine Chorde
// zwischen zwei Knoten VERSCHIEDENER Komponenten von G - {a,b} auf einer
// gemeinsamen Flaeche eingefuegt; a, b selbst sind nie Endpunkte (ihr Grad
// waechst nicht). Vorbedingung: G bikonnektiert. n <= 3 wird zu K_n
// vervollstaendigt. false + error bei internem Fehler.
bool augment_triconnected_bounded(leda::graph& G, leda::list<leda::edge>& fwd,
                                  leda::list<leda::edge>& rev,
                                  std::string& error);

#endif
