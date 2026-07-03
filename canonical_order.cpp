// =====================================================================
// Kanonische Ordnung per Reverse Peeling (siehe canonical_order.h).
//
// Arbeitsweise: Das Rotationssystem des LEDA-Maps wird in eine
// indexbasierte Struktur kopiert; Schaelen setzt nur eine Alive-Maske.
// Konturen entstehen als Flaechenwalk ab einem festen Anker-Dart der
// Kante (v1,v2) -- beim Entfernen von Knoten verschmelzen deren
// Flaechen automatisch mit der Aussenflaeche des induzierten Graphen.
// Ein Schaelschritt (Singleton oder Kette) ist legal, wenn danach die
// Bedingungen aus dem Paper direkt nachgeprueft werden koennen:
// Restgraph bikonnektiert + intern 3-zusammenhaengend (Apex-Trick),
// Nachbarn des entfernten Teils auf der neuen Kontur (ii) und jeder
// entfernte Knoten mit bereits geschaeltem Nachbarn (iv). Nach Kants
// Existenzlemma bleibt der Greedy so nie stecken.
// =====================================================================

#include "canonical_order.h"

#include <algorithm>
#include <set>
#include <climits>
#include <cstdio>

using namespace leda;

namespace {

// ---------------------------------------------------------------------
// Indexbasiertes Rotationssystem (Uhrzeigersinn wie LEDA-Maps)
// ---------------------------------------------------------------------
struct Emb {
    int n;
    std::vector<std::vector<int> > rot;   // rot[u] = Nachbarn in cw-Ordnung
    std::vector<char> alive;

    int deg_alive(int u) const {
        int d = 0;
        for (size_t j = 0; j < rot[u].size(); j++) if (alive[rot[u][j]]) d++;
        return d;
    }
    bool adjacent(int u, int v) const {
        for (size_t j = 0; j < rot[u].size(); j++) if (rot[u][j] == v) return true;
        return false;
    }
    // face_cycle_succ des Darts (u->v) im lebendig-induzierten Graphen:
    // an v den Eintrag u suchen, dann zyklischer Vorgaenger (tote
    // Nachbarn werden uebersprungen).
    bool face_succ(int u, int v, int& nu, int& nv) const {
        const std::vector<int>& rv = rot[v];
        const int L = (int)rv.size();
        int p = -1;
        for (int j = 0; j < L; j++) if (rv[j] == u) { p = j; break; }
        if (p < 0) return false;
        for (int step = 1; step <= L; step++) {
            int q = ((p - step) % L + L) % L;
            if (alive[rv[q]]) { nu = v; nv = rv[q]; return true; }
        }
        return false;
    }
};

void build_emb(const graph& G, node_array<int>& id, std::vector<node>& byid, Emb& E) {
    const int n = G.number_of_nodes();
    id.init(G, -1);
    byid.assign(n, (node)nil);
    int next = 0;
    node v;
    forall_nodes(v, G) { id[v] = next; byid[next] = v; next++; }
    E.n = n;
    E.rot.assign(n, std::vector<int>());
    E.alive.assign(n, 1);
    forall_nodes(v, G) {
        edge e;
        forall_adj_edges(e, v) E.rot[id[v]].push_back(id[G.opposite(v, e)]);
    }
}

// Flaechenwalk ab Dart (a->b); liefert die Quellknoten der Darts.
bool face_walk(const Emb& E, int a, int b, std::vector<int>& walk) {
    walk.clear();
    if (a < 0 || b < 0 || !E.alive[a] || !E.alive[b]) return false;
    long limit = 8;
    for (int u = 0; u < E.n; u++) limit += (long)E.rot[u].size();
    long guard = 0;
    int u = a, v = b;
    do {
        walk.push_back(u);
        int nu, nv;
        if (!E.face_succ(u, v, nu, nv)) return false;
        u = nu; v = nv;
        if (++guard > limit) return false;
    } while (u != a || v != b);
    return true;
}

// ---------------------------------------------------------------------
// Bikonnektivitaet des induzierten Graphen (ohne skip); optional mit
// Apex-Knoten (Id n), der mit allen markierten Knoten verbunden ist.
// ---------------------------------------------------------------------
struct Bicon {
    const Emb* E;
    int skip;
    const std::vector<char>* in_apex;   // NULL = kein Apex
    std::vector<int> num, low, par;
    int cnt;
    bool has_art;

