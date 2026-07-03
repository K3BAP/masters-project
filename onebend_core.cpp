// =====================================================================
// Implementierung von Theorem 1 + Korollar 2 aus
// Bekos, Katsanou, Kindermann, Pavlidi:
// "How Many Slopes Does Polynomial Area Cost?" (arXiv 2605.31098)
//
// Steigungsmenge S (k = 4*Deff*n^2, Deff = max(Delta', 5), D3 = Deff-3):
//   vertikal; horizontal; links-steil -k/j und rechts-steil +k/j fuer
//   j = 1..D3; flach j/D3 fuer j = 1..D3-1.  |S| = 3*Deff - 8.
//
// Inkrementelle Konstruktion entlang einer kanonischen Ordnung:
//   Fall 1 (Kette / Grad-2-Singleton): neue Zeile y = H + k; Ports
//     rho_l (ccw-erster freier in S_rs u S_v) an v_l, rho_r symmetrisch
//     an v_r; Knicke p_l/p_r auf der neuen Zeile; Konturkanten werden
//     per Cut gestreckt, bis p_l links von v_l' liegt, p_r rechts von
//     v_r' und genuegend Platz fuer die Kette bleibt.
//   Fall 2 (Singleton mit Untergrad > 2): x(v_g) = x(w_q) (vertikale
//     rote Kante); (w_j,v_g) fuer j < q vertikal + flach mit Steigung
//     j/D3; Streckung von (w_j,w_{j+1}) bis der Horizontalabstand ein
//     Vielfaches von D3 ist; y(v_g) = kleinstes Vielfaches von k ueber
//     allen Knick-Schranken.
//   Sonderfall deg(vn) = Deff: Kante (w_Delta,vn) wird aufgeschoben und
//     am Ende mit vertikalem Segment an w_Delta und flachem Segment
//     (Steigung 1/D3) ueber der Zeichnung an vn eingesetzt.
//   Abschluss: (v1,v2) unterhalb der Zeichnung (vertikal an v1, flach
//     1/D3 an v2; dafuer wird x(v2) auf ein Vielfaches von D3 gestreckt).
//
// Streckung (Cut an Konturkante e): R = Abschluss des rechten Endpunkts
// des horizontalen Segments von e unter (a) nicht-horizontalen
// Segmenten (beide Richtungen, starr) und (b) horizontalen Segmenten in
// Richtung ihres rechten Endpunkts. Alle Punkte in R werden um +d
// verschoben -- nur horizontale Segmente aendern ihre Laenge, Steigungen
// bleiben exakt erhalten (Invariante I.2 des Papers garantiert, dass der
// linke Endpunkt nicht in R liegt; wird zur Laufzeit geprueft).
// =====================================================================

#include "onebend_core.h"
#include "canonical_order.h"
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

typedef long long ll;
typedef __int128 lll;

// ---------------------------------------------------------------------
// Zeichnungszustand
// ---------------------------------------------------------------------
struct EdgeRec {
    int u, v;            // u = frueherer Endknoten (Quelle der Faerbung)
    int color;
    bool drawn;
    bool has_bend;
    ll bx, by;
    EdgeRec() : u(-1), v(-1), color(OB_BLACK), drawn(false),
                has_bend(false), bx(0), by(0) {}
};

std::pair<int, int> ekey(int a, int b) {
    return std::make_pair(std::min(a, b), std::max(a, b));
}

struct Draw {
    int n;
    std::vector<std::vector<int> > adj;   // einfache ungerichtete Adjazenz
    std::vector<int> part;
    std::vector<ll> X, Y;
    std::vector<char> placed;
    std::vector<EdgeRec> ers;
    std::map<std::pair<int, int>, int> eidx;
    // belegte Top-Ports: 0 = vertikal, +j = rechts-steil k/j, -j = links-steil
    std::vector<std::set<int> > used_top;
    std::vector<int> contour;             // v1 ... v2 (links -> rechts)
    ll H;                                 // Hoehe = max. Knoten-y (Vielfaches von k)
    ll k;
    int Deff, D3;
    int v1, v2, vn;
    int skip_a, skip_b;                   // aufgeschobene Kante (Sonderfall), sonst -1
    bool verbose;
    std::string error;

    bool fail(const std::string& msg) {
        if (error.empty()) error = msg;
        return false;
    }
    int eid(int a, int b) const {
        std::map<std::pair<int, int>, int>::const_iterator it = eidx.find(ekey(a, b));
        return it == eidx.end() ? -1 : it->second;
    }
    int cpos(int v) const {
        for (size_t j = 0; j < contour.size(); j++) if (contour[j] == v) return (int)j;
        return -1;
    }

