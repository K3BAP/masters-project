// =====================================================================
// Systematische Vermessung der beiden Verfahren aus Bekos, Katsanou,
// Kindermann, Pavlidi: "How Many Slopes Does Polynomial Area Cost?"
//
// Erzeugt Instanzen aus mehreren Familien, laesst Theorem 4 bzw.
// Theorem 1 darauf laufen, verifiziert jede Zeichnung und schreibt die
// Kennzahlen als CSV. Gemessen werden ausschliesslich Groessen, die die
// Verifier ohnehin berechnen; dieses Programm faellt kein Urteil ueber
// Korrektheit, es liest aus.
//
// Flaechen und Verhaeltnisse werden bewusst NICHT hier berechnet: Die
// Schranken von Theorem 1 erreichen bei grossen n den Bereich, in dem
// ein Produkt aus zwei long long ueberlaufen kann. Die CSV enthaelt nur
// Breiten und Hoehen; auswerten.py rechnet in beliebiger Genauigkeit.
//
//   ./measure [--thm4] [--thm1] [--ksweep] [--kwahl] [--seeds R]
//             [--max-n-thm4 N] [--max-n-thm1 N] [--out datei.csv]
//   ./measure --selbsttest
//
// Ohne Auswahl laufen alle Teile. --selbsttest prueft
// das Werkzeug gegen vier unabhaengig feststehende Werte.
// =====================================================================

#include "slopes_core.h"
#include "onebend_core.h"
#include "graph_families.h"

#include <LEDA/graph/graph_gen.h>
#include <LEDA/graph/graph_misc.h>
#include <LEDA/core/random_source.h>

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <map>
#include <string>
#include <vector>

using namespace leda;
typedef long long ll;

static std::ostream* g_out = &std::cout;
static std::ofstream g_file;
static int g_rows = 0, g_unverified = 0;

// ---------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------
static const char* CSV_HEADER =
    "familie,instanz,verfahren,seed,"
    "n_in,m_in,delta_in,n,m,delta_eff,augmentiert,bump,sonderfall_vn,"
    "k,k_papier,"
    "steigungen,steigungen_schranke,steigungen_strikt,"
    "breite,breite_schranke,hoehe,hoehe_schranke,"
    "teile,verifiziert,zeit_ms,strategie\n";

struct Row {
    std::string familie, instanz, verfahren;
    int seed = -1;
    int n_in = 0, m_in = 0, delta_in = 0;
    int n = 0, m = 0, delta_eff = 0, augmentiert = 0, bump = 0, sonderfall_vn = 0;
    std::string k, k_papier;          // leer = nicht anwendbar (Theorem 4)
    int steigungen = 0, steigungen_schranke = 0, steigungen_strikt = 0;
    ll breite = 0, breite_schranke = 0, hoehe = 0, hoehe_schranke = 0;
    std::string teile;                // leer = nicht anwendbar (Theorem 4)
    int verifiziert = 0;
    double zeit_ms = 0;
    std::string strategie;            // nur im k-Wahl-Experiment belegt
};

static void emit(const Row& r) {
    char buf[1024];
    snprintf(buf, sizeof buf,
             "%s,%s,%s,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%s,%s,%d,%d,%d,"
             "%lld,%lld,%lld,%lld,%s,%d,%.3f,%s\n",
             r.familie.c_str(), r.instanz.c_str(), r.verfahren.c_str(), r.seed,
             r.n_in, r.m_in, r.delta_in, r.n, r.m, r.delta_eff,
             r.augmentiert, r.bump, r.sonderfall_vn,
             r.k.c_str(), r.k_papier.c_str(),
             r.steigungen, r.steigungen_schranke, r.steigungen_strikt,
             r.breite, r.breite_schranke, r.hoehe, r.hoehe_schranke,
             r.teile.c_str(), r.verifiziert, r.zeit_ms, r.strategie.c_str());
    (*g_out) << buf;
    g_rows++;
    if (!r.verifiziert) {
        g_unverified++;
        std::cerr << "  !! NICHT VERIFIZIERT: " << r.familie << " / "
                  << r.instanz << " / " << r.verfahren << std::endl;
    }
}

static std::string num(ll x) { char b[32]; snprintf(b, sizeof b, "%lld", x); return b; }

