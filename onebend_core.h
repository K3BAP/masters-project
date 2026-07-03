// =====================================================================
// Kern des 1-Bend-Algorithmus (Bekos, Katsanou, Kindermann, Pavlidi:
// "How Many Slopes Does Polynomial Area Cost?", Theorem 1 + Korollar 2)
//
// 1-Bend planare Gitterzeichnungen 3-zusammenhaengender planarer Graphen
// mit hoechstens 3*Delta - 8 Steigungen auf einem 12*Delta*n^2 x
// 18*Delta*n^3 Gitter (Delta >= 5). Beliebige planare Graphen werden
// per gradbeschraenkter Flaechen-Chord-Augmentierung (planar_aug) 3-fach
// zusammenhaengend gemacht (Korollar 2: ceil(9*Delta/2) + 1 Steigungen).
//
// Aufbau: kanonische Ordnung (canonical_order) -> inkrementelle
// Konstruktion entlang der Kontur mit Schnyder-artiger 4-Kantenfaerbung
// und Cut-basierter horizontaler Streckung. Anders als bei Theorem 4
// kann die Geometrie nicht aufgeschoben werden -- Streckungen
// verschieben bereits platzierte Teile der Zeichnung.
//
// Kein GraphWin/X11-Bezug: nutzbar aus GUI-App und Headless-Tests.
// =====================================================================
#ifndef ONEBEND_CORE_H
#define ONEBEND_CORE_H

#include <LEDA/graph/graph.h>
#include <LEDA/core/list.h>
#include <LEDA/geo/point.h>
#include <string>

// 4-Kantenfaerbung (Verifier prueft die Kantenform je Farbe, I.5)
enum OneBendColor {
    OB_BLACK = 0,   // ein horizontales Segment ((v1,v2): Sonderform)
    OB_BLUE  = 1,   // Quellsegment in S_v u S_rs, Zielsegment horizontal
    OB_GREEN = 2,   // Quellsegment in S_v u S_ls, Zielsegment horizontal
    OB_RED   = 3    // Quellsegment vertikal, Zielsegment in S_f u S_v
};

struct OneBendStats {
    int n = 0;                  // Knoten
    int m = 0;                  // ungerichtete Kanten (augmentierter Graph)
    int delta_orig = 0;         // Maxgrad des Eingabegraphen
    int delta_aug = 0;          // Maxgrad nach Augmentierung
    int delta_eff = 0;          // max(delta_aug, 5) -- bestimmt S
    long long k = 0;            // Parameter k = 4 * delta_eff * n^2
    int slopes_allowed = 0;     // |S| = 3*delta_eff - 8
    int slopes_used = 0;        // fuellt der Verifier
    bool augmented = false;     // Kanten fuer 3-Zusammenhang ergaenzt
    bool special_vn = false;    // Sonderfall deg(vn) == delta_eff
    int parts = 0;              // Teile der kanonischen Ordnung (inkl. P0)
    long long width = 0;        // fuellt der Verifier
    long long height = 0;       // fuellt der Verifier
};

struct OneBendResult {
    // Logische, ganzzahlige Gitterkoordinaten (y-Werte der Knoten sind
    // Vielfache von k; die Basiszeile liegt bei y = 0, der Knick der
    // wieder eingesetzten Kante (v1,v2) darunter).
    leda::node_array<leda::point> pos;
    // Hoechstens ein Knick pro Kante; Liste in kanonischer Richtung
    // (frueherer -> spaeterer Teil der Ordnung).
    leda::edge_array<leda::list<leda::point> > bends;
    leda::edge_array<int> color;      // OneBendColor
    leda::node_array<int> part;       // Teilindex der kanonischen Ordnung
    leda::node v1, v2, vn;            // ausgezeichnete Knoten der Ordnung
    OneBendStats stats;
    std::string error;                // leer = Erfolg
};

// Berechnet die Zeichnung. G wird waehrend der Berechnung augmentiert
// und vor der Rueckgabe wieder auf die urspruenglichen Kanten reduziert.
bool compute_onebend_drawing(leda::graph& G, OneBendResult& result,
                             bool verbose = false);

// Prueft die Spezifikationen aus dem Paper auf der fertigen Zeichnung:
// Planaritaet (exakte Ganzzahlarithmetik), <= 1 Knick pro Kante,
// Steigungen exakt in S (rationale Tests), Kantenform je Farbe (I.5),
// Knoten-y = Vielfache von k (I.4), Gitterschranken. Die strikte
// Steigungsschranke ist 3*max(Delta,5) - 8 fuer 3-zusammenhaengende
// Eingaben bzw. ceil(9*Delta/2) + 1 nach Augmentierung (Korollar 2).
bool verify_onebend_drawing(const leda::graph& G, OneBendResult& result,
                            std::string& report);

#endif