    // ------------------------------------------------------------------
    // Streckung: Cut an der Konturkante (a,b) mit a links von b.
    // ------------------------------------------------------------------
    bool stretch(int a, int b, ll d) {
        if (d <= 0) return true;
        int re = eid(a, b);
        if (re < 0 || !ers[re].drawn)
            return fail("Streckung an nicht gezeichneter Konturkante");

        // Punkt-Ids: 0..n-1 Knoten, n+i Knick der Kante i
        const int NP = n + (int)ers.size();
        std::vector<std::vector<std::pair<int, char> > > inc(NP);
        // inc[p] = (anderer Punkt, typ): typ 0 = starr (nicht horizontal),
        // typ 1 = horizontal und p ist linker Endpunkt, typ 2 = horizontal
        // und p ist rechter Endpunkt.
        for (size_t i = 0; i < ers.size(); i++) {
            const EdgeRec& r = ers[i];
            if (!r.drawn) continue;
            ll px[3], py[3];
            int pid[3];
            int np = 0;
            pid[np] = r.u; px[np] = X[r.u]; py[np] = Y[r.u]; np++;
            if (r.has_bend) { pid[np] = n + (int)i; px[np] = r.bx; py[np] = r.by; np++; }
            pid[np] = r.v; px[np] = X[r.v]; py[np] = Y[r.v]; np++;
            for (int s = 0; s + 1 < np; s++) {
                int p = pid[s], q = pid[s + 1];
                if (py[s] == py[s + 1]) {
                    bool p_left = px[s] < px[s + 1];
                    inc[p].push_back(std::make_pair(q, p_left ? (char)1 : (char)2));
                    inc[q].push_back(std::make_pair(p, p_left ? (char)2 : (char)1));
                } else {
                    inc[p].push_back(std::make_pair(q, (char)0));
                    inc[q].push_back(std::make_pair(p, (char)0));
                }
            }
        }

        // Seed: rechter Endpunkt des horizontalen Segments der Cut-Kante
        const EdgeRec& r = ers[re];
        int seed = -1, seed_left = -1;
        {
            ll px[3], py[3];
            int pid[3];
            int np = 0;
            pid[np] = r.u; px[np] = X[r.u]; py[np] = Y[r.u]; np++;
            if (r.has_bend) { pid[np] = n + re; px[np] = r.bx; py[np] = r.by; np++; }
            pid[np] = r.v; px[np] = X[r.v]; py[np] = Y[r.v]; np++;
            for (int s = 0; s + 1 < np; s++) {
                if (py[s] != py[s + 1]) continue;
                if (px[s] < px[s + 1]) { seed = pid[s + 1]; seed_left = pid[s]; }
                else                   { seed = pid[s];     seed_left = pid[s + 1]; }
            }
        }
        if (seed < 0) return fail("Cut-Kante ohne horizontales Segment");

        std::vector<char> inR(NP, 0);
        std::vector<int> queue, par(NP, -1);
        inR[seed] = 1;
        queue.push_back(seed);
        for (size_t qi = 0; qi < queue.size(); qi++) {
            int p = queue[qi];
            for (size_t j = 0; j < inc[p].size(); j++) {
                int q = inc[p][j].first;
                char t = inc[p][j].second;
                if (inR[q]) continue;
                if (t == 2) continue;   // horizontal, p ist rechter Endpunkt
                inR[q] = 1;             // starr oder horizontal nach rechts
                par[q] = p;
                queue.push_back(q);
            }
        }
        if (inR[seed_left]) {
            char dbg[160];
            snprintf(dbg, sizeof dbg,
                     "Cut-Verletzung: linker Endpunkt im verschobenen Teil "
                     "(Kante %d-%d, Farbe %d, Knick=%d)",
                     a, b, r.color, (int)r.has_bend);
            if (verbose) {
                cout << "[1BEND] BFS-Pfad seed->seed_left:";
                for (int p = seed_left; p >= 0; p = par[p])
                    cout << " " << (p < n ? p : -(p - n + 1));
                cout << "  (negative Ids = Knick der Kante |id|-1)" << endl;
            }
            return fail(dbg);
        }
        if (inR[v1])
            return fail("Cut-Verletzung: v1 im verschobenen Teil");
        if (inR[a])
            return fail("Cut-Verletzung: linker Konturknoten im verschobenen Teil");

        for (int p = 0; p < NP; p++) {
            if (!inR[p]) continue;
            if (p < n) X[p] += d;
            else ers[p - n].bx += d;
        }
        return true;
    }

    // ------------------------------------------------------------------
    // Ports
    // ------------------------------------------------------------------
    // rho_l: erster freier Port an v ccw ab horizontal-rechts in
    // S_rs u S_v: k/D3 (flachster), ..., k/1, vertikal.
    int pick_rs(int v) {
        for (int j = D3; j >= 1; j--)
            if (!used_top[v].count(+j)) return +j;
        if (!used_top[v].count(0)) return 0;
        return INT_MIN;
    }
    // rho_r: symmetrisch cw ab horizontal-links in S_ls u S_v.
    int pick_ls(int v) {
        for (int j = D3; j >= 1; j--)
            if (!used_top[v].count(-j)) return -j;
        if (!used_top[v].count(0)) return 0;
        return INT_MIN;
    }
    // x-Koordinate des Schnitts des Port-Strahls von v mit Zeile Ly.
    ll ray_x(int v, int port, ll Ly) const {
        if (port == 0) return X[v];
        ll rise = Ly - Y[v];              // > 0, Vielfaches von k
        ll steps = rise / k;
        return port > 0 ? X[v] + steps * (ll)port : X[v] + steps * (ll)port;
        // (port < 0 traegt das Vorzeichen bereits)
    }

    // ------------------------------------------------------------------
    // Kanten zeichnen
    // ------------------------------------------------------------------
    bool draw_edge(int u, int v, int color, bool bend, ll bx, ll by) {
        int re = eid(u, v);
        if (re < 0) return fail("Kante fehlt im Graphen (intern)");
        EdgeRec& r = ers[re];
        if (r.drawn) return fail("Kante doppelt gezeichnet (intern)");
        r.drawn = true;
        r.color = color;
        r.u = u; r.v = v;                 // Quelle = fruehere Seite
        r.has_bend = bend;
        r.bx = bx; r.by = by;
        return true;
    }

