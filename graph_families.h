// =====================================================================
// Instanzfamilien fuer die systematische Vermessung (measure.cpp).
//
// Buendelt die Generatoren, die bisher als static in slopes_test.cpp und
// onebend_test.cpp lagen, und ergaenzt sie um die beiden Familien, die
// den n-Sweep bei konstantem Maximalgrad tragen: Prisma (Delta = 3) und
// Antiprisma (Delta = 4). Bei zufaelligen Triangulierungen waechst Delta
// mit n, dort laesst sich die n-Abhaengigkeit nicht isolieren.
//
// Die Testprogramme bleiben absichtlich unveraendert: ihre Fallzahlen
// sind im Projektbericht zitiert, und die Tests sollen vom Messwerkzeug
// unabhaengig bleiben.
// =====================================================================
#ifndef GRAPH_FAMILIES_H
#define GRAPH_FAMILIES_H

#include <LEDA/graph/graph.h>

// Schleifen, Mehrfach- und antiparallele Kanten entfernen.
void gf_sanitize(leda::graph& G);

void gf_k4(leda::graph& G);
void gf_octahedron(leda::graph& G);          // 4-regulaer, Ausnahme der Schranke
void gf_icosahedron(leda::graph& G);         // 5-regulaer, Sonderfall deg(vn)=Delta
void gf_prism(leda::graph& G, int m);        // n = 2m, Delta = 3, 3-zusammenhaengend
void gf_antiprism(leda::graph& G, int m);    // n = 2m, Delta = 4, 3-zusammenhaengend
void gf_wheel(leda::graph& G, int m);        // n = m+1, Delta = m
void gf_double_wheel(leda::graph& G, int m); // n = m+2, Delta = m
void gf_path(leda::graph& G, int m);
void gf_star(leda::graph& G, int m);
void gf_spider(leda::graph& G, int legs, int len);
void gf_grid(leda::graph& G, int w, int h);  // Delta = 4, bipartit

// Zufaelliger planarer Graph mit n Knoten und (hoechstens) m Kanten:
// maximale Triangulierung, danach zufaelliges Ausduennen unter Erhalt
// eines Spannbaums. Der eigene PRNG macht das Ergebnis allein von
// `seed` abhaengig -- LEDAs random_planar_graph liefert trotz
// rand_int.set_seed() von Lauf zu Lauf verschiedene Graphen.
void gf_random_planar(leda::graph& G, int n, int m, unsigned seed);

#endif
