// =====================================================================
// Implementierung von Theorem 4 + Korollar 5 aus
// Bekos, Katsanou, Kindermann, Pavlidi:
// "How Many Slopes Does Polynomial Area Cost?" (arXiv 2605.31098)
//
// Aufbau analog zu biedl_kant.cpp: ST-Nummerierung, eine Zeile pro
// Knoten, Spalten-basiertes Kantenrouting. Statt 4 orthogonaler Ports
// hat jeder Knoten 2*ceil(Delta/2) Ports aus dem Steigungs-Set
// S = { -floor(D/4)+1, ..., 0, ..., ceil(D/4)-1 } + vertikal.
//
// Zentrale Designentscheidung: Das Routing vergibt nur KOMBINATORIK
// (Spalten + Steigungen). Die Geometrie (Zeilen, Knickpunkte) wird in
// einem einzigen Abschlussdurchlauf berechnet, damit shift_right keine
// schrägen Segmente zerstören kann.
// =====================================================================

#include "slopes_core.h"
#include "planar_aug.h"

#include <LEDA/graph/graph_alg.h>
#include <LEDA/graph/graph_misc.h>
#include <LEDA/graph/plane_graph_alg.h>

#include <vector>
#include <set>
#include <map>
#include <algorithm>
#include <climits>
#include <cmath>
#include <cstdio>
#include <iostream>

using namespace leda;
using std::cout;
using std::endl;