    // Nachbarn des Teils mit kleinerem Teilindex, nach Konturposition
    // sortiert. Zwischen den Nachbarn koennen weitere Konturknoten
    // liegen (sie werden vom Teil ueberdeckt; ihre spaeteren Nachbarn
    // im Sinne von (iv) wurden bereits in frueheren Schritten gezeichnet).
    bool lower_neighbors(const std::vector<int>& pt, int i,
                         std::vector<int>& nbrs, int& pos_l, int& pos_r) {
        std::set<int> seen;
        for (size_t a = 0; a < pt.size(); a++) {
            int z = pt[a];
            for (size_t j = 0; j < adj[z].size(); j++) {
                int y = adj[z][j];
                if (part[y] >= i) continue;
                if (z == skip_a && y == skip_b) continue;
                if (z == skip_b && y == skip_a) continue;
                seen.insert(y);
            }
        }
        std::vector<std::pair<int, int> > ord;
        for (std::set<int>::iterator it = seen.begin(); it != seen.end(); ++it) {
            int p = cpos(*it);
            if (p < 0) return fail("Nachbar nicht auf der Kontur");
            ord.push_back(std::make_pair(p, *it));
        }
        if (ord.size() < 2) return fail("Teil mit weniger als zwei unteren Nachbarn");
        std::sort(ord.begin(), ord.end());
        nbrs.clear();
        for (size_t j = 0; j < ord.size(); j++) nbrs.push_back(ord[j].second);
        pos_l = ord.front().first;
        pos_r = ord.back().first;
        return true;
    }

    void splice_contour(int pos_l, int pos_r, const std::vector<int>& mid) {
        std::vector<int> nc(contour.begin(), contour.begin() + pos_l + 1);
        for (size_t j = 0; j < mid.size(); j++) nc.push_back(mid[j]);
        for (size_t j = pos_r; j < contour.size(); j++) nc.push_back(contour[j]);
        contour.swap(nc);
    }

    // ------------------------------------------------------------------
    // Fall 1: Kette oder Singleton mit Untergrad 2
    // ------------------------------------------------------------------
    bool case1(std::vector<int> chain, int i) {
        std::vector<int> nbrs;
        int pos_l, pos_r;
        if (!lower_neighbors(chain, i, nbrs, pos_l, pos_r)) return false;
        if (nbrs.size() != 2) return fail("Fall 1 mit != 2 unteren Nachbarn");
        int vl = nbrs[0], vr = nbrs[1];

        // Kette orientieren: erster Knoten haengt an vl
        bool front_l = false, back_l = false;
        for (size_t j = 0; j < adj[chain.front()].size(); j++)
            if (adj[chain.front()][j] == vl) front_l = true;
        for (size_t j = 0; j < adj[chain.back()].size(); j++)
            if (adj[chain.back()][j] == vl) back_l = true;
        if (!front_l) {
            if (!back_l) return fail("Kette haengt nicht an vl");
            std::reverse(chain.begin(), chain.end());
        }

        int rho_l = pick_rs(vl);
        int rho_r = pick_ls(vr);
        if (rho_l == INT_MIN || rho_r == INT_MIN)
            return fail("Kein freier Port (I.3 verletzt?)");

        const ll Ly = H + k;
        ll plx = ray_x(vl, rho_l, Ly);
        int vl2 = contour[pos_l + 1];
        ll d1 = std::max((ll)0, plx - (X[vl2] - 1));
        if (!stretch(vl, vl2, d1)) return false;

        int vr2 = contour[pos_r - 1];
        ll prx = ray_x(vr, rho_r, Ly);
        ll d2 = std::max((ll)0, (X[vr2] + 1) - prx);
        if (!stretch(vr2, vr, d2)) return false;
        prx += d2;

        ll need = (ll)chain.size() + 1;
        ll d3 = std::max((ll)0, need - (prx - plx));
        if (!stretch(vl, vl2, d3)) return false;
        prx += d3;
        if (prx - plx < need) return fail("Platz fuer Kette fehlt (intern)");

        for (size_t t = 0; t < chain.size(); t++) {
            int z = chain[t];
            X[z] = plx + 1 + (ll)t;
            Y[z] = Ly;
            placed[z] = 1;
        }
        H = Ly;

        if (!draw_edge(vl, chain.front(), OB_BLUE, true, plx, Ly)) return false;
        for (size_t t = 0; t + 1 < chain.size(); t++)
            if (!draw_edge(chain[t], chain[t + 1], OB_BLACK, false, 0, 0)) return false;
        if (!draw_edge(vr, chain.back(), OB_GREEN, true, prx, Ly)) return false;

        used_top[vl].insert(rho_l);
        used_top[vr].insert(rho_r);
        splice_contour(pos_l, pos_r, chain);
        if (verbose)
            cout << "[1BEND] P_" << i << " Kette |P|=" << chain.size()
                 << " Zeile y=" << Ly << endl;
        return true;
    }