// Kennzahlen der Eingabe, bevor der Algorithmus augmentiert
static void input_stats(const graph& G, Row& r) {
    r.n_in = G.number_of_nodes();
    r.m_in = G.number_of_edges();
    r.delta_in = 0;
    node v;
    forall_nodes(v, G) {
        int d = G.outdeg(v) + G.indeg(v);
        r.delta_in = std::max(r.delta_in, d);
    }
}

// ---------------------------------------------------------------------
// Ein Lauf je Verfahren
// ---------------------------------------------------------------------
static void run_thm4(graph& G, const std::string& familie,
                     const std::string& instanz, int seed) {
    gf_sanitize(G);
    Row r;
    r.familie = familie; r.instanz = instanz; r.verfahren = "thm4"; r.seed = seed;
    input_stats(G, r);

    SlopesResult res;
    std::chrono::steady_clock::time_point t0 = std::chrono::steady_clock::now();
    bool computed = compute_slopes_drawing(G, res, 0, false);
    std::chrono::steady_clock::time_point t1 = std::chrono::steady_clock::now();
    r.zeit_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();

    if (!computed) {
        std::cerr << "  !! Berechnung fehlgeschlagen: " << instanz << " -- "
                  << res.error << std::endl;
        emit(r);
        return;
    }
    std::string report;
    r.verifiziert = verify_slopes_drawing(G, res, report) ? 1 : 0;
    if (!r.verifiziert) std::cerr << report << std::endl;

    const SlopesStats& s = res.stats;
    r.n = s.n; r.m = s.m; r.delta_eff = s.delta_eff;
    r.augmentiert = s.augmented ? 1 : 0;
    r.bump = s.regular_bumped ? 1 : 0;
    r.steigungen = s.slopes_used;
    r.steigungen_schranke = s.slopes_allowed;
    // wie slopes_core.cpp: ceil(Delta/2), +1 bei Augmentierung oder Bump
    r.steigungen_strikt = std::max(2, (s.delta_orig + 1) / 2
                                      + ((s.augmented || s.regular_bumped) ? 1 : 0));
    r.breite = s.width;
    r.hoehe = s.height;
    r.breite_schranke = std::max((ll)1, 2LL * s.m - s.n);
    r.hoehe_schranke = s.n >= 2 ? (ll)(s.n - 1) * s.row_spacing + 2 * s.bottom_drop : 0;
    emit(r);
}

static Row run_thm1(graph& G, const std::string& familie,
                     const std::string& instanz, int seed, ll k_override,
                     const std::string& strategie = "") {
    gf_sanitize(G);
    Row r;
    r.familie = familie; r.instanz = instanz; r.verfahren = "thm1"; r.seed = seed;
    r.strategie = strategie;
    input_stats(G, r);

    OneBendResult res;
    std::chrono::steady_clock::time_point t0 = std::chrono::steady_clock::now();
    bool computed = compute_onebend_drawing(G, res, false, k_override);
    std::chrono::steady_clock::time_point t1 = std::chrono::steady_clock::now();
    r.zeit_ms = std::chrono::duration<double, std::milli>(t1 - t0).count();

    if (!computed) {
        std::cerr << "  !! Berechnung fehlgeschlagen: " << instanz << " -- "
                  << res.error << std::endl;
        emit(r);
        return r;
    }
    std::string report;
    r.verifiziert = verify_onebend_drawing(G, res, report) ? 1 : 0;
    if (!r.verifiziert) std::cerr << report << std::endl;

    const OneBendStats& s = res.stats;
    r.n = s.n; r.m = s.m; r.delta_eff = s.delta_eff;
    r.augmentiert = s.augmented ? 1 : 0;
    r.sonderfall_vn = s.special_vn ? 1 : 0;
    r.k = num(s.k);
    r.k_papier = num(4LL * s.delta_eff * (ll)s.n * (ll)s.n);
    r.steigungen = s.slopes_used;
    r.steigungen_schranke = s.slopes_allowed;
    // wie onebend_core.cpp: 3*max(Delta,5)-8 bzw. ceil(9*Delta/2)+1
    r.steigungen_strikt = std::max(2, s.augmented ? (9 * s.delta_orig + 1) / 2 + 1
                                                  : 3 * std::max(s.delta_orig, 5) - 8);
    r.breite = s.width;
    r.hoehe = s.height;
    {
        const ll N = std::max((ll)s.n, (ll)6);
        r.breite_schranke = 12LL * s.delta_eff * N * N;
        r.hoehe_schranke = 18LL * s.delta_eff * N * N * N;
    }
    r.teile = num(s.parts);
    emit(r);
    return r;
}

