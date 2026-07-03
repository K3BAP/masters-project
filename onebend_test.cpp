// =====================================================================
// Headless-Stresstest fuer den 1-Bend-Algorithmus (Theorem 1 / Kor. 2)
//
// Erzeugt viele planare Graphen (direkt 3-zusammenhaengende Familien,
// beliebige planare mit Korollar-2-Augmentierung, Zufall), laesst den
// Algorithmus laufen und prueft die Papier-Spezifikationen mit dem
// geometrischen Verifier. Zusaetzlich validiert der Ordnungs-Checker
// jede kanonische Ordnung (in compute integriert) und ein Mutationstest
// stellt sicher, dass der Verifier Fehler tatsaechlich erkennt.
//
//   ./onebend_test [-v] [-s seed] [-n maxsize] [-m] [datei.gw ...]
//     -v: auch PASS-Zeilen ausgeben
//     -s: Seed fuer die Zufallsgraphen
//     -n: zusaetzliche grosse Zufallsfaelle bis n=maxsize
//     -m: Mutationstest des Verifiers
// =====================================================================

#include "onebend_core.h"

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
static bool g_mutate = false;
static int g_dump_counter = 0;
static int g_mut_run = 0, g_mut_caught = 0;

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

// Mutationstest: eine zufaellige Stoerung der fertigen Zeichnung muss
// vom Verifier erkannt werden (Knick verschieben oder Knoten anheben).
static void mutate_and_check(graph& G, OneBendResult& res, const std::string& name) {
    edge e;
    node v;
    std::vector<edge> bent;
    forall_edges(e, G) if (!res.bends[e].empty()) bent.push_back(e);

    for (int variant = 0; variant < 2; variant++) {
        OneBendResult mut = res;
        mut.pos.init(G, point(0, 0));
        mut.bends.init(G);
        mut.color.init(G, 0);
        mut.part.init(G, 0);
        forall_nodes(v, G) { mut.pos[v] = res.pos[v]; mut.part[v] = res.part[v]; }
        forall_edges(e, G) { mut.bends[e] = res.bends[e]; mut.color[e] = res.color[e]; }

        bool changed = false;
        if (variant == 0 && !bent.empty()) {
            edge b = bent[rand_int(0, (int)bent.size() - 1)];
            point p = mut.bends[b].head();
            mut.bends[b].clear();
            mut.bends[b].append(point(p.xcoord() + 1, p.ycoord()));
            changed = true;
        } else if (variant == 1 && G.number_of_nodes() > 0) {
            node w = G.first_node();
            int skip = rand_int(0, G.number_of_nodes() - 1);
            forall_nodes(v, G) { if (skip == 0) { w = v; break; } skip--; }
            mut.pos[w] = point(mut.pos[w].xcoord(), mut.pos[w].ycoord() + 1);
            changed = true;
        }
        if (!changed) continue;
        g_mut_run++;
        std::string mreport;
        if (!verify_onebend_drawing(G, mut, mreport)) g_mut_caught++;
        else cout << "[MUT-MISS] " << name << " Variante " << variant << endl;
    }
}

static void run_case(graph& G, const std::string& name) {
    g_run++;
    sanitize(G);

    OneBendResult res;
    if (!compute_onebend_drawing(G, res, false)) {
        g_failed++;
        cout << "[FAIL] " << name << " | Berechnung: " << res.error << endl;
        return;
    }
    std::string report;
    bool ok = verify_onebend_drawing(G, res, report);
    if (!ok) {
        g_failed++;
        cout << "[FAIL] " << name << "\n" << report << endl;
        char fname[128];
        snprintf(fname, sizeof fname, "onebend_fail_%03d.gw", g_dump_counter++);
        G.write(fname);
        cout << "       Graph gespeichert: " << fname << endl;
        return;
    }
    if (g_verbose)
        cout << "[PASS] " << name << " | "
             << report.substr(0, report.find('\n')) << endl;
    if (g_mutate && G.number_of_nodes() >= 4) mutate_and_check(G, res, name);
}

// ---------------------------------------------------------------------
// Feste Testgraphen
// ---------------------------------------------------------------------
static void build_k4(graph& G) {
    G.clear();
    node v[4];
    for (int i = 0; i < 4; i++) v[i] = G.new_node();
    for (int i = 0; i < 4; i++)
        for (int j = i + 1; j < 4; j++) G.new_edge(v[i], v[j]);
}