    void nbrs(int u, std::vector<int>& out) const {
        out.clear();
        if (u == E->n) {
            for (int w = 0; w < E->n; w++)
                if ((*in_apex)[w]) out.push_back(w);
        } else {
            for (size_t j = 0; j < E->rot[u].size(); j++) {
                int w = E->rot[u][j];
                if (E->alive[w] && w != skip) out.push_back(w);
            }
            if (in_apex && (*in_apex)[u]) out.push_back(E->n);
        }
    }
    void dfs(int u) {
        num[u] = low[u] = cnt++;
        int children = 0;
        std::vector<int> nb;
        nbrs(u, nb);
        for (size_t j = 0; j < nb.size() && !has_art; j++) {
            int w = nb[j];
            if (num[w] < 0) {
                par[w] = u;
                children++;
                dfs(w);
                low[u] = std::min(low[u], low[w]);
                if (par[u] >= 0 && low[w] >= num[u]) has_art = true;
            } else if (w != par[u]) {
                low[u] = std::min(low[u], num[w]);
            }
        }
        if (par[u] < 0 && children >= 2) has_art = true;
    }
};

bool induced_biconnected(const Emb& E, int skip, const std::vector<char>* apex_mask) {
    int V = 0, start = -1;
    for (int u = 0; u < E.n; u++)
        if (E.alive[u] && u != skip) { V++; if (start < 0) start = u; }
    if (apex_mask) { V++; }
    if (V <= 1) return true;

    Bicon B;
    B.E = &E; B.skip = skip; B.in_apex = apex_mask;
    B.num.assign(E.n + 1, -1);
    B.low.assign(E.n + 1, 0);
    B.par.assign(E.n + 1, -1);
    B.cnt = 0;
    B.has_art = false;
    B.dfs(start);
    return !B.has_art && B.cnt == V;
}

// Intern 3-zusammenhaengend: Apex an alle Aussenzyklus-Knoten ergibt
// einen 3-zusammenhaengenden Graphen (Brute-Force wie LEDA: fuer jeden
// Knoten x muss der Graph minus x bikonnektiert bleiben).
bool internally_triconnected(const Emb& E, const std::vector<int>& outer) {
    int N = 0;
    for (int u = 0; u < E.n; u++) if (E.alive[u]) N++;
    if (N + 1 <= 3) return true;
    if (!induced_biconnected(E, -1, NULL)) return false;   // Apex entfernt
    std::vector<char> apex_mask(E.n, 0);
    for (size_t j = 0; j < outer.size(); j++)
        if (E.alive[outer[j]]) apex_mask[outer[j]] = 1;
    for (int x = 0; x < E.n; x++) {
        if (!E.alive[x]) continue;
        std::vector<char> mask = apex_mask;
        mask[x] = 0;
        if (!induced_biconnected(E, x, &mask)) return false;
    }
    return true;
}

// Kontur [v1 ... v2] aus dem Aussenwalk ab Anker-Dart; false wenn der
// Walk keinen simplen Zyklus bildet.
bool contour_of(const Emb& E, int a_out, int b_out, int v1, int v2,
                std::vector<int>& C) {
    std::vector<int> walk;
    if (!face_walk(E, a_out, b_out, walk)) return false;
    std::set<int> seen;
    for (size_t j = 0; j < walk.size(); j++)
        if (!seen.insert(walk[j]).second) return false;
    if (walk.size() < 2) return false;
    C.clear();
    if (a_out == v1) {
        // Zyklus v1 -> v2 -> x -> ... -> z -> v1; Kontur = v1, z, ..., x, v2
        C.push_back(v1);
        for (size_t j = walk.size(); j >= 3; j--) C.push_back(walk[j - 1]);
        C.push_back(v2);
    } else {
        // Zyklus v2 -> v1 -> x -> ... -> z -> v2; Kontur = v1, x, ..., z, v2
        C.push_back(v1);
        for (size_t j = 2; j < walk.size(); j++) C.push_back(walk[j]);
        C.push_back(v2);
    }
    return true;
}

// ---------------------------------------------------------------------
// Reverse Peeling
// ---------------------------------------------------------------------
struct Peeler {
    Emb E;
    std::vector<int> peeled_nbrs;
    int v1, v2, vn;
    int a_out, b_out;
    std::vector<std::vector<int> > parts_rev;

