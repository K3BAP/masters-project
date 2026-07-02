// =====================================================================
// Kern des Slope-Algorithmus (Bekos, Katsanou, Kindermann, Pavlidi:
// "How Many Slopes Does Polynomial Area Cost?", Theorem 4 + Korollar 5)
//
// 2-Bend planare Zeichnungen mit ceil(Delta/2) Steigungen (+1 falls
// Bikonnektivitäts-Augmentierung nötig) auf einem O(n) x O(Delta n^2)
// Gitter. Verallgemeinerung des Biedl-Kant-Algorithmus.
//
// Kein GraphWin/X11-Bezug: nutzbar aus GUI-App und Headless-Tests.
// =====================================================================
#ifndef SLOPES_CORE_H
#define SLOPES_CORE_H

#include <LEDA/graph/graph.h>
#include <LEDA/core/list.h>
#include <LEDA/geo/point.h>
#include <string>

struct SlopesStats {
    int n = 0;                 // Knoten (augmentierter Graph)
    int m = 0;                 // ungerichtete Kanten (augmentierter Graph)
    int delta_orig = 0;        // Maxgrad des Eingabegraphen
    int delta_eff = 0;         // effektiver Grad (nach Augmentierung, gerade gerundet, ggf. Regularitäts-Bump)
    int slopes_allowed = 0;    // |S| = delta_eff / 2
    int slopes_used = 0;       // tatsächlich benutzte Steigungen (füllt der Verifier)
    bool augmented = false;    // Make_Connected/Make_Biconnected hat Kanten ergänzt
    bool regular_bumped = false; // delta_eff wegen Regularität erhöht (z.B. Oktaeder)
    long long width = 0;       // Breite in Gitterspalten (füllt der Verifier)
    long long height = 0;      // Höhe in Gitterzeilen (füllt der Verifier)
    long long row_spacing = 0; // R = (delta_eff/2)*(2m-n)+1
    long long bottom_drop = 0; // L = (delta_eff/4)*(2m-n)+1
};

struct SlopesResult {
    // Logische, ganzzahlige Gitterkoordinaten. Nur für Knoten/Kanten
    // gültig, die den Aufruf überleben (temporäre Kanten werden entfernt).
    leda::node_array<leda::point> pos;
    // Knickpunkte in logischen Koordinaten, orientiert von source nach target.
    leda::edge_array<leda::list<leda::point> > bends;
    SlopesStats stats;
    std::string error;         // leer = Erfolg
};

// Berechnet die Zeichnung. G wird während der Berechnung augmentiert und
// vor der Rückgabe wieder auf die ursprünglichen Kanten reduziert.
// st_num_out (optional) erhält die berechnete ST-Nummerierung.
bool compute_slopes_drawing(leda::graph& G, SlopesResult& result,
                            leda::node_array<int>* st_num_out = 0,
                            bool verbose = false);

// Prüft die Spezifikationen aus dem Paper auf der fertigen Zeichnung:
// Planarität (exakte Ganzzahlarithmetik), <= 2 Knicke pro Kante,
// Steigungen aus S, Gitterpunkte, Flächenschranken.
// Füllt stats.slopes_used/width/height. report erhält eine Zusammenfassung.
bool verify_slopes_drawing(const leda::graph& G, SlopesResult& result,
                           std::string& report);

#endif
