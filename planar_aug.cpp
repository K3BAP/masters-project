// =====================================================================
// Gradbeschraenkte planare Augmentierung ueber Flaechen-Chorden.
// Siehe planar_aug.h; C++-Gegenstueck zu webapp/src/algorithm/augment.ts
// (Bikonnektivierung) plus Trikonnektivierung fuer Korollar 2.
// =====================================================================

#include "planar_aug.h"

#include <LEDA/graph/graph_alg.h>
#include <LEDA/graph/graph_misc.h>

#include <vector>
#include <set>
#include <utility>
#include <algorithm>
#include <climits>

using namespace leda;

namespace {

// Flaechenzyklen des planaren Maps als Knotenfolgen (Quelle jedes Darts).
// Vorbedingung: alle Kanten haben Reversal-Info (Map nach PLANAR(G,true)).
std::vector<std::vector<node> > collect_faces(const graph& G) {
    std::vector<std::vector<node> > faces;
    edge_array<bool> visited(G, false);
    edge e;
    forall_edges(e, G) {
        if (visited[e]) continue;
        std::vector<node> f;
        edge cur = e;
        do {
            visited[cur] = true;
            f.push_back(G.source(cur));
            cur = G.face_cycle_succ(cur);
        } while (cur != e);
        faces.push_back(f);
    }
    return faces;
}

std::set<std::pair<int, int> > adjacency_set(const graph& G) {
    std::set<std::pair<int, int> > adj;
    edge e;
    forall_edges(e, G) {
        int a = G.index(G.source(e)), b = G.index(G.target(e));
        adj.insert(std::make_pair(std::min(a, b), std::max(a, b)));
    }
    return adj;
}

// Greedy-Auswahl: minimales max(deg), dann minimale Gradsumme.
struct ChordPick {
    node u, w;
    int mx, sm;
    ChordPick() : u(nil), w(nil), mx(INT_MAX), sm(INT_MAX) {}
    void consider(const graph& G, node a, node b) {
        int da = G.outdeg(a), db = G.outdeg(b);
        int m = std::max(da, db), s = da + db;
        if (m < mx || (m == mx && s < sm)) { u = a; w = b; mx = m; sm = s; }
    }
};

bool shares_block(const std::set<int>& a, const std::set<int>& b) {
    for (std::set<int>::const_iterator it = a.begin(); it != a.end(); ++it)
        if (b.count(*it)) return true;
    return false;
}

} // namespace

edge aug_add_undirected(graph& G, node a, node b, list<edge>& fwd, list<edge>& rev) {
    edge e = G.new_edge(a, b);
    edge r = G.new_edge(b, a);
    G.set_reversal(e, r);
    G.set_reversal(r, e);
    fwd.append(e);
    rev.append(r);
    return e;
}

void augment_connected_bounded(graph& G, list<edge>& fwd, list<edge>& rev) {
    node_array<int> comp(G);
    int nc = COMPONENTS(G, comp);
    if (nc <= 1) return;
    std::vector<node> entry(nc, (node)nil), exit_(nc, (node)nil);
    node v;
    forall_nodes(v, G) {
        int ci = comp[v];
        if (entry[ci] == nil || G.outdeg(v) < G.outdeg(entry[ci])) {
            exit_[ci] = entry[ci];
            entry[ci] = v;
        } else if (exit_[ci] == nil || G.outdeg(v) < G.outdeg(exit_[ci])) {
            exit_[ci] = v;
        }
    }
    for (int i = 0; i < nc; i++)
        if (exit_[i] == nil) exit_[i] = entry[i];   // einelementige Komponente
    for (int i = 0; i + 1 < nc; i++)
        aug_add_undirected(G, exit_[i], entry[i + 1], fwd, rev);
}

