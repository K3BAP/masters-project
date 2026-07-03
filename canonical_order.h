// =====================================================================
// Kanonische Ordnung 3-zusammenhaengender planarer Graphen
// (Definition nach Bekos et al., Abschnitt 2, zurueckgehend auf Kant).
//
// Eine kanonische Ordnung ist eine Partition Pi = (P_0, ..., P_m) der
// Knotenmenge in Pfade mit P_0 = {v1, v2}, P_m = {vn}, sodass (v1,v2)
// und (v1,vn) Aussenkanten sind und fuer i = 1..m-1 gilt:
//  (i)   G_i (induziert von P_0 u ... u P_i) ist bikonnektiert, intern
//        3-zusammenhaengend und mit C_i u {(v1,v2)} als Aussenflaeche
//        eingebettet (C_i = Kontur = Aussenzyklus ohne (v1,v2));
//  (ii)  alle Nachbarn von P_i in G_{i-1} liegen auf C_{i-1};
//  (iii) P_i ist Singleton oder Kette (alle Grade in G_i genau 2);
//  (iv)  jeder Knoten von P_i hat einen Nachbarn in P_j mit j > i.
//
// Berechnung per Reverse Peeling auf dem Rotationssystem; der Checker
// validiert die Bedingungen unabhaengig (Referee fuer die Tests).
// =====================================================================
#ifndef CANONICAL_ORDER_H
#define CANONICAL_ORDER_H

#include <LEDA/graph/graph.h>
#include <string>
#include <vector>

struct CanonicalOrder {
    // parts[0] = {v1, v2}; parts.back() = {vn}. Ketten sind in
    // Konturrichtung gespeichert (erster Knoten benachbart zum linken
    // Nachbarn v_l auf der Kontur).
    std::vector<std::vector<leda::node> > parts;
    leda::node v1, v2, vn;
};

// Vorbedingung: G ist ein planarer Map (bidirektional, eingebettet via
// PLANAR(G,true)), einfach (keine Mehrfachkanten im ungerichteten Sinn),
// 3-zusammenhaengend, n >= 3. vn wird als Knoten minimalen Grades
// gewaehlt (wichtig fuer Theorem 1: deg(vn) < Delta wenn moeglich).
bool compute_canonical_order(const leda::graph& G, CanonicalOrder& order,
                             std::string& error);

// Prueft (i)-(iv) sowie die Partitions-/Pfadstruktur unabhaengig von der
// Berechnung. error erhaelt eine Beschreibung des ersten Verstosses.
bool check_canonical_order(const leda::graph& G, const CanonicalOrder& order,
                           std::string& error);

#endif