namespace {

const int UNASSIGNED = INT_MIN;

// ---------------------------------------------------------------------
// Port-Modell: jede Steigung liefert zwei gerichtete Strahlen.
// side: +1 = rechte Halbebene / vertikal nach oben,
//       -1 = linke Halbebene / vertikal nach unten.
// ---------------------------------------------------------------------
struct Port {
    int  slope;     // endliche Steigung (bei vertical beliebig 0)
    bool vertical;
    int  side;
};

// Ports in Gegenuhrzeigersinn-Reihenfolge (nach Winkel), beginnend bei
// (0, rechts):  (0,R),(1..hi,R),(inf,U),(lo..-1,L),(0..hi,L),(inf,D),(lo..-1,R)
std::vector<Port> build_ports_ccw(int delta_eff, int& idx_down) {
    int hi = (delta_eff + 3) / 4 - 1;      // ceil(D/4)-1
    int lo = -(delta_eff / 4 - 1);         // -(floor(D/4)-1)
    std::vector<Port> P;
    for (int s = 0; s <= hi; s++) P.push_back(Port{s, false, +1});
    P.push_back(Port{0, true, +1});                                  // vertikal hoch
    for (int s = lo; s <= -1; s++) P.push_back(Port{s, false, -1});
    for (int s = 0; s <= hi; s++) P.push_back(Port{s, false, -1});
    idx_down = (int)P.size();
    P.push_back(Port{0, true, -1});                                  // vertikal runter
    for (int s = lo; s <= -1; s++) P.push_back(Port{s, false, +1});
    return P;
}

// ---------------------------------------------------------------------
// Spalte einfuegen: alles ab target_x eine Spalte nach rechts.
// Dank aufgeschobener Geometrie muessen nur Spaltenindizes angepasst
// werden -- keine Knickpunkte.
// ---------------------------------------------------------------------
void shift_right(int target_x, graph& G,
                 node_array<int>& x_node, edge_array<int>& x_edge, int& x_max) {
    x_max++;
    node w;
    forall_nodes(w, G)
        if (x_node[w] != UNASSIGNED && x_node[w] >= target_x) x_node[w]++;
    edge e;
    forall_edges(e, G)
        if (x_edge[e] != UNASSIGNED && x_edge[e] >= target_x) x_edge[e]++;
}

// Gradbeschraenkte Augmentierung: siehe planar_aug.{h,cpp} (Flaechen-Chorden,
// gemeinsam mit dem 1-Bend-Algorithmus aus Theorem 1 genutzt).

struct Ctx {
    graph* G;
    node_array<int>* st;
    node_array<int>* x_node;
    edge_array<int>* x_edge;
    edge_array<int>* slope_src;   // Steigung des ersten Segments (am unteren Knoten)
    edge_array<int>* slope_tgt;   // Steigung des letzten Segments (am oberen Knoten)
    std::vector<Port>* ports;
    int idx_down;
    int n;
    edge e_st;                    // ST-Kante (v1 -> vn); Anker der Rotation an v1
    bool verbose;
    std::string error;
};

// Kanonische Richtung: von kleinerer zu groesserer ST-Nummer.
edge canon(const Ctx& c, edge e) {
    node s = c.G->source(e), t = c.G->target(e);
    if ((*c.st)[s] < (*c.st)[t]) return e;
    edge r = c.G->reversal(e);
    return r ? r : e;
}

bool fail(Ctx& c, const std::string& msg) {
    c.error = msg;
    if (c.verbose) cout << "[SLOPES][ERROR] " << msg << endl;
    return false;
}

// ---------------------------------------------------------------------
// Ein Knoten: Rotation zerlegen, Ports vergeben, Spalten allokieren.
// flip = Interpretation der Adjazenzlisten-Orientierung umdrehen.
// ---------------------------------------------------------------------
bool process_vertex(Ctx& c, node v, int& x_max, bool flip) {
    graph& G = *c.G;
    node_array<int>& st = *c.st;
    node_array<int>& x_node = *c.x_node;
    edge_array<int>& x_edge = *c.x_edge;
    const std::vector<Port>& ports = *c.ports;
    const int P = (int)ports.size();
    const int i = st[v];

    // Rotation am Knoten (planare Einbettung; LEDA: Uhrzeigersinn)
    std::vector<edge> rot;
    edge e;
    forall_adj_edges(e, v) rot.push_back(e);
    if (flip) std::reverse(rot.begin(), rot.end());
    const int deg = (int)rot.size();

    if (deg > P)
        return fail(c, "Knotengrad uebersteigt Portanzahl (interner Fehler)");

    // in/out-Runs bestimmen. in_ltr = einlaufende Kanten von links nach
    // rechts (Pending-Reihenfolge), outs = auslaufende links nach rechts.
    std::vector<edge> in_ltr, outs;

    if (i == 1) {
        // Quelle: alle Kanten laufen aus. Die Rotation wird an der
        // ST-Kante verankert -- die Aussenflaeche der Zeichnung ist die
        // an e_st angrenzende Flaeche, e_st wird linkeste Pending-Kante.
        int anchor = -1;
        for (int j = 0; j < deg; j++)
            if (rot[j] == c.e_st || G.reversal(rot[j]) == c.e_st) { anchor = j; break; }
        if (anchor < 0)
            return fail(c, "ST-Kante am Startknoten nicht gefunden");
        for (int j = 0; j < deg; j++) outs.push_back(rot[(anchor + j) % deg]);
    } else if (i == c.n) {
        // Senke: alle Kanten laufen ein. Zyklische Reihenfolge an der
        // eindeutigen Spalten-Aufstiegsstelle linearisieren.
        if (deg == 1) {
            in_ltr.push_back(rot[0]);
        } else {
            int ascents = 0, cut = -1;
            for (int j = 0; j < deg; j++) {
                int xa = x_edge[canon(c, rot[j])];
                int xb = x_edge[canon(c, rot[(j + 1) % deg])];
                if (xa == UNASSIGNED || xb == UNASSIGNED)
                    return fail(c, "In-Kante der Senke ohne Spalte");
                if (xa < xb) { ascents++; cut = j; }
            }
            if (ascents != 1)
                return fail(c, "Einbettung an der Senke nicht bipolar (Spaltenfolge)");
            // cut = Position von e_1; Rueckwaertslauf liefert direkt e_1..e_k
            for (int j = 0; j < deg; j++)
                in_ltr.push_back(rot[(cut + deg - j) % deg]);
        }
    } else {
        // Innerer Knoten: genau ein Uebergang in->out in der Rotation.
        std::vector<bool> is_out(deg);
        for (int j = 0; j < deg; j++)
            is_out[j] = st[G.opposite(v, rot[j])] > i;
        int transitions = 0, out_start = -1;
        for (int j = 0; j < deg; j++) {
            if (!is_out[j] && is_out[(j + 1) % deg]) { transitions++; out_start = (j + 1) % deg; }
        }
        if (transitions != 1)
            return fail(c, "Einbettung nicht bipolar an Knoten (in-Kanten nicht zusammenhaengend)");
        int j = out_start;
        while (is_out[j]) { outs.push_back(rot[j]); j = (j + 1) % deg; }
        while (j != out_start) { in_ltr.push_back(rot[j]); j = (j + 1) % deg; }
        std::reverse(in_ltr.begin(), in_ltr.end());  // Uhrzeigersinn liefert e_k..e_1
    }

    const int k = (int)in_ltr.size();
    const int q = (int)outs.size();

    // Pending-Invariante: Spalten der In-Kanten streng aufsteigend.
    for (int j = 0; j + 1 < k; j++) {
        if (x_edge[canon(c, in_ltr[j])] >= x_edge[canon(c, in_ltr[j + 1])])
            return fail(c, "Spaltenordnung der In-Kanten verletzt (Einbettung/ST inkonsistent)");
    }

    // Median-In-Kante bestimmt die Spalte des Knotens.
    const int med = (k + 1) / 2;   // 1-indiziert, ceil(k/2)
    if (i == 1) {
        x_node[v] = x_max;                // = 0 beim Start
    } else {
        x_node[v] = x_edge[canon(c, in_ltr[med - 1])];
    }

    if (c.verbose)
        cout << "[SLOPES] Knoten st=" << i << " deg=" << deg << " k=" << k
             << " q=" << q << " Spalte=" << x_node[v] << endl;

    // ------------------------------------------------------------------
    // Portvergabe: alle k+q Kanten bekommen ccw-konsekutive Ports,
    // Median-In-Kante fest auf (vertikal, unten).
    // ccw-Folge: e_1..e_k, o_q..o_1
    // ------------------------------------------------------------------
    std::vector<int> port_of_out(q, -1);
    for (int j = 0; j < k; j++) {
        int off = (j + 1) - med;                       // e_{med} -> 0
        int idx = ((c.idx_down + off) % P + P) % P;
        const Port& p = ports[idx];
        if (j + 1 == med) {
            // vertikal unten -- letztes Segment entfaellt (Spalte == Knotenspalte)
            (*c.slope_tgt)[canon(c, in_ltr[j])] = 0;
            continue;
        }
        if (p.vertical)
            return fail(c, "In-Kante wuerde vertikalen Port belegen (Grad zu hoch?)");
        (*c.slope_tgt)[canon(c, in_ltr[j])] = p.slope;
    }
    for (int j = 1; j <= q; j++) {
        int idx = (c.idx_down + (k - med) + j) % P;
        port_of_out[q - j] = idx;                      // o_{q+1-j} bekommt Offset +j
        if (ports[idx].vertical && ports[idx].side < 0)
            return fail(c, "Out-Kante wuerde unteren vertikalen Port belegen");
    }

    // ------------------------------------------------------------------
    // Spalten fuer Out-Kanten: links / vertikal / rechts, in Pending-
    // Reihenfolge streng aufsteigend.
    // Muster in o_1..o_q: L*, (inf,U)?, R*  (Zusicherung unten)
    // ------------------------------------------------------------------
    int nL = 0, nR = 0, up_idx = -1;
    for (int j = 0; j < q; j++) {
        const Port& p = ports[port_of_out[j]];
        if (p.vertical) {
            if (up_idx >= 0) return fail(c, "Zwei vertikale Out-Ports (intern)");
            up_idx = j;
        } else if (p.side < 0) {
            if (up_idx >= 0 || nR > 0)
                return fail(c, "Out-Port-Muster verletzt (links nach oben/rechts)");
            nL++;
        } else {
            nR++;
        }
    }

    // links: nL Shifts am Pivot x_node[v] -- gibt Spalten x_v-nL..x_v-1 frei
    for (int t = 0; t < nL; t++) shift_right(x_node[v], G, x_node, x_edge, x_max);
    for (int j = 0; j < nL; j++)
        x_edge[canon(c, outs[j])] = x_node[v] - nL + j;
    // vertikal hoch: erbt die Knotenspalte
    if (up_idx >= 0)
        x_edge[canon(c, outs[up_idx])] = x_node[v];
    // rechts: nR Shifts am Pivot x_node[v]+1 -- gibt x_v+1..x_v+nR frei
    for (int t = 0; t < nR; t++) shift_right(x_node[v] + 1, G, x_node, x_edge, x_max);
    for (int j = 0; j < nR; j++)
        x_edge[canon(c, outs[q - nR + j])] = x_node[v] + 1 + j;

    // Steigungen der ersten Segmente eintragen
    for (int j = 0; j < q; j++) {
        const Port& p = ports[port_of_out[j]];
        (*c.slope_src)[canon(c, outs[j])] = p.vertical ? 0 : p.slope;
    }

    return true;
}

// Kompletter Routing-Versuch mit einer Orientierungs-Interpretation.
bool attempt_routing(Ctx& c, const list<node>& st_list, bool flip) {
    graph& G = *c.G;
    c.x_node->init(G, UNASSIGNED);
    c.x_edge->init(G, UNASSIGNED);
    c.slope_src->init(G, 0);
    c.slope_tgt->init(G, 0);
    c.error.clear();

    int x_max = 0;
    node v;
    forall(v, st_list)
        if (!process_vertex(c, v, x_max, flip)) return false;
    return true;
}

// ---------------------------------------------------------------------
// Exakte Geometrie-Hilfen fuer den Verifier (Ganzzahlarithmetik)
// ---------------------------------------------------------------------
typedef long long ll;
typedef __int128 lll;

struct Pt { ll x, y; bool operator==(const Pt& o) const { return x == o.x && y == o.y; }
            bool operator<(const Pt& o) const { return x != o.x ? x < o.x : y < o.y; } };
struct Seg { Pt a, b; int edge_id; };

int sgn(lll v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); }
lll cross(const Pt& o, const Pt& a, const Pt& b) {
    return (lll)(a.x - o.x) * (b.y - o.y) - (lll)(a.y - o.y) * (b.x - o.x);
}
bool on_segment(const Pt& p, const Seg& s) {
    if (cross(s.a, s.b, p) != 0) return false;
    return p.x >= std::min(s.a.x, s.b.x) && p.x <= std::max(s.a.x, s.b.x) &&
           p.y >= std::min(s.a.y, s.b.y) && p.y <= std::max(s.a.y, s.b.y);
}

