// =====================================================================
// Headless-Stresstest fuer den Slope-Algorithmus (Theorem 4 / Korollar 5)
//
// Erzeugt viele planare Graphen (Zufall + Spezialfaelle), laesst den
// Algorithmus laufen und prueft die Papier-Spezifikationen mit dem
// geometrischen Verifier. Kein X11 noetig.
//
//   ./slopes_test [-v] [-s seed] [-n maxsize]
//     -v: auch PASS-Zeilen ausgeben
//     -s: Seed fuer die Zufallsgraphen (Default 0 = LEDA-Standard)
//     -n: zusaetzliche grosse Zufallsfaelle bis n=maxsize
// =====================================================================

#include "slopes_core.h"

#include <LEDA/graph/graph_gen.h>
#include <LEDA/graph/graph_misc.h>

#include <iostream>
#include <string>
#include <vector>
#include <set>
#include <cstdio>

using namespace leda;
using std::cout;
using std::endl;

static int g_run = 0, g_failed = 0;
static bool g_verbose = false;
static int g_dump_counter = 0;

// Schleifen, Mehrfach- und antiparallele Kanten entfernen
static void sanitize(graph& G) {
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

static void run_case(graph& G, const std::string& name) {
    g_run++;
    sanitize(G);

    SlopesResult res;
    if (!compute_slopes_drawing(G, res, 0, false)) {
        g_failed++;
        cout << "[FAIL] " << name << " | Berechnung: " << res.error << endl;
        return;
    }
    std::string report;
    bool ok = verify_slopes_drawing(G, res, report);
    if (!ok) {
        g_failed++;
        cout << "[FAIL] " << name << "\n" << report << endl;
        char fname[128];
        snprintf(fname, sizeof fname, "slopes_fail_%03d.gw", g_dump_counter++);
        G.write(fname);
        cout << "       Graph gespeichert: " << fname << endl;
    } else if (g_verbose) {
        cout << "[PASS] " << name << " | "
             << report.substr(0, report.find('\n')) << endl;
    }
}

// ---------------------------------------------------------------------
// Feste Testgraphen
// ---------------------------------------------------------------------
static void build_octahedron(graph& G) {
    G.clear();
    node v[6];
    for (int i = 0; i < 6; i++) v[i] = G.new_node();
    // K_2,2,2: alle Paare ausser (0,1),(2,3),(4,5)
    for (int i = 0; i < 6; i++)
        for (int j = i + 1; j < 6; j++) {
            if ((i / 2 == j / 2)) continue;
            G.new_edge(v[i], v[j]);
        }
}

static void build_wheel(graph& G, int k, int hubs) {
    G.clear();
    std::vector<node> rim(k);
    for (int i = 0; i < k; i++) rim[i] = G.new_node();
    for (int i = 0; i < k; i++) G.new_edge(rim[i], rim[(i + 1) % k]);
    for (int h = 0; h < hubs; h++) {
        node hub = G.new_node();
        for (int i = 0; i < k; i++) G.new_edge(hub, rim[i]);
        if (hubs == 2 && h == 1) break;   // zweiter Hub auf der "anderen Seite"
    }
}

static void build_path(graph& G, int k) {
    G.clear();
    node prev = G.new_node();
    for (int i = 1; i < k; i++) { node w = G.new_node(); G.new_edge(prev, w); prev = w; }
}

static void build_star(graph& G, int k) {
    G.clear();
    node hub = G.new_node();
    for (int i = 0; i < k; i++) G.new_edge(hub, G.new_node());
}

static void build_k4(graph& G) {
    G.clear();
    node v[4];
    for (int i = 0; i < 4; i++) v[i] = G.new_node();
    for (int i = 0; i < 4; i++)
        for (int j = i + 1; j < 4; j++) G.new_edge(v[i], v[j]);
}

static void build_grid(graph& G, int w, int h) {
    G.clear();
    std::vector<node> nd(w * h);
    for (int i = 0; i < w * h; i++) nd[i] = G.new_node();
    for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++) {
            if (x + 1 < w) G.new_edge(nd[y * w + x], nd[y * w + x + 1]);
            if (y + 1 < h) G.new_edge(nd[y * w + x], nd[(y + 1) * w + x]);
        }
}

