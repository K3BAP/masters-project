#include "graph_families.h"

#include <LEDA/graph/graph_gen.h>
#include <LEDA/graph/graph_misc.h>

#include <algorithm>
#include <set>
#include <utility>
#include <vector>

using namespace leda;

unsigned gf_mix(unsigned a, unsigned b, unsigned c, unsigned d) {
    unsigned long long x = 0x9e3779b97f4a7c15ULL;
    const unsigned in[4] = { a, b, c, d };
    for (int i = 0; i < 4; i++) {
        x ^= in[i] + 0x9e3779b9ULL + (x << 6) + (x >> 2);
        x *= 0xbf58476d1ce4e5b9ULL;
        x ^= x >> 31;
    }
    unsigned r = (unsigned)(x & 0x7fffffffULL);
    return r ? r : 1u;          // 0 bedeutet bei den Tests "kein Seed"
}

void gf_sanitize(graph& G) {
    Delete_Loops(G);
    Make_Simple(G);
    std::set<std::pair<int, int> > seen;
    std::vector<edge> to_delete;
    edge e;
    forall_edges(e, G) {
        int a = G.index(G.source(e)), b = G.index(G.target(e));
        std::pair<int, int> key(std::min(a, b), std::max(a, b));
        if (seen.count(key)) to_delete.push_back(e);
        else seen.insert(key);
    }
    for (size_t i = 0; i < to_delete.size(); i++) G.del_edge(to_delete[i]);
}

void gf_k4(graph& G) {
    G.clear();
    node v[4];
    for (int i = 0; i < 4; i++) v[i] = G.new_node();
    for (int i = 0; i < 4; i++)
        for (int j = i + 1; j < 4; j++) G.new_edge(v[i], v[j]);
}

void gf_octahedron(graph& G) {
    G.clear();
    node v[6];
    for (int i = 0; i < 6; i++) v[i] = G.new_node();
    for (int i = 0; i < 6; i++)
        for (int j = i + 1; j < 6; j++) {
            if (i / 2 == j / 2) continue;
            G.new_edge(v[i], v[j]);
        }
}

void gf_icosahedron(graph& G) {
    G.clear();
    node top = G.new_node(), bot = G.new_node();
    node u[5], l[5];
    for (int i = 0; i < 5; i++) u[i] = G.new_node();
    for (int i = 0; i < 5; i++) l[i] = G.new_node();
    for (int i = 0; i < 5; i++) {
        G.new_edge(top, u[i]);
        G.new_edge(bot, l[i]);
        G.new_edge(u[i], u[(i + 1) % 5]);
        G.new_edge(l[i], l[(i + 1) % 5]);
        G.new_edge(u[i], l[i]);
        G.new_edge(l[i], u[(i + 1) % 5]);
    }
}

// Gemeinsame Basis: zwei m-Kreise plus Sprossen; anti ergaenzt die
// Diagonalen und hebt den Grad damit von 3 auf 4.
static void prism_impl(graph& G, int m, bool anti) {
    G.clear();
    std::vector<node> a(m), b(m);
    for (int i = 0; i < m; i++) a[i] = G.new_node();
    for (int i = 0; i < m; i++) b[i] = G.new_node();
    for (int i = 0; i < m; i++) {
        G.new_edge(a[i], a[(i + 1) % m]);
        G.new_edge(b[i], b[(i + 1) % m]);
        G.new_edge(a[i], b[i]);
        if (anti) G.new_edge(b[i], a[(i + 1) % m]);
    }
}

void gf_prism(graph& G, int m)     { prism_impl(G, m, false); }
void gf_antiprism(graph& G, int m) { prism_impl(G, m, true); }

void gf_wheel(graph& G, int m) {
    G.clear();
    std::vector<node> rim(m);
    for (int i = 0; i < m; i++) rim[i] = G.new_node();
    for (int i = 0; i < m; i++) G.new_edge(rim[i], rim[(i + 1) % m]);
    node hub = G.new_node();
    for (int i = 0; i < m; i++) G.new_edge(hub, rim[i]);
}

// Zwei Naben auf beiden Seiten desselben Kreises: Delta = m bei n = m+2,
// im Unterschied zum Rad 3-zusammenhaengend auch fuer grosse m.
void gf_double_wheel(graph& G, int m) {
    G.clear();
    std::vector<node> rim(m);
    for (int i = 0; i < m; i++) rim[i] = G.new_node();
    for (int i = 0; i < m; i++) G.new_edge(rim[i], rim[(i + 1) % m]);
    for (int h = 0; h < 2; h++) {
        node hub = G.new_node();
        for (int i = 0; i < m; i++) G.new_edge(hub, rim[i]);
    }
}

void gf_path(graph& G, int m) {
    G.clear();
    node prev = G.new_node();
    for (int i = 1; i < m; i++) { node w = G.new_node(); G.new_edge(prev, w); prev = w; }
}

void gf_star(graph& G, int m) {
    G.clear();
    node hub = G.new_node();
    for (int i = 0; i < m; i++) G.new_edge(hub, G.new_node());
}

void gf_spider(graph& G, int legs, int len) {
    G.clear();
    node c = G.new_node();
    for (int i = 0; i < legs; i++) {
        node prev = c;
        for (int j = 0; j < len; j++) {
            node w = G.new_node();
            G.new_edge(prev, w);
            prev = w;
        }
    }
}

void gf_grid(graph& G, int w, int h) {
    G.clear();
    std::vector<node> nd(w * h);
    for (int i = 0; i < w * h; i++) nd[i] = G.new_node();
    for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++) {
            if (x + 1 < w) G.new_edge(nd[y * w + x], nd[y * w + x + 1]);
            if (y + 1 < h) G.new_edge(nd[y * w + x], nd[(y + 1) * w + x]);
        }
}

// splitmix64: klein, reproduzierbar, unabhaengig von der Umgebung
static unsigned long long sm64(unsigned long long& x) {
    x += 0x9e3779b97f4a7c15ULL;
    unsigned long long z = x;
    z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
    z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
    return z ^ (z >> 31);
}

void gf_random_planar(graph& G, int n, int m, unsigned seed) {
    rand_int.set_seed((int)seed);
    maximal_planar_graph(G, n);
    gf_sanitize(G);
    if (G.number_of_edges() <= m) return;

    unsigned long long st = seed * 0x2545f4914f6cdd1dULL + 12345ULL;

    // Kanten in zufaelliger, aber seedabhaengiger Reihenfolge
    std::vector<edge> es;
    edge e;
    forall_edges(e, G) es.push_back(e);
    for (size_t i = es.size(); i > 1; i--) {
        size_t j = (size_t)(sm64(st) % i);
        std::swap(es[i - 1], es[j]);
    }

    // Spannbaum schuetzen, den Rest der Reihe nach entfernen
    std::vector<int> parent(G.max_node_index() + 1);
    for (size_t i = 0; i < parent.size(); i++) parent[i] = (int)i;
    struct UF {
        static int find(std::vector<int>& p, int x) {
            while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; }
            return x;
        }
    };
    std::vector<edge> entbehrlich;
    for (size_t i = 0; i < es.size(); i++) {
        int a = UF::find(parent, G.index(G.source(es[i])));
        int b = UF::find(parent, G.index(G.target(es[i])));
        if (a != b) parent[a] = b;
        else entbehrlich.push_back(es[i]);
    }
    for (size_t i = 0; i < entbehrlich.size() && G.number_of_edges() > m; i++)
        G.del_edge(entbehrlich[i]);
}