    // ------------------------------------------------------------------
    // Fall 2: Singleton mit Untergrad > 2
    // ------------------------------------------------------------------
    bool case2(int vg, int i) {
        std::vector<int> pt(1, vg), nbrs;
        int pos_l, pos_r;
        if (!lower_neighbors(pt, i, nbrs, pos_l, pos_r)) return false;
        const int q = (int)nbrs.size() - 2;
        if (q < 1) return fail("Fall 2 mit Untergrad < 3");
        int vl = nbrs[0], vr = nbrs[(int)nbrs.size() - 1];
        std::vector<int> w(nbrs.begin() + 1, nbrs.end() - 1);   // w[0..q-1]

        // Horizontalabstaende zu w[q-1] auf Vielfache von D3 strecken
        // (von rechts nach links; jede Streckung verschiebt w[idx+1..q-1]
        // mitsamt kuenftiger v_g-Spalte, laesst also fixierte Abstaende
        // unveraendert).
        for (int idx = q - 2; idx >= 0; idx--) {
            ll dx = X[w[q - 1]] - X[w[idx]];
            if (dx <= 0) return fail("Konturordnung verletzt (Fall 2)");
            ll t = ((ll)D3 - dx % D3) % D3;
            int succ = contour[cpos(w[idx]) + 1];
            if (!stretch(w[idx], succ, t)) return false;
        }

        // y(v_g): kleinstes Vielfaches von k ueber allen Knick-Schranken
        const ll xg = X[w[q - 1]];
        ll ymin = H + k;
        for (int idx = 0; idx <= q - 2; idx++) {
            ll dx = xg - X[w[idx]];
            ll bound = H + 1 + (ll)(idx + 1) * (dx / D3);
            ymin = std::max(ymin, bound);
        }
        const ll yg = ((ymin + k - 1) / k) * k;

        X[vg] = xg; Y[vg] = yg; placed[vg] = 1;

        // rote Kanten: vertikal an w_j, flach j/D3 an v_g (ccw-Zuordnung)
        for (int idx = 0; idx <= q - 2; idx++) {
            ll dx = xg - X[w[idx]];
            ll by = yg - (ll)(idx + 1) * (dx / D3);
            if (!draw_edge(w[idx], vg, OB_RED, true, X[w[idx]], by)) return false;
            used_top[w[idx]].insert(0);
        }
        if (!draw_edge(w[q - 1], vg, OB_RED, false, 0, 0)) return false;
        used_top[w[q - 1]].insert(0);
        H = yg;

        // blaue Kante (v_l -> v_g)
        int rho_l = pick_rs(vl);
        if (rho_l == INT_MIN) return fail("Kein freier Port an v_l (I.3?)");
        ll plx = ray_x(vl, rho_l, yg);
        int vl2 = contour[pos_l + 1];
        ll d1 = std::max((ll)0, plx - (X[vl2] - 1));
        if (!stretch(vl, vl2, d1)) return false;
        if (!draw_edge(vl, vg, OB_BLUE, true, plx, yg)) return false;
        used_top[vl].insert(rho_l);

        // gruene Kante (v_r -> v_g)
        int rho_r = pick_ls(vr);
        if (rho_r == INT_MIN) return fail("Kein freier Port an v_r (I.3?)");
        ll prx = ray_x(vr, rho_r, yg);
        int vr2 = contour[pos_r - 1];
        ll d2 = std::max((ll)0, (X[vr2] + 1) - prx);
        if (!stretch(vr2, vr, d2)) return false;
        prx += d2;
        if (!draw_edge(vr, vg, OB_GREEN, true, prx, yg)) return false;
        used_top[vr].insert(rho_r);

        std::vector<int> mid(1, vg);
        splice_contour(pos_l, pos_r, mid);
        if (verbose)
            cout << "[1BEND] P_" << i << " Singleton q=" << q
                 << " y=" << yg << endl;
        return true;
    }

    // ------------------------------------------------------------------
    // Ausrichtungs-Streckungen fuer die Wiedereinsetzungen. Sie muessen
    // VOR dem Zeichnen der Sonderfall-Kante laufen: deren Bogen
    // (vertikal + flach, kein horizontales Segment) versperrt danach
    // jeden Cut, der ihn kreuzen muesste. Der (v1,v2)-Abstand wird ueber
    // die ERSTE Konturkante (v1, succ(v1)) ausgerichtet -- dieser Cut
    // verschiebt alles ausser v1 (die steilen Faecher-Segmente an v1
    // bleiben mitsamt Knicken stehen, nur ihre horizontalen Teile
    // strecken sich) und erhaelt so alle paarweisen Abstaende rechts
    // davon, insbesondere die vn/w_Delta-Ausrichtung.
    // ------------------------------------------------------------------
    bool prepare_reinserts(bool special) {
        if (special) {
            int wl = skip_a == vn ? skip_b : skip_a;
            ll dx = X[wl] - X[vn];
            if (dx <= 0) return fail("Sonderfall: w_Delta nicht rechts von vn");
            ll t = ((ll)D3 - dx % D3) % D3;
            int p = cpos(wl);
            if (p <= 0) return fail("Sonderfall: w_Delta nicht auf der Kontur");
            if (!stretch(contour[p - 1], wl, t)) return false;
        }
        ll dx = X[v2] - X[v1];
        if (dx <= 0) return fail("v2 nicht rechts von v1 (intern)");
        ll t = ((ll)D3 - dx % D3) % D3;
        if ((int)contour.size() < 2) return fail("Kontur zu kurz (intern)");
        return stretch(v1, contour[1], t);
    }

    // Sonderfall-Kante (w_last, vn): vertikal an w_last, flach 1/D3
    // ueber der Zeichnung an vn.
    bool reinsert_special() {
        int wl = skip_a == vn ? skip_b : skip_a;
        ll dx = X[wl] - X[vn];
        if (dx <= 0 || dx % D3 != 0)
            return fail("Sonderfall: Ausrichtung fehlt (intern)");
        ll by = Y[vn] + dx / D3;
        if (used_top[wl].count(0)) return fail("Sonderfall: vertikaler Port belegt");
        if (!draw_edge(wl, vn, OB_RED, true, X[wl], by)) return false;
        used_top[wl].insert(0);
        if (by > H) H = by;
        return true;
    }