// ---------------------------------------------------------------------
// Minimaler GraphML-Leser (nur Knoten- und Kantenelemente)
// ---------------------------------------------------------------------
static bool read_graphml(graph& G, const std::string& path) {
    std::ifstream in(path.c_str());
    if (!in) return false;
    G.clear();
    std::map<std::string, node> byid;
    std::vector<std::pair<std::string, std::string> > edges;
    std::string line;
    while (std::getline(in, line)) {
        size_t p = line.find("<node id=\"");
        if (p != std::string::npos) {
            size_t a = p + 10, b = line.find('"', a);
            byid[line.substr(a, b - a)] = G.new_node();
            continue;
        }
        p = line.find("<edge source=\"");
        if (p != std::string::npos) {
            size_t a = p + 14, b = line.find('"', a);
            std::string s = line.substr(a, b - a);
            size_t c = line.find("target=\"", b);
            if (c == std::string::npos) continue;
            c += 8;
            size_t d = line.find('"', c);
            edges.push_back(std::make_pair(s, line.substr(c, d - c)));
        }
    }
    for (size_t i = 0; i < edges.size(); i++) {
        if (!byid.count(edges[i].first) || !byid.count(edges[i].second)) return false;
        G.new_edge(byid[edges[i].first], byid[edges[i].second]);
    }
    return G.number_of_nodes() > 0;
}

// ---------------------------------------------------------------------
// Kampagne
// ---------------------------------------------------------------------
static void sweep_n(bool thm4, bool thm1, int max4, int max1) {
    char nm[128];
    graph G;
    // Prisma (Delta = 3) und Antiprisma (Delta = 4): n waechst, Delta bleibt.
    // Nur hier laesst sich die n-Abhaengigkeit isoliert ablesen.
    const int ns[] = { 8, 16, 32, 64, 128, 256, 512, 1024 };
    for (int i = 0; i < 8; i++) {
        int n = ns[i];
        for (int anti = 0; anti < 2; anti++) {
            const char* fam = anti ? "antiprisma" : "prisma";
            snprintf(nm, sizeof nm, "%s n=%d", fam, n);
            if (thm4 && n <= max4) {
                anti ? gf_antiprism(G, n / 2) : gf_prism(G, n / 2);
                run_thm4(G, fam, nm, -1);
            }
            if (thm1 && n <= max1) {
                anti ? gf_antiprism(G, n / 2) : gf_prism(G, n / 2);
                run_thm1(G, fam, nm, -1, 0);
            }
        }
    }
}

static void sweep_delta(bool thm4, bool thm1) {
    char nm[128];
    graph G;
    // Rad und Doppelrad: Delta = m bei n = m+1 bzw. m+2. Die einzige
    // Familie, in der Delta unabhaengig von der Dichte gross wird.
    for (int m = 4; m <= 64; m += 2) {
        for (int dbl = 0; dbl < 2; dbl++) {
            const char* fam = dbl ? "doppelrad" : "rad";
            snprintf(nm, sizeof nm, "%s m=%d", fam, m);
            if (thm4) {
                dbl ? gf_double_wheel(G, m) : gf_wheel(G, m);
                run_thm4(G, fam, nm, -1);
            }
            if (thm1) {
                dbl ? gf_double_wheel(G, m) : gf_wheel(G, m);
                run_thm1(G, fam, nm, -1, 0);
            }
        }
    }
}

static void sweep_random(bool thm4, bool thm1, int reps, int max4, int max1) {
    char nm[128];
    graph G;
    const int ns[] = { 8, 16, 32, 64, 128, 256, 512 };
    for (int i = 0; i < 7; i++) {
        int n = ns[i];
        for (int r = 0; r < reps; r++) {
            int seed = 1000 * (i + 1) + r;
            if (thm4 && n <= max4) {
                rand_int.set_seed(seed);
                maximal_planar_graph(G, n);
                snprintf(nm, sizeof nm, "maximal_planar n=%d s=%d", n, seed);
                run_thm4(G, "maximal_planar", nm, seed);
            }
            if (thm1 && n <= max1) {
                rand_int.set_seed(seed);
                maximal_planar_graph(G, n);
                snprintf(nm, sizeof nm, "maximal_planar n=%d s=%d", n, seed);
                run_thm1(G, "maximal_planar", nm, seed, 0);
            }
        }
    }
}