static void build_octahedron(graph& G) {
    G.clear();
    node v[6];
    for (int i = 0; i < 6; i++) v[i] = G.new_node();
    for (int i = 0; i < 6; i++)
        for (int j = i + 1; j < 6; j++) {
            if (i / 2 == j / 2) continue;
            G.new_edge(v[i], v[j]);
        }
}

// Ikosaeder: 5-regulaer -- erzwingt den Sonderfall deg(vn) = Delta.
static void build_icosahedron(graph& G) {
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

static void build_prism(graph& G, int kk, bool anti) {
    G.clear();
    std::vector<node> a(kk), b(kk);
    for (int i = 0; i < kk; i++) a[i] = G.new_node();
    for (int i = 0; i < kk; i++) b[i] = G.new_node();
    for (int i = 0; i < kk; i++) {
        G.new_edge(a[i], a[(i + 1) % kk]);
        G.new_edge(b[i], b[(i + 1) % kk]);
        G.new_edge(a[i], b[i]);
        if (anti) G.new_edge(b[i], a[(i + 1) % kk]);
    }
}

static void build_wheel(graph& G, int kk) {
    G.clear();
    std::vector<node> rim(kk);
    for (int i = 0; i < kk; i++) rim[i] = G.new_node();
    for (int i = 0; i < kk; i++) G.new_edge(rim[i], rim[(i + 1) % kk]);
    node hub = G.new_node();
    for (int i = 0; i < kk; i++) G.new_edge(hub, rim[i]);
}

static void build_path(graph& G, int kk) {
    G.clear();
    node prev = G.new_node();
    for (int i = 1; i < kk; i++) { node w = G.new_node(); G.new_edge(prev, w); prev = w; }
}

static void build_star(graph& G, int kk) {
    G.clear();
    node hub = G.new_node();
    for (int i = 0; i < kk; i++) G.new_edge(hub, G.new_node());
}

static void build_spider(graph& G, int legs, int len) {
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
        else if (a == "-m") g_mutate = true;
        else if (a == "-s" && i + 1 < argc) seed = atoi(argv[++i]);
        else if (a == "-n" && i + 1 < argc) max_extra = atoi(argv[++i]);
        else files.push_back(a);
    }
    if (seed != 0) rand_int.set_seed(seed);

    graph G;
    char name[128];

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

    // --- 3-zusammenhaengende Spezialfaelle ---
    build_k4(G);              run_case(G, "K4");
    build_octahedron(G);      run_case(G, "Oktaeder (4-regulaer)");
    build_icosahedron(G);     run_case(G, "Ikosaeder (5-regulaer, Sonderfall vn)");
    for (int kk = 3; kk <= 9; kk++) {
        build_prism(G, kk, false);
        snprintf(name, sizeof name, "Prisma k=%d", kk);
        run_case(G, name);
        build_prism(G, kk, true);
        snprintf(name, sizeof name, "Antiprisma k=%d", kk);
        run_case(G, name);
        build_wheel(G, kk + 2);
        snprintf(name, sizeof name, "Rad k=%d", kk + 2);
        run_case(G, name);
    }

    // --- Korollar-2-Pfad: nicht 3-zusammenhaengende Eingaben ---
    build_path(G, 2);  run_case(G, "Pfad n=2");
    build_path(G, 3);  run_case(G, "Pfad n=3");
    build_path(G, 10); run_case(G, "Pfad n=10");
    for (int kk = 3; kk <= 14; kk++) {
        build_star(G, kk);
        snprintf(name, sizeof name, "Stern k=%d", kk);
        run_case(G, name);
    }
    for (int legs = 3; legs <= 10; legs++)
        for (int len = 2; len <= 3; len++) {
            build_spider(G, legs, len);
            snprintf(name, sizeof name, "Spinne legs=%d len=%d", legs, len);
            run_case(G, name);
        }
    build_grid(G, 4, 4); run_case(G, "Gitter 4x4");
    build_grid(G, 6, 3); run_case(G, "Gitter 6x3");

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
                int mm = std::max(1, densities[di]);
                random_planar_graph(G, n, mm);
                snprintf(name, sizeof name, "random_planar n=%d m=%d #%d", n, mm, r);
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
    if (g_mutate)
        cout << "Mutationen: " << g_mut_run << "  erkannt: " << g_mut_caught << endl;
    return g_failed == 0 ? 0 : 1;
}