    // Abschluss: (v1,v2) unterhalb der Zeichnung
    bool reinsert_base() {
        ll dx = X[v2] - X[v1];
        if (dx <= 0 || dx % D3 != 0)
            return fail("Basiskante: Ausrichtung fehlt (intern)");
        ll by = Y[v1] - dx / D3;
        return draw_edge(v1, v2, OB_BLACK, true, X[v1], by);
    }
};

// ---------------------------------------------------------------------
// Exakte Geometrie-Hilfen fuer den Verifier (wie slopes_core.cpp)
// ---------------------------------------------------------------------
struct Pt {
    ll x, y;
    bool operator==(const Pt& o) const { return x == o.x && y == o.y; }
    bool operator<(const Pt& o) const { return x != o.x ? x < o.x : y < o.y; }
};
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
int seg_intersect(const Seg& s, const Seg& t, Pt* touch) {
    int d1 = sgn(cross(s.a, s.b, t.a));
    int d2 = sgn(cross(s.a, s.b, t.b));
    int d3 = sgn(cross(t.a, t.b, s.a));
    int d4 = sgn(cross(t.a, t.b, s.b));
    if (d1 * d2 < 0 && d3 * d4 < 0) return 2;
    int touches = 0;
    Pt tp{0, 0};
    Pt cand[4] = { t.a, t.b, s.a, s.b };
    const Seg* seg_for[4] = { &s, &s, &t, &t };
    bool seen_any = false;
    for (int idx = 0; idx < 4; idx++) {
        if (on_segment(cand[idx], *seg_for[idx])) {
            if (!seen_any) { tp = cand[idx]; seen_any = true; touches = 1; }
            else if (!(cand[idx] == tp)) return 2;
        }
    }
    if (!seen_any) return 0;
    if (touch) *touch = tp;
    return touches;
}

ll ll_of(double d) { return (ll)llround(d); }
bool is_integral(double d) { return std::abs(d - llround(d)) < 1e-9; }
ll gcd_ll(ll a, ll b) { while (b) { ll t = a % b; a = b; b = t; } return a < 0 ? -a : a; }

// Steigungsklassen fuer den Verifier
enum SlopeClass { SC_VERTICAL, SC_HORIZONTAL, SC_RSTEEP, SC_LSTEEP, SC_FLAT, SC_BAD };

SlopeClass classify_slope(ll dx, ll dy, ll k, int D3) {
    if (dx == 0) return dy != 0 ? SC_VERTICAL : SC_BAD;
    if (dy == 0) return SC_HORIZONTAL;
    ll ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
    bool positive = (dx > 0) == (dy > 0);
    if (ay > ax) {
        // steil: |dy| * j == k * |dx| fuer ein j in 1..D3
        ll num = k * ax;
        if (num % ay != 0) return SC_BAD;
        ll j = num / ay;
        if (j < 1 || j > D3) return SC_BAD;
        return positive ? SC_RSTEEP : SC_LSTEEP;
    } else {
        // flach: |dy| * D3 == j * |dx| fuer ein j in 1..D3-1, Steigung > 0
        if (!positive) return SC_BAD;
        ll num = ay * (ll)D3;
        if (num % ax != 0) return SC_BAD;
        ll j = num / ax;
        if (j < 1 || j > D3 - 1) return SC_BAD;
        return SC_FLAT;
    }
}

} // namespace