static void sweep_density(bool thm4, bool thm1, int reps) {
    char nm[128];
    graph G;
    // Dichtesweep bei festem n: isoliert den Einfluss von m auf die
    // Breitenschranke 2m-n von Theorem 4.
    const int ns[] = { 32, 64, 128 };
    for (int i = 0; i < 3; i++) {
        int n = ns[i];
        int ms[4] = { n, 3 * n / 2, 2 * n, 3 * n - 6 };
        for (int di = 0; di < 4; di++) {
            for (int r = 0; r < reps; r++) {
                int seed = 90000 + 1000 * i + 100 * di + r;
                int m = std::max(1, ms[di]);
                if (thm4) {
                    gf_random_planar(G, n, m, (unsigned)seed);
                    snprintf(nm, sizeof nm, "random n=%d m=%d s=%d", n, m, seed);
                    run_thm4(G, "dichte", nm, seed);
                }
                if (thm1) {
                    gf_random_planar(G, n, m, (unsigned)seed);
                    snprintf(nm, sizeof nm, "random n=%d m=%d s=%d", n, m, seed);
                    run_thm1(G, "dichte", nm, seed, 0);
                }
            }
        }
    }
}

static void sweep_sparse(bool thm4, bool thm1) {
    char nm[128];
    graph G;
    // Baeume und Gitter: hier schlaegt die Augmentierung voll durch
    // (Korollar 5 bzw. Korollar 2 statt Theorem 4 bzw. Theorem 1).
    for (int m = 4; m <= 40; m += 4) {
        snprintf(nm, sizeof nm, "stern k=%d", m);
        if (thm4) { gf_star(G, m); run_thm4(G, "stern", nm, -1); }
        if (thm1) { gf_star(G, m); run_thm1(G, "stern", nm, -1, 0); }
        snprintf(nm, sizeof nm, "pfad n=%d", m);
        if (thm4) { gf_path(G, m); run_thm4(G, "pfad", nm, -1); }
        if (thm1) { gf_path(G, m); run_thm1(G, "pfad", nm, -1, 0); }
    }
    for (int legs = 3; legs <= 12; legs += 3)
        for (int len = 2; len <= 4; len++) {
            snprintf(nm, sizeof nm, "spinne legs=%d len=%d", legs, len);
            if (thm4) { gf_spider(G, legs, len); run_thm4(G, "spinne", nm, -1); }
            if (thm1) { gf_spider(G, legs, len); run_thm1(G, "spinne", nm, -1, 0); }
        }
    for (int s = 3; s <= 12; s++) {
        snprintf(nm, sizeof nm, "gitter %dx%d", s, s);
        if (thm4) { gf_grid(G, s, s); run_thm4(G, "gitter", nm, -1); }
        if (thm1) { gf_grid(G, s, s); run_thm1(G, "gitter", nm, -1, 0); }
    }
}

static void sweep_referenz(bool thm4, bool thm1, const std::string& paper_path) {
    graph G;
    if (thm4) { gf_k4(G);          run_thm4(G, "referenz", "K4", -1); }
    if (thm1) { gf_k4(G);          run_thm1(G, "referenz", "K4", -1, 0); }
    if (thm4) { gf_octahedron(G);  run_thm4(G, "referenz", "Oktaeder", -1); }
    if (thm1) { gf_octahedron(G);  run_thm1(G, "referenz", "Oktaeder", -1, 0); }
    if (thm4) { gf_icosahedron(G); run_thm4(G, "referenz", "Ikosaeder", -1); }
    if (thm1) { gf_icosahedron(G); run_thm1(G, "referenz", "Ikosaeder", -1, 0); }
    if (thm4) { gf_wheel(G, 8);    run_thm4(G, "referenz", "Rad W8", -1); }
    if (thm1) { gf_wheel(G, 8);    run_thm1(G, "referenz", "Rad W8", -1, 0); }
    if (read_graphml(G, paper_path)) {
        if (thm4) { read_graphml(G, paper_path); run_thm4(G, "referenz", "Paper Abb. 1", -1); }
        if (thm1) { read_graphml(G, paper_path); run_thm1(G, "referenz", "Paper Abb. 1", -1, 0); }
    } else {
        std::cerr << "  (Papiergraph " << paper_path << " nicht lesbar, uebersprungen)"
                  << std::endl;
    }
}