    bool contour(std::vector<int>& C) const {
        return contour_of(E, a_out, b_out, v1, v2, C);
    }

    // Teil tentativ entfernen und Zustand validieren; bei Erfolg commit.
    bool try_remove(const std::vector<int>& part, bool first) {
        if (!first)
            for (size_t a = 0; a < part.size(); a++)
                if (peeled_nbrs[part[a]] == 0) return false;
        for (size_t a = 0; a < part.size(); a++) E.alive[part[a]] = 0;

        bool ok = true;
        std::vector<int> C_new;
        if (!contour(C_new)) ok = false;
        if (ok && !induced_biconnected(E, -1, NULL)) ok = false;
        if (ok && !internally_triconnected(E, C_new)) ok = false;
        if (ok) {
            // (ii): lebendige Nachbarn des Teils liegen auf der neuen Kontur
            std::set<int> onC(C_new.begin(), C_new.end());
            for (size_t a = 0; a < part.size() && ok; a++) {
                int z = part[a];
                for (size_t j = 0; j < E.rot[z].size(); j++) {
                    int y = E.rot[z][j];
                    if (E.alive[y] && !onC.count(y)) { ok = false; break; }
                }
            }
        }
        if (!ok) {
            for (size_t a = 0; a < part.size(); a++) E.alive[part[a]] = 1;
            return false;
        }
        for (size_t a = 0; a < part.size(); a++) {
            int z = part[a];
            for (size_t j = 0; j < E.rot[z].size(); j++) {
                int y = E.rot[z][j];
                if (E.alive[y]) peeled_nbrs[y]++;
            }
        }
        parts_rev.push_back(part);
        return true;
    }

    bool is_cycle() const {
        for (int u = 0; u < E.n; u++)
            if (E.alive[u] && E.deg_alive(u) != 2) return false;
        return true;
    }

    bool run(std::string& error) {
        std::vector<int> first_part(1, vn);
        if (!try_remove(first_part, true)) {
            error = "vn nicht als erster Singleton schaelbar";
            return false;
        }
        while (!is_cycle()) {
            std::vector<int> C;
            if (!contour(C)) { error = "Kontur inkonsistent"; return false; }
            bool progressed = false;
            // Ketten: maximale Laeufe innerer Konturknoten mit Grad 2
            for (size_t j = 1; j + 1 < C.size() && !progressed; j++) {
                if (E.deg_alive(C[j]) != 2) continue;
                size_t k2 = j;
                std::vector<int> run1;
                while (k2 + 1 < C.size() && E.deg_alive(C[k2]) == 2) {
                    run1.push_back(C[k2]);
                    k2++;
                }
                if (try_remove(run1, false)) progressed = true;
                else j = k2 - 1;   // hinter den Lauf springen
            }
            // Singletons (Grad >= 3)
            for (size_t j = 1; j + 1 < C.size() && !progressed; j++) {
                if (E.deg_alive(C[j]) < 3) continue;
                std::vector<int> s1(1, C[j]);
                if (try_remove(s1, false)) progressed = true;
            }
            if (!progressed) { error = "Kein legaler Schaelschritt"; return false; }
        }
        std::vector<int> C;
        if (!contour(C)) { error = "Kontur inkonsistent (Restzyklus)"; return false; }
        if (C.size() < 3) { error = "Restzyklus zu klein"; return false; }
        std::vector<int> p1(C.begin() + 1, C.end() - 1);
        parts_rev.push_back(p1);
        return true;
    }
};

} // namespace