// =====================================================================
// Hauptfunktion
// =====================================================================
bool compute_onebend_drawing(graph& G, OneBendResult& result, bool verbose) {
    result.error.clear();
    result.stats = OneBendStats();
    result.v1 = result.v2 = result.vn = nil;
    edge e;
    node v;

    const int n0 = G.number_of_nodes();
    if (n0 == 0) { result.error = "Leerer Graph."; return false; }

    result.pos.init(G, point(0, 0));
    result.bends.init(G);
    result.color.init(G, OB_BLACK);
    result.part.init(G, 0);

    if (n0 == 1) { result.stats.n = 1; result.stats.k = 1; return true; }

    forall_edges(e, G)
        if (G.source(e) == G.target(e)) { result.error = "Schleifen sind nicht erlaubt."; return false; }
    if (!Is_Simple_Undirected(G)) { result.error = "Mehrfachkanten sind nicht erlaubt."; return false; }

    if (n0 == 2) {
        int i = 0;
        forall_nodes(v, G) result.pos[v] = point((double)i++, 0);
        result.stats.n = 2;
        result.stats.m = G.number_of_edges();
        result.stats.k = 1;
        result.stats.delta_orig = result.stats.m > 0 ? 1 : 0;
        return true;
    }

    // ------------------------------------------------------------------
    // Phase 1: bidirektional, Planaritaet
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
    // Phase 2: Augmentierung zu 3-Zusammenhang (Korollar 2)
    // ------------------------------------------------------------------
    list<edge> aug_edges, aug_reversals;
    {
        std::string aug_error;
        augment_connected_bounded(G, aug_edges, aug_reversals);
        if (!augment_biconnected_bounded(G, aug_edges, aug_reversals, aug_error) ||
            !augment_triconnected_bounded(G, aug_edges, aug_reversals, aug_error)) {
            G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
            result.error = aug_error;
            return false;
        }
    }
    result.stats.augmented = !aug_edges.empty();

    std::set<edge> temp_edges;
    forall(e, reverse_edges) temp_edges.insert(e);
    forall(e, aug_edges) temp_edges.insert(e);
    forall(e, aug_reversals) temp_edges.insert(e);

    // frische Einbettung inkl. der zuletzt ergaenzten Chorden
    if (!PLANAR(G, true)) {
        G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
        result.error = "Graph nach Augmentierung nicht planar (intern).";
        return false;
    }

    const int n = G.number_of_nodes();
    const int m = G.number_of_edges() / 2;
    int delta_aug = 0;
    forall_nodes(v, G) delta_aug = std::max(delta_aug, G.outdeg(v));

    const int Deff = std::max(delta_aug, 5);
    const ll k = 4LL * Deff * (ll)n * (ll)n;
    result.stats.n = n;
    result.stats.m = m;
    result.stats.delta_aug = delta_aug;
    result.stats.delta_eff = Deff;
    result.stats.k = k;
    result.stats.slopes_allowed = 3 * Deff - 8;

    // ------------------------------------------------------------------
    // Phase 3: kanonische Ordnung
    // ------------------------------------------------------------------
    CanonicalOrder ord;
    {
        std::string oerr;
        if (!compute_canonical_order(G, ord, oerr)) {
            G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
            result.error = "Kanonische Ordnung: " + oerr;
            return false;
        }
    }
    const int mparts = (int)ord.parts.size() - 1;
    result.stats.parts = (int)ord.parts.size();

    // ------------------------------------------------------------------
    // Phase 4: Zeichnen
    // ------------------------------------------------------------------
    node_array<int> id(G, -1);
    std::vector<node> byid(n);
    {
        int next = 0;
        forall_nodes(v, G) { id[v] = next; byid[next] = v; next++; }
    }

    Draw D;
    D.n = n;
    D.adj.assign(n, std::vector<int>());
    forall_nodes(v, G) {
        edge e2;
        forall_adj_edges(e2, v) D.adj[id[v]].push_back(id[G.opposite(v, e2)]);
    }
    D.part.assign(n, -1);
    for (size_t i = 0; i < ord.parts.size(); i++)
        for (size_t a = 0; a < ord.parts[i].size(); a++)
            D.part[id[ord.parts[i][a]]] = (int)i;
    D.X.assign(n, 0); D.Y.assign(n, 0);
    D.placed.assign(n, 0);
    D.used_top.assign(n, std::set<int>());
    D.H = 0; D.k = k; D.Deff = Deff; D.D3 = Deff - 3;
    D.v1 = id[ord.v1]; D.v2 = id[ord.v2]; D.vn = id[ord.vn];
    D.skip_a = D.skip_b = -1;
    D.verbose = verbose;

    // Kantenrekorde (ungerichtet, Quelle = frueherer Teil)
    {
        std::set<std::pair<int, int> > added;
        forall_edges(e, G) {
            int a = id[G.source(e)], b = id[G.target(e)];
            std::pair<int, int> key = ekey(a, b);
            if (added.count(key)) continue;
            added.insert(key);
            EdgeRec r;
            if (D.part[a] <= D.part[b]) { r.u = a; r.v = b; }
            else                        { r.u = b; r.v = a; }
            D.eidx[key] = (int)D.ers.size();
            D.ers.push_back(r);
        }
    }

    bool ok = true;

    // Basis: v1, P1, v2 auf Zeile 0 (Kante (v1,v2) aufgeschoben)
    {
        std::vector<int> p1;
        for (size_t a = 0; a < ord.parts[1].size(); a++)
            p1.push_back(id[ord.parts[1][a]]);
        bool front_l = false, back_l = false;
        for (size_t j = 0; j < D.adj[p1.front()].size(); j++)
            if (D.adj[p1.front()][j] == D.v1) front_l = true;
        for (size_t j = 0; j < D.adj[p1.back()].size(); j++)
            if (D.adj[p1.back()][j] == D.v1) back_l = true;
        if (!front_l) {
            if (!back_l) ok = D.fail("P1 haengt nicht an v1");
            else std::reverse(p1.begin(), p1.end());
        }
        if (ok) {
            D.X[D.v1] = 0; D.Y[D.v1] = 0; D.placed[D.v1] = 1;
            for (size_t t = 0; t < p1.size(); t++) {
                D.X[p1[t]] = (ll)t + 1; D.Y[p1[t]] = 0; D.placed[p1[t]] = 1;
            }
            D.X[D.v2] = (ll)p1.size() + 1; D.Y[D.v2] = 0; D.placed[D.v2] = 1;
            ok = D.draw_edge(D.v1, p1.front(), OB_BLACK, false, 0, 0);
            for (size_t t = 0; ok && t + 1 < p1.size(); t++)
                ok = D.draw_edge(p1[t], p1[t + 1], OB_BLACK, false, 0, 0);
            if (ok) ok = D.draw_edge(p1.back(), D.v2, OB_BLACK, false, 0, 0);
            D.contour.clear();
            D.contour.push_back(D.v1);
            for (size_t t = 0; t < p1.size(); t++) D.contour.push_back(p1[t]);
            D.contour.push_back(D.v2);
            D.H = 0;
        }
    }

    // Teile 2..m
    for (int i = 2; ok && i <= mparts; i++) {
        std::vector<int> pt;
        for (size_t a = 0; a < ord.parts[i].size(); a++)
            pt.push_back(id[ord.parts[i][a]]);

        if (i == mparts && (int)D.adj[D.vn].size() == Deff) {
            // Sonderfall deg(vn) = Deff: letzte Kante (w_Delta, vn)
            // aufschieben (w_Delta = rechtester Nachbar auf der Kontur).
            result.stats.special_vn = true;
            std::vector<int> nbrs;
            int pos_l, pos_r;
            if (!(ok = D.lower_neighbors(pt, i, nbrs, pos_l, pos_r))) break;
            D.skip_a = nbrs.back();
            D.skip_b = D.vn;
        }

        if (pt.size() >= 2) {
            ok = D.case1(pt, i);
        } else {
            int lowdeg = 0;
            for (size_t j = 0; j < D.adj[pt[0]].size(); j++) {
                int y = D.adj[pt[0]][j];
                if (D.part[y] >= i) continue;
                if (pt[0] == D.skip_a && y == D.skip_b) continue;
                if (pt[0] == D.skip_b && y == D.skip_a) continue;
                lowdeg++;
            }
            ok = lowdeg == 2 ? D.case1(pt, i) : D.case2(pt[0], i);
        }
    }

    if (ok) ok = D.prepare_reinserts(result.stats.special_vn);
    if (ok && result.stats.special_vn) ok = D.reinsert_special();
    if (ok) ok = D.reinsert_base();

    if (!ok) {
        G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
        result.error = "Zeichnung fehlgeschlagen: " + D.error;
        return false;
    }

    // ------------------------------------------------------------------
    // Phase 5: Ergebnis uebertragen, temporaere Kanten entfernen
    // ------------------------------------------------------------------
    forall_nodes(v, G) {
        result.pos[v] = point((double)D.X[id[v]], (double)D.Y[id[v]]);
        result.part[v] = D.part[id[v]];
    }
    {
        std::set<std::pair<int, int> > written;
        forall_edges(e, G) {
            if (temp_edges.count(e)) continue;
            int a = id[G.source(e)], b = id[G.target(e)];
            int re = D.eid(a, b);
            if (re < 0 || !D.ers[re].drawn) {
                G.del_edges(reverse_edges); G.del_edges(aug_reversals); G.del_edges(aug_edges);
                result.error = "Kante ohne Zeichnung (intern).";
                return false;
            }
            result.color[e] = D.ers[re].color;
            if (D.ers[re].has_bend)
                result.bends[e].append(point((double)D.ers[re].bx, (double)D.ers[re].by));
        }
    }
    result.v1 = ord.v1; result.v2 = ord.v2; result.vn = ord.vn;

    G.del_edges(reverse_edges);
    G.del_edges(aug_reversals);
    G.del_edges(aug_edges);
    return true;
}