// k-Sweep: nur Theorem 1. Fuer jede Instanz erst der Default-Lauf, um
// Deff und die Papier-Wahl zu erfahren, dann geometrisch verteilte k.
static void sweep_k(const std::string& paper_path) {
    const int POINTS = 15;
    graph G;
    for (int inst = 0; inst < 4; inst++) {
        const char* name = "";
        switch (inst) {
            case 0: gf_wheel(G, 8);     name = "Rad W8"; break;
            case 1: gf_antiprism(G, 8); name = "Antiprisma A8"; break;
            case 2: rand_int.set_seed(4242); maximal_planar_graph(G, 32);
                    name = "Triangulierung n=32 s=4242"; break;
            case 3: if (!read_graphml(G, paper_path)) {
                        std::cerr << "  (Papiergraph fuer k-Sweep nicht lesbar)" << std::endl;
                        continue;
                    }
                    name = "Paper Abb. 1"; break;
        }
        gf_sanitize(G);
        graph tmp;  // Kopie, weil compute_* den Graphen anfasst
        tmp = G;

        OneBendResult probe;
        if (!compute_onebend_drawing(tmp, probe, false, 0)) {
            std::cerr << "  (k-Sweep: " << name << " nicht zeichenbar)" << std::endl;
            continue;
        }
        const ll k_paper = probe.stats.k;
        const ll k_min = onebend_k_min(probe.stats.delta_eff);
        if (k_paper <= k_min) continue;

        std::vector<ll> ks;
        for (int i = 0; i < POINTS; i++) {
            double t = (double)i / (POINTS - 1);
            double v = (double)k_min * std::pow((double)k_paper / (double)k_min, t);
            ll k = (ll)(v + 0.5);
            if (k < k_min) k = k_min;
            if (k > k_paper) k = k_paper;
            if (ks.empty() || ks.back() != k) ks.push_back(k);
        }
        if (ks.back() != k_paper) ks.push_back(k_paper);

        char nm[160];
        for (size_t i = 0; i < ks.size(); i++) {
            graph H;
            switch (inst) {
                case 0: gf_wheel(H, 8); break;
                case 1: gf_antiprism(H, 8); break;
                case 2: rand_int.set_seed(4242); maximal_planar_graph(H, 32); break;
                case 3: read_graphml(H, paper_path); break;
            }
            snprintf(nm, sizeof nm, "%s", name);
            run_thm1(H, "ksweep", nm, -1, ks[i]);
        }
    }
}

// Selbsttest: prueft das Messwerkzeug gegen Werte, die unabhaengig von
// ihm feststehen -- drei aus dem Projektbericht, einer aus der
// Papier-Definition. Schlaegt einer fehl, ist das Werkzeug falsch.
static int selbsttest(const std::string& paper_path) {
    int fehler = 0;
    graph G;
    char buf[256];

    struct Pruef {
        static void sagt(bool ok, const char* was, const std::string& ist,
                         const std::string& soll, int& fehler) {
            std::cout << (ok ? "[ok]   " : "[FEHL] ") << was
                      << ": " << ist;
            if (!ok) { std::cout << "  (erwartet " << soll << ")"; fehler++; }
            std::cout << std::endl;
        }
    };

    // 1. Rad W8 bei k=12: laut Bericht ein 70x86-Gitter (Webanwendung)
    gf_wheel(G, 8);
    {
        OneBendResult r;
        if (compute_onebend_drawing(G, r, false, 12)) {
            std::string rep;
            verify_onebend_drawing(G, r, rep);
            snprintf(buf, sizeof buf, "%lldx%lld", r.stats.width, r.stats.height);
            Pruef::sagt(r.stats.width == 70 && r.stats.height == 86,
                        "Rad W8, k=12, Gitter", buf, "70x86", fehler);
        } else { std::cout << "[FEHL] Rad W8, k=12 nicht zeichenbar" << std::endl; fehler++; }
    }

    // 2. k unterhalb des Minimums muss abgelehnt werden
    gf_wheel(G, 8);
    {
        OneBendResult r;
        bool ok = compute_onebend_drawing(G, r, false, 1);
        Pruef::sagt(!ok, "k=1 abgelehnt", ok ? "gezeichnet" : "abgelehnt",
                    "abgelehnt", fehler);
    }

    // 3. Oktaeder: drei Steigungen trotz Schranke ceil(Delta/2) = 2
    gf_octahedron(G);
    {
        SlopesResult r; std::string rep;
        compute_slopes_drawing(G, r, 0, false);
        verify_slopes_drawing(G, r, rep);
        snprintf(buf, sizeof buf, "%d", r.stats.slopes_used);
        Pruef::sagt(r.stats.slopes_used == 3, "Oktaeder, Steigungen", buf, "3", fehler);
    }

    // 4. Papiergraph: Delta = 5, also 3*Delta-8 = 7 Steigungen
    if (read_graphml(G, paper_path)) {
        OneBendResult r; std::string rep;
        compute_onebend_drawing(G, r, false, 0);
        verify_onebend_drawing(G, r, rep);
        snprintf(buf, sizeof buf, "%d bei Delta=%d", r.stats.slopes_used,
                 r.stats.delta_orig);
        Pruef::sagt(r.stats.slopes_used == 7 && r.stats.delta_orig == 5,
                    "Papiergraph, Steigungen", buf, "7 bei Delta=5", fehler);
    } else {
        std::cout << "[----] Papiergraph nicht lesbar, uebersprungen" << std::endl;
    }

    std::cout << (fehler ? "SELBSTTEST FEHLGESCHLAGEN" : "Selbsttest bestanden")
              << std::endl;
    return fehler;
}