// =====================================================================
// Berechnung
// =====================================================================
bool compute_canonical_order(const graph& G, CanonicalOrder& order,
                             std::string& error) {
    error.clear();
    order.parts.clear();
    order.v1 = order.v2 = order.vn = nil;
    const int n = G.number_of_nodes();
    if (n < 3) { error = "Kanonische Ordnung braucht n >= 3."; return false; }

    node_array<int> id;
    std::vector<node> byid;
    Emb E0;
    build_emb(G, id, byid, E0);

    if (n == 3) {
        order.v1 = byid[0]; order.v2 = byid[1]; order.vn = byid[2];
        std::vector<node> p0;
        p0.push_back(order.v1); p0.push_back(order.v2);
        order.parts.push_back(p0);
        order.parts.push_back(std::vector<node>(1, order.vn));
        return check_canonical_order(G, order, error);
    }

    int mind = INT_MAX;
    for (int u = 0; u < n; u++) mind = std::min(mind, (int)E0.rot[u].size());

    // vn = Knoten minimalen Grades; alle Flaechen an vn und beide
    // Richtungen als Rueckfallebenen durchprobieren.
    for (int u = 0; u < n; u++) {
        if ((int)E0.rot[u].size() != mind) continue;
        for (size_t di = 0; di < E0.rot[u].size(); di++) {
            std::vector<int> F;
            if (!face_walk(E0, u, E0.rot[u][di], F)) continue;
            const int L = (int)F.size();
            if (L < 3) continue;
            for (int dir = 0; dir < 2; dir++) {
                Peeler P;
                P.E = E0;
                P.peeled_nbrs.assign(n, 0);
                P.vn = u;
                if (dir == 0) {
                    P.v1 = F[1]; P.v2 = F[2];
                    P.a_out = P.v1; P.b_out = P.v2;
                } else {
                    P.v1 = F[L - 1]; P.v2 = F[L - 2];
                    P.a_out = P.v2; P.b_out = P.v1;
                }
                if (P.v1 == u || P.v2 == u || P.v1 == P.v2) continue;
                std::string perr;
                if (!P.run(perr)) {
                    if (error.empty()) error = perr;
                    continue;
                }
                order.v1 = byid[P.v1];
                order.v2 = byid[P.v2];
                order.vn = byid[u];
                order.parts.clear();
                std::vector<node> p0;
                p0.push_back(order.v1); p0.push_back(order.v2);
                order.parts.push_back(p0);
                for (int i = (int)P.parts_rev.size() - 1; i >= 0; i--) {
                    std::vector<node> part;
                    for (size_t a = 0; a < P.parts_rev[i].size(); a++)
                        part.push_back(byid[P.parts_rev[i][a]]);
                    order.parts.push_back(part);
                }
                std::string cerr_;
                if (check_canonical_order(G, order, cerr_)) {
                    error.clear();
                    return true;
                }
                error = "Checker lehnt Ordnung ab: " + cerr_;
            }
        }
    }
    if (error.empty()) error = "Keine kanonische Ordnung gefunden.";
    return false;
}