// Liefert Schnitt-Typ: 0 = disjunkt, 1 = Beruehrung in genau einem Punkt
// (Punkt in *touch), 2 = echte Kreuzung oder Ueberlappung.
int seg_intersect(const Seg& s, const Seg& t, Pt* touch) {
    int d1 = sgn(cross(s.a, s.b, t.a));
    int d2 = sgn(cross(s.a, s.b, t.b));
    int d3 = sgn(cross(t.a, t.b, s.a));
    int d4 = sgn(cross(t.a, t.b, s.b));

    if (d1 * d2 < 0 && d3 * d4 < 0) return 2;          // echte Kreuzung

    // Kollineare Faelle / Beruehrungen ueber Endpunkte
    int touches = 0; Pt tp{0, 0};
    Pt cand[4] = { t.a, t.b, s.a, s.b };
    const Seg* seg_for[4] = { &s, &s, &t, &t };
    bool seen_any = false;
    for (int idx = 0; idx < 4; idx++) {
        if (on_segment(cand[idx], *seg_for[idx])) {
            if (!seen_any) { tp = cand[idx]; seen_any = true; touches = 1; }
            else if (!(cand[idx] == tp)) return 2;      // mehr als ein gemeinsamer Punkt
        }
    }
    if (!seen_any) return 0;
    if (touch) *touch = tp;
    return touches;
}