int main(int argc, char** argv) {
    int seed = 0, max_extra = 0;
    std::vector<std::string> files;
    for (int i = 1; i < argc; i++) {
        std::string a(argv[i]);
        if (a == "-v") g_verbose = true;
        else if (a == "-s" && i + 1 < argc) seed = atoi(argv[++i]);
        else if (a == "-n" && i + 1 < argc) max_extra = atoi(argv[++i]);
        else files.push_back(a);
    }
    if (seed != 0) rand_int.set_seed(seed);

    graph G;
    char name[128];

    // --- explizit uebergebene Graphdateien (.gw / LEDA-Format) ---
    if (!files.empty()) {
        g_verbose = true;
        for (size_t i = 0; i < files.size(); i++) {
            G.clear();
            if (G.read(files[i].c_str()) != 0 || G.number_of_nodes() == 0) {
                cout << "[SKIP] " << files[i] << " (nicht lesbar)" << endl;
                continue;
            }
            run_case(G, files[i]);
        }
        cout << "Tests: " << g_run << "  Fehlgeschlagen: " << g_failed << endl;
        return g_failed == 0 ? 0 : 1;
    }

    // --- Spezialfaelle ---
    build_k4(G);                 run_case(G, "K4");
    build_octahedron(G);         run_case(G, "Oktaeder (4-regulaer)");
    build_path(G, 2);            run_case(G, "Pfad n=2");
    build_path(G, 3);            run_case(G, "Pfad n=3");
    build_path(G, 10);           run_case(G, "Pfad n=10");
    for (int k = 3; k <= 14; k++) {
        build_star(G, k);
        snprintf(name, sizeof name, "Stern k=%d", k);
        run_case(G, name);
    }
    for (int k = 4; k <= 16; k += 2) {
        build_wheel(G, k, 1);
        snprintf(name, sizeof name, "Rad k=%d", k);
        run_case(G, name);
        build_wheel(G, k, 2);
        snprintf(name, sizeof name, "Doppelrad k=%d", k);
        run_case(G, name);
    }
    build_grid(G, 4, 4);         run_case(G, "Gitter 4x4");
    build_grid(G, 6, 3);         run_case(G, "Gitter 6x3");

    // --- Zufallsgraphen ---
    const int sizes[] = { 4, 6, 8, 12, 16, 24, 32, 48 };
    const int reps = 5;
    for (size_t si = 0; si < sizeof(sizes) / sizeof(int); si++) {
        int n = sizes[si];
        for (int r = 0; r < reps; r++) {
            maximal_planar_graph(G, n);
            snprintf(name, sizeof name, "maximal_planar n=%d #%d", n, r);
            run_case(G, name);

            triangulated_planar_graph(G, n);
            snprintf(name, sizeof name, "triangulated n=%d #%d", n, r);
            run_case(G, name);

            const int densities[] = { n, 3 * n / 2, 2 * n, 3 * n - 6 };
            for (int di = 0; di < 4; di++) {
                int m = std::max(1, densities[di]);
                random_planar_graph(G, n, m);
                snprintf(name, sizeof name, "random_planar n=%d m=%d #%d", n, m, r);
                run_case(G, name);
            }
        }
    }

    // --- optionale grosse Faelle ---
    for (int n = 64; n <= max_extra; n *= 2) {
        maximal_planar_graph(G, n);
        snprintf(name, sizeof name, "maximal_planar n=%d (gross)", n);
        run_case(G, name);
        random_planar_graph(G, n, 2 * n);
        snprintf(name, sizeof name, "random_planar n=%d m=%d (gross)", n, 2 * n);
        run_case(G, name);
    }

    cout << "=============================================" << endl;
    cout << "Tests: " << g_run << "  Fehlgeschlagen: " << g_failed << endl;
    return g_failed == 0 ? 0 : 1;
}