// =====================================================================
// Checker: validiert (i)-(iv) unabhaengig von der Berechnung
// =====================================================================
bool check_canonical_order(const graph& G, const CanonicalOrder& order,
                           std::string& error) {
    char buf[192];
    error.clear();
    const int n = G.number_of_nodes();
    const std::vector<std::vector<node> >& parts = order.parts;
    const int m = (int)parts.size() - 1;

    if (m < 1) { error = "Ordnung hat weniger als zwei Teile."; return false; }
    if (order.v1 == nil || order.v2 == nil || order.vn == nil) {
        error = "v1/v2/vn nicht gesetzt.";
        return false;
    }

    node_array<int> id;
    std::vector<node> byid;
    Emb E;
    build_emb(G, id, byid, E);
    const int iv1 = id[order.v1], iv2 = id[order.v2], ivn = id[order.vn];

    // Partition + Teilindex
    std::vector<int> pidx(n, -1);
    for (int i = 0; i <= m; i++) {
        if (parts[i].empty()) { error = "Leerer Teil."; return false; }
        for (size_t a = 0; a < parts[i].size(); a++) {
            int u = id[parts[i][a]];
            if (pidx[u] != -1) { error = "Knoten mehrfach in der Partition."; return false; }
            pidx[u] = i;
        }
    }
    for (int u = 0; u < n; u++)
        if (pidx[u] < 0) { error = "Knoten fehlt in der Partition."; return false; }

    if (parts[0].size() != 2 ||
        !((id[parts[0][0]] == iv1 && id[parts[0][1]] == iv2) ||
          (id[parts[0][0]] == iv2 && id[parts[0][1]] == iv1))) {
        error = "P_0 != {v1, v2}.";
        return false;
    }
    if (parts[m].size() != 1 || id[parts[m][0]] != ivn) {
        error = "P_m != {vn}.";
        return false;
    }
    if (!E.adjacent(iv1, iv2)) { error = "Kante (v1,v2) fehlt."; return false; }
    if (!E.adjacent(iv1, ivn)) { error = "Kante (v1,vn) fehlt."; return false; }

    // Aussenflaeche: einer der beiden Walks an (v1,v2) muss auch die
    // Kante (v1,vn) enthalten (vn konsekutiv zu v1).
    int a_out = -1, b_out = -1;
    for (int dir = 0; dir < 2 && a_out < 0; dir++) {
        int a = dir == 0 ? iv1 : iv2;
        int b = dir == 0 ? iv2 : iv1;
        std::vector<int> F;
        if (!face_walk(E, a, b, F)) continue;
        const int L = (int)F.size();
        for (int j = 0; j < L; j++) {
            int x = F[j], y = F[(j + 1) % L];
            if ((x == iv1 && y == ivn) || (x == ivn && y == iv1)) {
                a_out = a; b_out = b;
                break;
            }
        }
    }
    if (a_out < 0) {
        error = "(v1,v2) und (v1,vn) liegen auf keiner gemeinsamen Flaeche.";
        return false;
    }

    // Levelweise Pruefung
    for (int u = 0; u < n; u++) E.alive[u] = 0;
    E.alive[iv1] = E.alive[iv2] = 1;
    std::vector<int> Cprev;
    Cprev.push_back(iv1);
    Cprev.push_back(iv2);

    for (int i = 1; i <= m; i++) {
        // (ii) vor der Aktivierung: Nachbarn von P_i in G_{i-1} auf C_{i-1}
        std::set<int> onC(Cprev.begin(), Cprev.end());
        for (size_t a = 0; a < parts[i].size(); a++) {
            int z = id[parts[i][a]];
            for (size_t j = 0; j < E.rot[z].size(); j++) {
                int y = E.rot[z][j];
                if (E.alive[y] && !onC.count(y)) {
                    snprintf(buf, sizeof buf,
                             "(ii) verletzt: Nachbar von P_%d nicht auf C_%d.", i, i - 1);
                    error = buf;
                    return false;
                }
            }
        }

        for (size_t a = 0; a < parts[i].size(); a++) E.alive[id[parts[i][a]]] = 1;

        // (iii): Kette => alle Grade in G_i genau 2 und Teil ist Pfad
        if (parts[i].size() >= 2) {
            for (size_t a = 0; a < parts[i].size(); a++) {
                if (E.deg_alive(id[parts[i][a]]) != 2) {
                    snprintf(buf, sizeof buf,
                             "(iii) verletzt: Kettenknoten in P_%d hat Grad != 2.", i);
                    error = buf;
                    return false;
                }
                if (a + 1 < parts[i].size() &&
                    !E.adjacent(id[parts[i][a]], id[parts[i][a + 1]])) {
                    snprintf(buf, sizeof buf, "P_%d ist kein Pfad.", i);
                    error = buf;
                    return false;
                }
            }
        }

        // Kontur von G_i
        std::vector<int> C;
        if (!contour_of(E, a_out, b_out, iv1, iv2, C)) {
            snprintf(buf, sizeof buf, "Aussenzyklus von G_%d nicht simpel.", i);
            error = buf;
            return false;
        }

        // (i) fuer i <= m-1
        if (i <= m - 1) {
            if (!induced_biconnected(E, -1, NULL)) {
                snprintf(buf, sizeof buf, "(i) verletzt: G_%d nicht bikonnektiert.", i);
                error = buf;
                return false;
            }
            if (!internally_triconnected(E, C)) {
                snprintf(buf, sizeof buf,
                         "(i) verletzt: G_%d nicht intern 3-zusammenhaengend.", i);
                error = buf;
                return false;
            }
        }

        // (iv) fuer i <= m-1
        if (i <= m - 1) {
            for (size_t a = 0; a < parts[i].size(); a++) {
                int z = id[parts[i][a]];
                bool later = false;
                for (size_t j = 0; j < E.rot[z].size() && !later; j++)
                    if (pidx[E.rot[z][j]] > i) later = true;
                if (!later) {
                    snprintf(buf, sizeof buf,
                             "(iv) verletzt: Knoten in P_%d ohne spaeteren Nachbarn.", i);
                    error = buf;
                    return false;
                }
            }
        }

        Cprev = C;
    }
    return true;
}