// =====================================================================
// Verifier
// =====================================================================
bool verify_onebend_drawing(const graph& G, OneBendResult& result, std::string& report) {
    char buf[256];
    report.clear();
    bool ok = true;
    node v;
    edge e;

    const int Deff = std::max(5, result.stats.delta_eff);
    const int D3 = Deff - 3;
    const ll k = std::max((ll)1, (ll)result.stats.k);

    // --- Knoten: Gitter, Eindeutigkeit, I.4 (y = Vielfaches von k) ---
    std::map<Pt, node> node_at;
    forall_nodes(v, G) {
        point p = result.pos[v];
        if (!is_integral(p.xcoord()) || !is_integral(p.ycoord())) {
            report += "FEHLER: Knoten nicht auf Gitterpunkt\n"; ok = false;
        }
        Pt q{ ll_of(p.xcoord()), ll_of(p.ycoord()) };
        if (G.number_of_nodes() > 1 && node_at.count(q)) {
            report += "FEHLER: Zwei Knoten auf derselben Position\n"; ok = false;
        }
        node_at[q] = v;
        if (G.number_of_nodes() >= 3 && q.y % k != 0) {
            report += "FEHLER: Knoten-y kein Vielfaches von k (I.4)\n"; ok = false;
        }
    }

    // --- Segmente sammeln, Knicke/Steigungen/Formen pruefen ---
    std::vector<Seg> segs;
    std::vector<std::pair<node, node> > seg_nodes;
    std::set<std::pair<ll, ll> > slopes_used;
    int edge_id = 0;

    forall_edges(e, G) {
        node s = G.source(e), t = G.target(e);
        bool is_base = (s == result.v1 && t == result.v2) ||
                       (s == result.v2 && t == result.v1);
        // kanonische Richtung: frueherer Teil -> spaeterer Teil;
        // die Basiskante (v1,v2) wird von v1 aus gelesen.
        bool fwd = is_base ? (s == result.v1) : result.part[s] <= result.part[t];
        node src = fwd ? s : t, tgt = fwd ? t : s;

        std::vector<Pt> pl;
        pl.push_back(Pt{ ll_of(result.pos[src].xcoord()), ll_of(result.pos[src].ycoord()) });
        point bp;
        if (result.bends[e].size() > 1) {
            report += "FEHLER: Kante mit mehr als einem Knick\n"; ok = false;
        }
        forall(bp, result.bends[e]) {
            if (!is_integral(bp.xcoord()) || !is_integral(bp.ycoord())) {
                report += "FEHLER: Knick nicht auf Gitterpunkt\n"; ok = false;
            }
            pl.push_back(Pt{ ll_of(bp.xcoord()), ll_of(bp.ycoord()) });
        }
        pl.push_back(Pt{ ll_of(result.pos[tgt].xcoord()), ll_of(result.pos[tgt].ycoord()) });

        std::vector<Pt> clean;
        for (size_t j = 0; j < pl.size(); j++)
            if (clean.empty() || !(clean.back() == pl[j])) clean.push_back(pl[j]);

        std::vector<SlopeClass> cls;
        for (size_t j = 0; j + 1 < clean.size(); j++) {
            Seg sg; sg.a = clean[j]; sg.b = clean[j + 1]; sg.edge_id = edge_id;
            segs.push_back(sg);
            seg_nodes.push_back(std::make_pair(s, t));
            ll dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y;
            SlopeClass c = classify_slope(dx, dy, k, D3);
            cls.push_back(c);
            if (c == SC_BAD) {
                report += "FEHLER: Segmentsteigung nicht in S\n"; ok = false;
            }
            // Steigung normiert erfassen
            if (dx == 0) slopes_used.insert(std::make_pair((ll)1, (ll)0));
            else {
                ll g = gcd_ll(dy, dx);
                ll ny = dy / g, nx = dx / g;
                if (nx < 0) { nx = -nx; ny = -ny; }
                slopes_used.insert(std::make_pair(ny, nx));
            }
        }

        // Kantenform je Farbe (I.5); (v1,v2) hat die Sonderform
        // [vertikal an v1, flach 1/D3 an v2].
        int col = result.color[e];
        bool shape_ok = true;
        if (G.number_of_nodes() >= 3) {
            if (is_base) {
                shape_ok = cls.size() == 2 && cls[0] == SC_VERTICAL && cls[1] == SC_FLAT;
            } else if (col == OB_BLACK) {
                shape_ok = cls.size() == 1 && cls[0] == SC_HORIZONTAL;
            } else if (col == OB_BLUE) {
                shape_ok = cls.size() == 2 &&
                           (cls[0] == SC_VERTICAL || cls[0] == SC_RSTEEP) &&
                           cls[1] == SC_HORIZONTAL;
            } else if (col == OB_GREEN) {
                shape_ok = cls.size() == 2 &&
                           (cls[0] == SC_VERTICAL || cls[0] == SC_LSTEEP) &&
                           cls[1] == SC_HORIZONTAL;
            } else if (col == OB_RED) {
                shape_ok = (cls.size() == 1 && cls[0] == SC_VERTICAL) ||
                           (cls.size() == 2 && cls[0] == SC_VERTICAL && cls[1] == SC_FLAT);
            }
            if (!shape_ok) {
                snprintf(buf, sizeof buf,
                         "FEHLER: Kantenform verletzt I.5 (Farbe %d, %d Segmente)\n",
                         col, (int)cls.size());
                report += buf; ok = false;
            }
        }
        edge_id++;
    }

    result.stats.slopes_used = (int)slopes_used.size();

    // Designschranke |S| und strikte Papier-Schranke
    if ((int)slopes_used.size() > 3 * Deff - 8 && G.number_of_nodes() >= 3) {
        snprintf(buf, sizeof buf, "FEHLER: %d Steigungen > |S| = %d\n",
                 (int)slopes_used.size(), 3 * Deff - 8);
        report += buf; ok = false;
    }
    {
        int d = result.stats.delta_orig;
        int strict = result.stats.augmented ? (9 * d + 1) / 2 + 1
                                            : 3 * std::max(d, 5) - 8;
        strict = std::max(strict, 2);
        if ((int)slopes_used.size() > strict) {
            snprintf(buf, sizeof buf,
                     "FEHLER: %d Steigungen, strikte Schranke ist %d\n",
                     (int)slopes_used.size(), strict);
            report += buf; ok = false;
        }
    }

    // --- Planaritaet ---
    long long crossings = 0;
    for (size_t a = 0; a < segs.size() && crossings < 20; a++) {
        for (size_t b = a + 1; b < segs.size() && crossings < 20; b++) {
            Pt touch{0, 0};
            int r = seg_intersect(segs[a], segs[b], &touch);
            if (r == 0) continue;
            if (segs[a].edge_id == segs[b].edge_id) {
                if (r == 2) {
                    report += "FEHLER: Kante ueberlappt/kreuzt sich selbst\n";
                    ok = false; crossings++;
                }
                continue;
            }
            if (r == 2) {
                snprintf(buf, sizeof buf,
                         "FEHLER: Kreuzung/Ueberlappung (Kanten %d/%d)\n",
                         segs[a].edge_id, segs[b].edge_id);
                report += buf; ok = false; crossings++;
                continue;
            }
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

    // --- Knoten nicht im Inneren fremder Kanten ---
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

    // --- Flaechenschranken: 12*Deff*N^2 x 18*Deff*N^3, N = max(n,6) ---
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
    {
        const ll N = std::max((ll)result.stats.n, (ll)6);
        const ll wb = 12LL * Deff * N * N;
        const ll hb = 18LL * Deff * N * N * N;
        if (result.stats.width > wb) {
            snprintf(buf, sizeof buf, "FEHLER: Breite %lld > 12*Deff*N^2 = %lld\n",
                     result.stats.width, wb);
            report += buf; ok = false;
        }
        if (result.stats.height > hb) {
            snprintf(buf, sizeof buf, "FEHLER: Hoehe %lld > 18*Deff*N^3 = %lld\n",
                     result.stats.height, hb);
            report += buf; ok = false;
        }
    }

    snprintf(buf, sizeof buf,
             "n=%d m=%d Delta=%d Deff=%d k=%lld | Steigungen: %d/%d | "
             "Gitter: %lld x %lld | Teile: %d%s%s\n",
             result.stats.n, result.stats.m, result.stats.delta_orig,
             result.stats.delta_eff, result.stats.k,
             result.stats.slopes_used, result.stats.slopes_allowed,
             result.stats.width, result.stats.height, result.stats.parts,
             result.stats.augmented ? " | augmentiert" : "",
             result.stats.special_vn ? " | Sonderfall vn" : "");
    report = std::string(buf) + report;
    report += ok ? "VERIFIKATION: PASS" : "VERIFIKATION: FAIL";
    return ok;
}