ll ll_of(double d) { return (ll)llround(d); }
bool is_integral(double d) { return std::abs(d - llround(d)) < 1e-9; }

} // namespace

// =====================================================================
// Hauptfunktion
// =====================================================================
bool compute_slopes_drawing(graph& G, SlopesResult& result,
                            node_array<int>* st_num_out, bool verbose) {
    result.error.clear();
    result.stats = SlopesStats();
    edge e; node v;

    if (G.number_of_nodes() == 0) { result.error = "Leerer Graph."; return false; }

    // Ergebnis-Arrays frueh an G binden (ueberleben das Loeschen temporaerer Kanten)
    result.pos.init(G, point(0, 0));
    result.bends.init(G);

    if (G.number_of_nodes() == 1) {
        result.stats.n = 1;
        forall_nodes(v, G) result.pos[v] = point(0, 0);
        return true;
    }

    forall_edges(e, G)
        if (G.source(e) == G.target(e)) { result.error = "Schleifen sind nicht erlaubt."; return false; }
    if (!Is_Simple_Undirected(G)) { result.error = "Mehrfachkanten sind nicht erlaubt."; return false; }

    // ------------------------------------------------------------------
    // Phase 1: bidirektional machen, Planaritaet pruefen
    // ------------------------------------------------------------------
    list<edge> reverse_edges;
    G.make_bidirected(reverse_edges);

    if (!PLANAR(G, true)) {
        G.del_edges(reverse_edges);
        result.error = "Der Graph ist nicht planar.";
        return false;
    }

    int delta_orig = 0;
    forall_nodes(v, G) delta_orig = std::max(delta_orig, G.outdeg(v));
    result.stats.delta_orig = delta_orig;

    // ------------------------------------------------------------------
    // Phase 2: zusammenhaengend + bikonnektiert machen (Korollar 5),
    // gradbeschraenkt (Kant-Bodlaender-Stil, Maximalgrad + <= 2)
    // ------------------------------------------------------------------
    list<edge> aug_edges, aug_reversals;
    augment_connected_bounded(G, aug_edges, aug_reversals);
    {
        std::string aug_error;
        if (!augment_biconnected_bounded(G, aug_edges, aug_reversals, aug_error)) {
            G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
            result.error = aug_error;
            return false;
        }
    }
    result.stats.augmented = !aug_edges.empty();

    // Temporaere Kanten (werden am Ende geloescht; result-Arrays kennen sie nicht)
    std::set<edge> temp_edges;
    forall(e, reverse_edges) temp_edges.insert(e);
    forall(e, aug_edges) temp_edges.insert(e);
    forall(e, aug_reversals) temp_edges.insert(e);

    if (!PLANAR(G, true)) {
        G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
        result.error = "Graph nach Augmentierung nicht planar (intern).";
        return false;
    }

    const int n = G.number_of_nodes();
    const int m = G.number_of_edges() / 2;   // bidirektional -> ungerichtete Kanten

    int delta_aug = 0, min_deg = INT_MAX;
    forall_nodes(v, G) {
        delta_aug = std::max(delta_aug, G.outdeg(v));
        min_deg = std::min(min_deg, G.outdeg(v));
    }

    // ST-Kante: Ziel = Knoten minimalen Grades (Senke braucht deg < delta_eff),
    // Quelle = moeglichst kleiner Nachbar der Senke (Quelle braucht deg < delta_eff,
    // damit an v1 ein Port fuer die Aussenflaeche frei bleibt).
    node t_min = G.first_node();
    forall_nodes(v, G) if (G.outdeg(v) < G.outdeg(t_min)) t_min = v;
    edge e_st = nil;
    forall_edges(e, G) {
        if (G.target(e) != t_min) continue;
        if (e_st == nil || G.outdeg(G.source(e)) < G.outdeg(G.source(e_st))) e_st = e;
    }
    if (e_st == nil) {
        G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
        result.error = "Keine ST-Kante gefunden (intern).";
        return false;
    }

    int delta_eff = delta_aug + (delta_aug % 2);       // gerade runden
    if (delta_eff < 4) delta_eff = 4;                  // minimales Portmodell {0, inf}
    if (min_deg >= delta_eff || G.outdeg(G.source(e_st)) >= delta_eff) {
        // regulaerer Graph (z.B. Oktaeder) oder Quelle mit Maximalgrad:
        // ein zusaetzliches Steigungspaar schafft freie Ports.
        delta_eff += 2;
        result.stats.regular_bumped = true;
    }
    result.stats.n = n;
    result.stats.m = m;
    result.stats.delta_eff = delta_eff;
    result.stats.slopes_allowed = delta_eff / 2;

    const ll span = std::max(1, 2 * m - n);
    const ll R = (ll)(delta_eff / 2) * span + 1;       // Zeilenabstand
    const ll L = (ll)(delta_eff / 4) * span + 1;       // Tiefe der Bodenkante
    result.stats.row_spacing = R;
    result.stats.bottom_drop = L;

    // ------------------------------------------------------------------
    // Phase 3: ST-Nummerierung bezueglich e_st
    // ------------------------------------------------------------------
    node_array<int> st(G);
    list<node> st_list;
    if (ST_NUMBERING(G, st, st_list, e_st) == nil) {
        G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
        result.error = "ST-Nummerierung fehlgeschlagen.";
        return false;
    }
    if (st_num_out) { st_num_out->init(G, 0); forall_nodes(v, G) (*st_num_out)[v] = st[v]; }

    // ------------------------------------------------------------------
    // Phase 4: Routing (Kombinatorik). Bei Orientierungs-Fehlschlag
    // einmal mit gespiegelter Interpretation der Rotation wiederholen.
    // ------------------------------------------------------------------
    node_array<int> x_node(G, UNASSIGNED);
    edge_array<int> x_edge(G, UNASSIGNED);
    edge_array<int> slope_src(G, 0), slope_tgt(G, 0);

    Ctx c;
    c.G = &G; c.st = &st; c.x_node = &x_node; c.x_edge = &x_edge;
    c.slope_src = &slope_src; c.slope_tgt = &slope_tgt;
    std::vector<Port> ports = build_ports_ccw(delta_eff, c.idx_down);
    c.ports = &ports; c.n = n; c.e_st = e_st; c.verbose = verbose;

    bool ok = attempt_routing(c, st_list, false);
    if (!ok) {
        if (verbose) cout << "[SLOPES] Erster Versuch fehlgeschlagen (" << c.error
                          << "), versuche gespiegelte Orientierung..." << endl;
        ok = attempt_routing(c, st_list, true);
    }
    if (!ok) {
        G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
        result.error = "Routing fehlgeschlagen: " + c.error;
        return false;
    }

    // ------------------------------------------------------------------
    // Phase 5: Geometrie -- Zeilen und Knickpunkte
    // ------------------------------------------------------------------
    node_array<ll> y_row(G, 0);
    forall_nodes(v, G) y_row[v] = (ll)(st[v] - 1) * R;

    edge_array<list<point> > geo(G);   // Knicke der kanonischen Richtung
    forall_edges(e, G) {
        node s = G.source(e), t = G.target(e);
        if (st[s] >= st[t]) continue;                  // nur kanonische Richtung
        ll xe = x_edge[e];
        ll b1y = y_row[s] + (ll)slope_src[e] * (xe - x_node[s]);
        ll b2y = y_row[t] + (ll)slope_tgt[e] * (xe - x_node[t]);
        if (xe != x_node[s]) geo[e].append(point((double)xe, (double)b1y));
        if (xe != x_node[t]) geo[e].append(point((double)xe, (double)b2y));
    }

    // Knicke auf die ueberlebenden Kanten uebertragen (richtungsgerecht).
    // result.bends wurde vor der Augmentierung initialisiert und kennt
    // nur die Original-Kanten -- temporaere ueberspringen.
    forall_edges(e, G) {
        if (temp_edges.count(e)) continue;
        node s = G.source(e), t = G.target(e);
        if (st[s] < st[t]) {
            result.bends[e] = geo[e];
        } else {
            edge r = G.reversal(e);
            if (r) { list<point> b = geo[r]; b.reverse(); result.bends[e] = b; }
        }
    }
    forall_nodes(v, G)
        result.pos[v] = point((double)x_node[v], (double)y_row[v]);

    // ------------------------------------------------------------------
    // Cleanup: alle temporaeren Kanten entfernen
    // ------------------------------------------------------------------
    G.del_edges(reverse_edges);
    G.del_edges(aug_reversals);
    G.del_edges(aug_edges);

    return true;
}