// ---------------------------------------------------------------------
// k-Wahl: Prueft das Modell H(k) = (p-2)*k + b und die daraus folgende
// Faustregel fuer einen quadratischen Umriss. Je Instanz vier Laeufe:
// Papier-Wahl, k_min, k_min+1 (Modellprobe) und die Vorhersage k*.
// ---------------------------------------------------------------------
static void kwahl_instanz(graph& G, const std::string& name) {
    graph H;

    H = G;
    Row papier = run_thm1(H, "kwahl", name, -1, 0, "papier");
    if (!papier.verifiziert) return;
    const ll kmin = onebend_k_min(papier.delta_eff);
    const int p = atoi(papier.teile.c_str());
    if (p < 3 || kmin < 1) return;

    H = G;
    Row min0 = run_thm1(H, "kwahl", name, -1, kmin, "minimal");
    if (!min0.verifiziert) return;

    // Modellprobe am oberen Ende: dort ist H exakt linear. Bei kleinen k
    // gibt es einen additiven Versatz, der die Steigung verfaelscht.
    const ll kpapier = atoll(papier.k.c_str());
    if (kpapier > kmin + 2) {
        H = G;
        run_thm1(H, "kwahl", name, -1, kpapier - 1, "modellprobe");
    }

    // Vorhersage: H(k) = H(kmin) + (p-2)*(k - kmin), gesucht H = W
    double roh = (double)kmin + (double)(min0.breite - min0.hoehe) / (double)(p - 2);
    ll kstern = (ll)(roh + 0.5);
    if (kstern < kmin) kstern = kmin;
    H = G;
    run_thm1(H, "kwahl", name, -1, kstern, "quadratisch");
}

static void sweep_kwahl(const std::string& paper_path) {
    graph G;
    char nm[128];

    gf_wheel(G, 8);      kwahl_instanz(G, "Rad W8");
    gf_octahedron(G);    kwahl_instanz(G, "Oktaeder");
    gf_icosahedron(G);   kwahl_instanz(G, "Ikosaeder");
    gf_k4(G);            kwahl_instanz(G, "K4");
    if (read_graphml(G, paper_path)) kwahl_instanz(G, "Paper Abb. 1");

    for (int n = 8; n <= 128; n *= 2) {
        gf_prism(G, n / 2);
        snprintf(nm, sizeof nm, "prisma n=%d", n);      kwahl_instanz(G, nm);
        gf_antiprism(G, n / 2);
        snprintf(nm, sizeof nm, "antiprisma n=%d", n);  kwahl_instanz(G, nm);
    }
    for (int m = 4; m <= 32; m += 4) {
        gf_wheel(G, m);
        snprintf(nm, sizeof nm, "rad m=%d", m);         kwahl_instanz(G, nm);
        gf_double_wheel(G, m);
        snprintf(nm, sizeof nm, "doppelrad m=%d", m);   kwahl_instanz(G, nm);
    }
    for (int n = 8; n <= 64; n *= 2)
        for (int r = 0; r < 5; r++) {
            int seed = 7000 + 100 * n + r;
            rand_int.set_seed(seed);
            maximal_planar_graph(G, n);
            snprintf(nm, sizeof nm, "triangulierung n=%d s=%d", n, seed);
            kwahl_instanz(G, nm);
            gf_random_planar(G, n, 2 * n, (unsigned)seed);
            snprintf(nm, sizeof nm, "random n=%d m=%d s=%d", n, 2 * n, seed);
            kwahl_instanz(G, nm);
        }
    for (int s = 3; s <= 10; s++) {
        gf_grid(G, s, s);
        snprintf(nm, sizeof nm, "gitter %dx%d", s, s);  kwahl_instanz(G, nm);
    }
    for (int m = 4; m <= 24; m += 4) {
        gf_star(G, m);
        snprintf(nm, sizeof nm, "stern k=%d", m);       kwahl_instanz(G, nm);
    }
}