bool augment_biconnected_bounded(graph& G, list<edge>& fwd, list<edge>& rev,
                                 std::string& error) {
    if (G.number_of_nodes() < 3) return true;
    int rounds = 0;
    const int max_rounds = G.number_of_nodes() + G.number_of_edges() + 8;
    while (!Is_Biconnected(G)) {
        if (++rounds > max_rounds) {
            error = "Biconnect-Augmentierung konvergiert nicht.";
            return false;
        }
        if (!PLANAR(G, true)) {
            error = "Graph waehrend Augmentierung nicht planar (intern).";
            return false;
        }
        edge_array<int> bcomp(G);
        BICONNECTED_COMPONENTS(G, bcomp);

        // Block-Mengen pro Knoten (Blocks = Kantenklassen)
        node_array<std::set<int> > blocks(G);
        edge e;
        forall_edges(e, G) {
            blocks[G.source(e)].insert(bcomp[e]);
            blocks[G.target(e)].insert(bcomp[e]);
        }
        std::set<std::pair<int, int> > adjacent = adjacency_set(G);

        ChordPick best;
        std::vector<std::vector<node> > faces = collect_faces(G);
        for (size_t fi = 0; fi < faces.size(); fi++) {
            const std::vector<node>& f = faces[fi];
            for (size_t a = 0; a < f.size(); a++)
                for (size_t b = a + 1; b < f.size(); b++) {
                    node u = f[a], w = f[b];
                    if (u == w) continue;
                    int iu = G.index(u), iw = G.index(w);
                    if (adjacent.count(std::make_pair(std::min(iu, iw),
                                                      std::max(iu, iw)))) continue;
                    if (shares_block(blocks[u], blocks[w])) continue;
                    best.consider(G, u, w);
                }
        }
        if (best.u == nil) {
            error = "Keine Flaechen-Chorde gefunden (intern).";
            return false;
        }
        aug_add_undirected(G, best.u, best.w, fwd, rev);
    }
    return true;
}

bool augment_triconnected_bounded(graph& G, list<edge>& fwd, list<edge>& rev,
                                  std::string& error) {
    const int n = G.number_of_nodes();
    node v, w;

    // n <= 3: zu K_n vervollstaendigen (Trikonnektivitaet ist erst ab n >= 4
    // gehaltvoll; LEDA meldet n <= 3 ohnehin als trikonnektiert).
    if (n <= 3) {
        std::set<std::pair<int, int> > adjacent = adjacency_set(G);
        forall_nodes(v, G)
            forall_nodes(w, G) {
                if (G.index(v) >= G.index(w)) continue;
                if (adjacent.count(std::make_pair(G.index(v), G.index(w)))) continue;
                aug_add_undirected(G, v, w, fwd, rev);
            }
        return true;
    }

    int rounds = 0;
    const int max_rounds = n * n + 16;   // jede Chorde reduziert die
                                         // Komponentenzahl eines Paares strikt
    node s1, s2;
    while (!Is_Triconnected(G, s1, s2)) {
        if (++rounds > max_rounds) {
            error = "Triconnect-Augmentierung konvergiert nicht.";
            return false;
        }
        if (s1 == nil || s2 == nil || s1 == s2) {
            error = "Triconnect-Augmentierung setzt Bikonnektivitaet voraus (intern).";
            return false;
        }
        if (!PLANAR(G, true)) {
            error = "Graph waehrend Augmentierung nicht planar (intern).";
            return false;
        }

        // Komponenten von G - {s1,s2} per BFS
        node_array<int> comp(G, -1);
        int nc = 0;
        forall_nodes(v, G) {
            if (v == s1 || v == s2 || comp[v] >= 0) continue;
            std::vector<node> queue;
            queue.push_back(v);
            comp[v] = nc;
            for (size_t qi = 0; qi < queue.size(); qi++) {
                edge e;
                forall_adj_edges(e, queue[qi]) {
                    node x = G.opposite(queue[qi], e);
                    if (x == s1 || x == s2 || comp[x] >= 0) continue;
                    comp[x] = nc;
                    queue.push_back(x);
                }
            }
            nc++;
        }
        if (nc < 2) {
            error = "Separationspaar ohne zwei Komponenten (intern).";
            return false;
        }

        // Chorde zwischen verschiedenen Komponenten auf gemeinsamer Flaeche;
        // s1/s2 nie als Endpunkte (ihr Grad soll nicht wachsen).
        ChordPick best;
        std::vector<std::vector<node> > faces = collect_faces(G);
        for (size_t fi = 0; fi < faces.size(); fi++) {
            const std::vector<node>& f = faces[fi];
            for (size_t a = 0; a < f.size(); a++)
                for (size_t b = a + 1; b < f.size(); b++) {
                    node u = f[a], x = f[b];
                    if (u == x || u == s1 || u == s2 || x == s1 || x == s2) continue;
                    if (comp[u] == comp[x]) continue;   // impliziert: nicht benachbart
                    best.consider(G, u, x);
                }
        }
        if (best.u == nil) {
            error = "Keine Triconnect-Chorde gefunden (intern).";
            return false;
        }
        aug_add_undirected(G, best.u, best.w, fwd, rev);
    }
    return true;
}