// =====================================================================
// Verifier: prueft die Papier-Spezifikationen auf der fertigen Zeichnung
// =====================================================================
bool verify_slopes_drawing(const graph& G, SlopesResult& result, std::string& report) {
    char buf[256];
    report.clear();
    bool ok = true;
    node v; edge e;

    const int delta_eff = std::max(4, result.stats.delta_eff);
    const int hi = (delta_eff + 3) / 4 - 1;
    const int lo = -(delta_eff / 4 - 1);

    // --- Ganzzahligkeit & Knotenpositionen ---
    std::map<Pt, int> node_at;
    forall_nodes(v, G) {
        point p = result.pos[v];
        if (!is_integral(p.xcoord()) || !is_integral(p.ycoord())) {
            report += "FEHLER: Knoten nicht auf Gitterpunkt\n"; ok = false;
        }
        Pt q{ ll_of(p.xcoord()), ll_of(p.ycoord()) };
        if (G.number_of_nodes() > 1 && node_at.count(q)) {
            report += "FEHLER: Zwei Knoten auf derselben Position\n"; ok = false;
        }
        node_at[q] = 1;
    }

    // --- Segmente sammeln, Knicke/Steigungen pruefen ---
    std::vector<Seg> segs;
    std::vector<std::pair<node, node> > seg_nodes;   // Endknoten der zugehoerigen Kante
    std::set<std::pair<ll, ll> > slopes_used;        // (dy,dx) normiert; vertikal = (1,0)
    int edge_id = 0;
    int max_bends = 0;
    bool all_have_vertical = true;

    forall_edges(e, G) {
        std::vector<Pt> pl;
        point ps = result.pos[G.source(e)];
        pl.push_back(Pt{ ll_of(ps.xcoord()), ll_of(ps.ycoord()) });
        point bp;
        forall(bp, result.bends[e]) {
            if (!is_integral(bp.xcoord()) || !is_integral(bp.ycoord())) {
                report += "FEHLER: Knick nicht auf Gitterpunkt\n"; ok = false;
            }
            pl.push_back(Pt{ ll_of(bp.xcoord()), ll_of(bp.ycoord()) });
        }
        point pt = result.pos[G.target(e)];
        pl.push_back(Pt{ ll_of(pt.xcoord()), ll_of(pt.ycoord()) });

        // Doppelte aufeinanderfolgende Punkte entfernen
        std::vector<Pt> clean;
        for (size_t j = 0; j < pl.size(); j++)
            if (clean.empty() || !(clean.back() == pl[j])) clean.push_back(pl[j]);

        int nb = (int)clean.size() - 2;
        max_bends = std::max(max_bends, nb);
        if (nb > 2) {
            snprintf(buf, sizeof buf, "FEHLER: Kante mit %d Knicken (> 2)\n", nb);
            report += buf; ok = false;
        }

        bool has_vertical = false;
        for (size_t j = 0; j + 1 < clean.size(); j++) {
            Seg s; s.a = clean[j]; s.b = clean[j + 1]; s.edge_id = edge_id;
            segs.push_back(s);
            seg_nodes.push_back(std::make_pair(G.source(e), G.target(e)));
            ll dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
            if (dx == 0) { has_vertical = true; slopes_used.insert(std::make_pair(1LL, 0LL)); }
            else {
                if (dy % dx != 0) {
                    report += "FEHLER: Segment mit nicht-ganzzahliger Steigung\n"; ok = false;
                } else {
                    ll s_int = dy / dx;
                    if (s_int < lo || s_int > hi) {
                        snprintf(buf, sizeof buf,
                                 "FEHLER: Steigung %lld ausserhalb S = [%d..%d] u {inf}\n",
                                 s_int, lo, hi);
                        report += buf; ok = false;
                    }
                    slopes_used.insert(std::make_pair(s_int, 1LL));
                }
            }
        }
        if (clean.size() >= 2 && !has_vertical) all_have_vertical = false;
        edge_id++;
    }

    result.stats.slopes_used = (int)slopes_used.size();
    // Strikte Papier-Schranke: ceil(Delta/2) fuer bikonnektierte Eingaben
    // (Theorem 4), +1 bei Augmentierung (Korollar 5) oder Regularitaets-
    // Bump (Oktaeder-artige Ausnahmen). Minimum 2 (orthogonales Modell).
    int strict_allowed = std::max(2, (result.stats.delta_orig + 1) / 2
                                     + ((result.stats.augmented ||
                                         result.stats.regular_bumped) ? 1 : 0));
    if ((int)slopes_used.size() > strict_allowed) {
        snprintf(buf, sizeof buf,
                 "FEHLER: %d Steigungen benutzt, Papier-Schranke ist %d\n",
                 (int)slopes_used.size(), strict_allowed);
        report += buf; ok = false;
    }
    if (!all_have_vertical && G.number_of_edges() > 0) {
        report += "FEHLER: Kante ohne vertikales Segment (Modellverletzung)\n"; ok = false;
    }

    // --- Planaritaet: paarweise Segmenttests ---
    long long crossings = 0;
    for (size_t a = 0; a < segs.size() && crossings < 20; a++) {
        for (size_t b = a + 1; b < segs.size() && crossings < 20; b++) {
            Pt touch{0, 0};
            int r = seg_intersect(segs[a], segs[b], &touch);
            if (r == 0) continue;
            if (segs[a].edge_id == segs[b].edge_id) {
                // Segmente derselben Kante: Beruehrung nur am gemeinsamen Knick
                if (r == 2) {
                    report += "FEHLER: Kante ueberlappt/kreuzt sich selbst\n";
                    ok = false; crossings++;
                }
                continue;
            }
            if (r == 2) {
                snprintf(buf, sizeof buf,
                         "FEHLER: Kreuzung/Ueberlappung bei Segmentpaar (Kanten %d/%d)\n",
                         segs[a].edge_id, segs[b].edge_id);
                report += buf; ok = false; crossings++;
                continue;
            }
            // Beruehrung in einem Punkt: nur an einem gemeinsamen Endknoten erlaubt
            bool at_common_node = false;
            node cand[4] = { seg_nodes[a].first, seg_nodes[a].second,
                             seg_nodes[b].first, seg_nodes[b].second };
            for (int x = 0; x < 2 && !at_common_node; x++)
                for (int y = 2; y < 4 && !at_common_node; y++)
                    if (cand[x] == cand[y]) {
                        point p = result.pos[cand[x]];
                        if (touch.x == ll_of(p.xcoord()) && touch.y == ll_of(p.ycoord()))
                            at_common_node = true;
                    }
            if (!at_common_node) {
                snprintf(buf, sizeof buf,
                         "FEHLER: Beruehrung ausserhalb gemeinsamer Knoten bei (%lld,%lld)\n",
                         (ll)touch.x, (ll)touch.y);
                report += buf; ok = false; crossings++;
            }
        }
    }

    // --- Knoten duerfen nicht im Inneren fremder Kanten liegen ---
    forall_nodes(v, G) {
        point p = result.pos[v];
        Pt q{ ll_of(p.xcoord()), ll_of(p.ycoord()) };
        for (size_t a = 0; a < segs.size(); a++) {
            if (seg_nodes[a].first == v || seg_nodes[a].second == v) continue;
            if (on_segment(q, segs[a])) {
                report += "FEHLER: Knoten liegt auf fremder Kante\n"; ok = false; break;
            }
        }
    }

    // --- Flaechenschranken ---
    ll min_x = 0, max_x = 0, min_y = 0, max_y = 0;
    bool first = true;
    for (size_t a = 0; a < segs.size(); a++) {
        for (int t = 0; t < 2; t++) {
            Pt p = t ? segs[a].b : segs[a].a;
            if (first) { min_x = max_x = p.x; min_y = max_y = p.y; first = false; }
            min_x = std::min(min_x, p.x); max_x = std::max(max_x, p.x);
            min_y = std::min(min_y, p.y); max_y = std::max(max_y, p.y);
        }
    }
    forall_nodes(v, G) {
        point p = result.pos[v];
        Pt q{ ll_of(p.xcoord()), ll_of(p.ycoord()) };
        if (first) { min_x = max_x = q.x; min_y = max_y = q.y; first = false; }
        min_x = std::min(min_x, q.x); max_x = std::max(max_x, q.x);
        min_y = std::min(min_y, q.y); max_y = std::max(max_y, q.y);
    }
    result.stats.width = max_x - min_x;
    result.stats.height = max_y - min_y;

    const ll span = std::max(1, 2 * result.stats.m - result.stats.n);
    if (result.stats.width > span) {
        snprintf(buf, sizeof buf, "FEHLER: Breite %lld > 2m-n = %lld\n",
                 result.stats.width, span);
        report += buf; ok = false;
    }
    ll height_bound = (ll)(result.stats.n - 1) * result.stats.row_spacing
                      + 2 * result.stats.bottom_drop;
    if (result.stats.n >= 2 && result.stats.height > height_bound) {
        snprintf(buf, sizeof buf, "FEHLER: Hoehe %lld > Schranke %lld\n",
                 result.stats.height, height_bound);
        report += buf; ok = false;
    }

    snprintf(buf, sizeof buf,
             "n=%d m=%d Delta=%d Delta_eff=%d | Steigungen: %d/%d | Gitter: %lld x %lld%s%s\n",
             result.stats.n, result.stats.m, result.stats.delta_orig, result.stats.delta_eff,
             result.stats.slopes_used, result.stats.slopes_allowed,
             result.stats.width, result.stats.height,
             result.stats.augmented ? " | augmentiert" : "",
             result.stats.regular_bumped ? " | Regularitaets-Bump" : "");
    report = std::string(buf) + report;
    report += ok ? "VERIFIKATION: PASS" : "VERIFIKATION: FAIL";
    return ok;
}