int main(int argc, char** argv) {
    bool thm4 = false, thm1 = false, ksweep = false, selbst = false, kwahl = false;
    int reps = 10, max4 = 1024, max1 = 256;
    std::string out, paper = "abbildungen/paper-fig1.graphml";

    for (int i = 1; i < argc; i++) {
        std::string a(argv[i]);
        if (a == "--thm4") thm4 = true;
        else if (a == "--thm1") thm1 = true;
        else if (a == "--ksweep") ksweep = true;
        else if (a == "--selbsttest") selbst = true;
        else if (a == "--kwahl") kwahl = true;
        else if (a == "--seeds" && i + 1 < argc) reps = atoi(argv[++i]);
        else if (a == "--max-n-thm4" && i + 1 < argc) max4 = atoi(argv[++i]);
        else if (a == "--max-n-thm1" && i + 1 < argc) max1 = atoi(argv[++i]);
        else if (a == "--out" && i + 1 < argc) out = argv[++i];
        else if (a == "--paper" && i + 1 < argc) paper = argv[++i];
        else { std::cerr << "Unbekannte Option: " << a << std::endl; return 2; }
    }
    if (selbst) return selbsttest(paper) == 0 ? 0 : 1;
    if (!thm4 && !thm1 && !ksweep && !kwahl) { thm4 = thm1 = ksweep = kwahl = true; }

    if (!out.empty()) {
        g_file.open(out.c_str());
        if (!g_file) { std::cerr << "Kann " << out << " nicht schreiben." << std::endl; return 2; }
        g_out = &g_file;
    }
    (*g_out) << CSV_HEADER;

    std::chrono::steady_clock::time_point t0 = std::chrono::steady_clock::now();
    if (thm4 || thm1) {
        std::cerr << "[1/5] n-Sweep (Prisma, Antiprisma)" << std::endl;
        sweep_n(thm4, thm1, max4, max1);
        std::cerr << "[2/5] Delta-Sweep (Rad, Doppelrad)" << std::endl;
        sweep_delta(thm4, thm1);
        std::cerr << "[3/5] Zufallstriangulierungen (" << reps << " Seeds)" << std::endl;
        sweep_random(thm4, thm1, reps, max4, max1);
        std::cerr << "[4/5] Dichtesweep und duenne Familien" << std::endl;
        sweep_density(thm4, thm1, reps);
        sweep_sparse(thm4, thm1);
        std::cerr << "[5/5] Referenzinstanzen" << std::endl;
        sweep_referenz(thm4, thm1, paper);
    }
    if (ksweep) {
        std::cerr << "[k] k-Sweep (nur Theorem 1)" << std::endl;
        sweep_k(paper);
    }
    if (kwahl) {
        std::cerr << "[k] k-Wahl: Modellprobe und Faustregel" << std::endl;
        sweep_kwahl(paper);
    }
    std::chrono::steady_clock::time_point t1 = std::chrono::steady_clock::now();

    g_file.flush();
    std::cerr << "=============================================" << std::endl;
    std::cerr << "Zeilen: " << g_rows
              << "  nicht verifiziert: " << g_unverified
              << "  Dauer: "
              << std::chrono::duration<double>(t1 - t0).count() << " s" << std::endl;
    return g_unverified == 0 ? 0 : 1;
}
