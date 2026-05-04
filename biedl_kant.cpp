// =====================================================================
// Implementation of the Biedl-Kant Algorithm for Planar Graph Drawing
// =====================================================================

#include <LEDA/graphics/graphwin.h>
#include <LEDA/graph/graph.h>
#include <LEDA/graph/graph_alg.h>
#include <vector>
#include <algorithm>
#include <iostream> 

using namespace leda;
using std::cout;
using std::endl;

// =====================================================================
// HILFSFUNKTION: Column Shift für überschneidungsfreies Routing
// =====================================================================
void shift_right(int target_x, graph& G, node_array<int>& x_node, edge_array<int>& x_edge, edge_array<list<point>>& bends_array, node_array<int>& st_numbering, int current_st, int& x_max, int grid_size) {
    
    x_max++;
    
    node w;
    forall_nodes(w, G) {
        if (st_numbering[w] <= current_st && x_node[w] >= target_x) x_node[w]++;
    }
    edge e;
    forall_edges(e, G) {
        node u = G.source(e);
        node tgt = G.target(e);
        if (st_numbering[u] <= current_st || st_numbering[tgt] <= current_st) {
            if (x_edge[e] >= target_x) x_edge[e]++;
        }
        if (!bends_array[e].empty()) {
            list<point> shifted_bends;
            point p;
            forall(p, bends_array[e]) {
                if (p.xcoord() >= target_x * grid_size) {
                    shifted_bends.append(point(p.xcoord() + grid_size, p.ycoord()));
                } else {
                    shifted_bends.append(p);
                }
            }
            bends_array[e] = shifted_bends;
        }
    }
}

// =====================================================================
// MAIN ALGORITHMUS
// =====================================================================
int main() {
    graph G;
    GraphWin gw(G, "Planar Graph Drawing - Biedl-Kant Algorithm");
    gw.set_directed(false);
    gw.set_node_shape(gw_node_shape::rectangle_node);
    gw.set_node_width(50); 
    gw.set_node_height(30);
    gw.set_node_label_font(gw_font_type::italic_font, 9);
    gw.open(window::center, window::center);

    edge e;

    while (gw.edit()) {
        gw.save_all_attributes();
        cout << "\n=============================================" << endl;
        cout << "[DEBUG] Neuer Durchlauf gestartet (Done geklickt)" << endl;

        // -------------------------------------------------------------
        // Phase 1: Planarität & Grad prüfen
        // -------------------------------------------------------------
        cout << "[DEBUG] Phase 1: Mache Graph bidirektional..." << endl;
        list<edge> reverse_edges;
        G.make_bidirected(reverse_edges);
        
        if (!PLANAR(G, true)) {
            gw.message("Der Graph ist nicht planar. Bitte ändern.");
            forall(e, reverse_edges) { G.del_edge(e); }
            continue;
        }

        int max_deg = 0;
        node v;
        forall_nodes(v, G) {
            if (outdeg(v) > max_deg) max_deg = outdeg(v);
        }
        if (max_deg > 4) {
            gw.message("Knotengrad > 4 erkannt.");
            forall(e, reverse_edges) { G.del_edge(e); }
            continue;
        }

        // -------------------------------------------------------------
        // Phase 2: Smart Source/Sink & Biconnectivity
        // -------------------------------------------------------------
        edge optimal_st_edge = nil;
        edge search_e;
        forall_edges(search_e, G) {
            if (outdeg(G.target(search_e)) <= 3) {
                optimal_st_edge = search_e;
                break;
            }
        }
        if (optimal_st_edge == nil) optimal_st_edge = G.first_edge();

        cout << "[DEBUG] Phase 2: Make_Biconnected..." << endl;
        list<edge> biconnected_edges = Make_Biconnected(G);
        list<edge> dummy_reversals;

        edge_array<bool> is_dummy(G, false);

        forall(e, biconnected_edges) {
            edge rev = G.new_edge(G.target(e), G.source(e));
            G.set_reversal(e, rev);
            G.set_reversal(rev, e);
            dummy_reversals.append(rev);
            is_dummy[rev] = true;
            is_dummy[e] = true;
        }
        
        // -------------------------------------------------------------
        // Phase 3: ST-Numbering
        // -------------------------------------------------------------
        cout << "[DEBUG] Phase 3: Berechne ST-Numbering..." << endl;
        node_array<int> st_numbering(G);
        list<node> st_list;
        
        // Nutzt deine manuelle Auswahl aus deinem Snippet
        // TODO: Use optimal_st_edge instead of hardcoded edge if needed
        if (!ST_NUMBERING(G, st_numbering, st_list)) {
            gw.message("ST-Numbering fehlgeschlagen!");
            forall(e, dummy_reversals) { G.del_edge(e); }
            forall(e, biconnected_edges) { G.del_edge(e); }
            forall(e, reverse_edges) { G.del_edge(e); }
            continue;
        }

        forall_nodes(v, G) {
            gw.set_label(v, string("%d (%d)", G.index(v), st_numbering[v]));
        }

        // -------------------------------------------------------------
        // Phase 4: Biedl-Kant Column Reuse Routing
        // -------------------------------------------------------------
        cout << "[DEBUG] Phase 4: Initialisiere Routing-Arrays..." << endl;
        edge_array<int> x_edge(G, 0);                 
        edge_array<list<point>> bends_array(G);       
        node_array<int> x_node(G, 0);                
        
        int x_max = 0; 
        int grid_size = 60; 

        forall(v, st_list) {
            int y_v = st_numbering[v];
            cout << "[DEBUG] Bearbeite Knoten " << G.index(v) << ": st_num=" << y_v << endl;
            
            std::vector<edge> real_in_edges; // Tatsächliche In-Edges
            std::vector<edge> ghost_in_edges; // In-Edges, die durch make_biconnected bzw. make_bidirected entstanden sind und später gelöscht werden.
            std::vector<edge> cycle; 

            forall_adj_edges(e, v) {
                cycle.push_back(e);
                node w = G.opposite(v, e);
                if (st_numbering[w] < y_v) {
                    edge rev = G.reversal(e);
                    if (rev != nil) {
                        if (is_dummy[rev]) ghost_in_edges.push_back(rev);
                        else real_in_edges.push_back(rev);
                    }
                }
            }

            std::sort(real_in_edges.begin(), real_in_edges.end(), [&x_edge](edge a, edge b) {
                return x_edge[a] < x_edge[b];
            });

            std::vector<edge> real_out_edges;
            std::vector<edge> all_out_edges;
            int deg = cycle.size();
            int start_idx = 0; 

            if (st_numbering[v] != 1 && st_numbering[v] != st_list.size()) { 
                for (int i = 0; i < deg; i++) {
                    edge curr_e = cycle[i];
                    edge next_e = cycle[(i + 1) % deg];
                    if (st_numbering[G.opposite(v, curr_e)] < y_v && st_numbering[G.opposite(v, next_e)] > y_v) {
                        start_idx = (i + 1) % deg; 
                        break;
                    }
                }
            }

            else if (st_numbering[v] == 1) {
                cout << "[DEBUG] Bearbeite globalen Startknoten (ST=1), suche Anker für Out-Liste..." << endl;
                for (int i = 0; i < deg; i++) {
                    edge current_e = cycle[i];
                    if (st_numbering[G.opposite(v, current_e)] == st_list.size()) {
                        cout << "[DEBUG] Gefunden: Kante " << G.index(current_e) << " verbindet Startknoten mit globalem Zielknoten. Setze Startindex auf " << i << "." << endl;
                        start_idx = i; 
                        break;
                    }
                }
            }

            for (int i = 0; i < deg; i++) {
                edge current_e = cycle[(start_idx + i) % deg];
                if (st_numbering[G.opposite(v, current_e)] > y_v) {
                    if (!is_dummy[current_e]) real_out_edges.push_back(current_e);
                    all_out_edges.push_back(current_e);
                }
            }

            int in_count = real_in_edges.size();
            int out_count = real_out_edges.size();

            // ==========================================
            // --- IN-EDGES VERTEILEN ---
            // ==========================================
            cout << "[DEBUG] xmax bisher: " << x_max << endl;
            cout << "[DEBUG] --- IN-EDGES VERTEILEN (in_count = " << in_count << ") ---" << endl;
            switch (in_count) {
                case 0: 
                    cout << "[DEBUG] Fall 0: Knoten " << G.index(v) << " hat keine echten eingehenden Kanten." << endl;
                    if (y_v == 1) {
                        x_node[v] = 0; 
                        cout << "[DEBUG] -> Ist der globale Startknoten (ST=1). Setze Spalte x=" << x_node[v] << "." << endl;
                    } else {
                        if (!ghost_in_edges.empty()) {
                            // Keine normale In-Edge vorhanden: Müssen die Ghost-Edge zur Orientierung nutzen, um das planare Embedding beizubehalten
                            x_node[v] = x_edge[ghost_in_edges.front()];
                            cout << "[DEBUG] -> Kein echter In-Edge, aber " << ghost_in_edges.size() << " Ghost-In-Edges gefunden. Erbe Spalte x=" << x_node[v] << " von erstem Ghost-In-Edge." << endl;
                        } else {
                            x_node[v] = ++x_max; 
                            cout << "[DEBUG] FEHLER! Nicht-Startknoten ohne in-edges! Erhält neue Spalte ganz rechts: x=" << x_node[v] << "." << endl;
                        }
                    }
                    break;

                case 1: 
                    x_node[v] = x_edge[real_in_edges[0]]; 
                    cout << "[DEBUG] Fall 1: Eine In-Kante. Knoten erbt direkt die Spalte x=" << x_node[v] << " (Bottom Port)." << endl;
                    break;

                case 2:
                    x_node[v] = x_edge[real_in_edges[1]];
                    cout << "[DEBUG] Fall 2: Zwei In-Kanten." << endl;
                    cout << "[DEBUG] -> Rechte Kante wird Stamm. Knoten zieht auf Spalte x=" << x_node[v] << " (Bottom Port)." << endl;
                    
                    bends_array[real_in_edges[0]].append(point(x_edge[real_in_edges[0]] * grid_size, y_v * grid_size));
                    cout << "[DEBUG] -> Linke Kante (kommt von x=" << x_edge[real_in_edges[0]] << ") knickt horizontal ab in den Left Port." << endl;
                    break;

                case 3:
                    x_node[v] = x_edge[real_in_edges[1]];
                    cout << "[DEBUG] Fall 3: Drei In-Kanten." << endl;
                    cout << "[DEBUG] -> Mittlere Kante wird Stamm. Knoten zieht auf Spalte x=" << x_node[v] << " (Bottom Port)." << endl;
                    
                    bends_array[real_in_edges[0]].append(point(x_edge[real_in_edges[0]] * grid_size, y_v * grid_size));
                    cout << "[DEBUG] -> Linke Kante (kommt von x=" << x_edge[real_in_edges[0]] << ") knickt ab in den Left Port." << endl;
                    
                    bends_array[real_in_edges[2]].append(point(x_edge[real_in_edges[2]] * grid_size, y_v * grid_size));
                    cout << "[DEBUG] -> Rechte Kante (kommt von x=" << x_edge[real_in_edges[2]] << ") knickt ab in den Right Port." << endl;
                    break;

                case 4:
                    x_node[v] = x_edge[real_in_edges[1]];
                    cout << "[DEBUG] Fall 4: Vier In-Kanten (T-Knoten-Szenario)." << endl;
                    cout << "[DEBUG] -> Kante 2 von links wird Stamm. Knoten zieht auf Spalte x=" << x_node[v] << " (Bottom Port)." << endl;
                    
                    bends_array[real_in_edges[0]].append(point(x_edge[real_in_edges[0]] * grid_size, y_v * grid_size));
                    cout << "[DEBUG] -> Ganz linke Kante knickt ab in den Left Port." << endl;
                    
                    bends_array[real_in_edges[2]].append(point(x_edge[real_in_edges[2]] * grid_size, y_v * grid_size));
                    cout << "[DEBUG] -> Kante 3 knickt ab in den Right Port." << endl;
                    
                    // The Hook
                    bends_array[real_in_edges[3]].append(point(x_edge[real_in_edges[3]] * grid_size, (y_v + 1) * grid_size));
                    bends_array[real_in_edges[3]].append(point(x_node[v] * grid_size, (y_v + 1) * grid_size));
                    cout << "[DEBUG] -> THE HOOK! Rechteste Kante wird ueber den Knoten geworfen (Hoehe y=" << y_v + 1 << ") und faellt in den Top Port." << endl;
                    break;
            }

            // ==========================================
            // --- OUT-EDGES VERTEILEN ---
            // ==========================================
            cout << "[DEBUG] --- OUT-EDGES VERTEILEN (out_count = " << out_count << ") ---" << endl;
            switch (out_count) {
                case 0: 
                    cout << "[DEBUG] Fall 0: Keine ausgehenden Kanten (Senke / Zielknoten)." << endl;
                    break;

                case 1: 
                    x_edge[real_out_edges[0]] = x_node[v]; 
                    cout << "[DEBUG] Fall 1: Eine Aus-Kante. Schiesst schnurgerade nach oben auf x=" << x_node[v] << " (Top Port)." << endl;
                    break;

                case 2: {
                    cout << "[DEBUG] Fall 2: Zwei Aus-Kanten. Verwende oberen und rechten Port." << endl;

                    int right_col = x_node[v] + 1;
                    cout << "[DEBUG] -> Shifte alles ab Spalte x=" << right_col << " nach rechts, um Platz auf der rechten Seite zu machen." << endl;
                    shift_right(right_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    
                    x_edge[real_out_edges[0]] = x_node[v];        
                    x_edge[real_out_edges[1]] = right_col;        
                    
                    bends_array[real_out_edges[1]].append(point(right_col * grid_size, y_v * grid_size));
                    cout << "[DEBUG] -> Linke Kante belegt Top Port (Spalte " << x_node[v] << "), rechte Kante belegt Right Port (Spalte " << right_col << ")." << endl;
                    
                    break;
                }

                case 3: {
                    cout << "[DEBUG] Fall 3: Drei Aus-Kanten. Alle ausgehenden Ports (Links, Oben, Rechts) werden benoetigt!" << endl;
                    
                    int right_col = x_node[v] + 1;
                    cout << "[DEBUG] -> Shift 1: Mache Platz fuer die rechte Kante auf Spalte x=" << right_col << "." << endl;
                    shift_right(right_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    
                    int left_col = x_node[v];
                    cout << "[DEBUG] -> Shift 2: Mache Platz fuer die linke Kante auf Spalte x=" << left_col << "." << endl;
                    shift_right(left_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    
                    x_edge[real_out_edges[0]] = left_col;         
                    x_edge[real_out_edges[1]] = x_node[v];        
                    x_edge[real_out_edges[2]] = right_col + 1; // Muss +1 sein, da der 2. Shift die gesamte rechte Seite inkl. right_col verschoben hat!
                    
                    bends_array[real_out_edges[0]].append(point(left_col * grid_size, y_v * grid_size));
                    bends_array[real_out_edges[2]].append(point((right_col + 1) * grid_size, y_v * grid_size));
                    
                    cout << "[DEBUG] -> Zuweisung komplett:" << endl;
                    cout << "[DEBUG]    - Linke Kante: Left Port (Spalte " << left_col << ")" << endl;
                    cout << "[DEBUG]    - Mittlere Kante: Top Port (Spalte " << x_node[v] << ")" << endl;
                    cout << "[DEBUG]    - Rechte Kante: Right Port (Spalte " << right_col + 1 << ")" << endl;
                    break;
                }
                case 4: {
                    cout << "[DEBUG] Fall 4: Drei Aus-Kanten. Alle ausgehenden Ports (Links, Oben, Rechts) werden benoetigt, plus ein Haken am unteren Port!" << endl;
                    
                    int right_col = x_node[v] + 1;
                    cout << "[DEBUG] -> Shift 1: Mache Platz fuer die rechte Kante auf Spalte x=" << right_col << "." << endl;
                    shift_right(right_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);

                    cout << "[DEBUG] -> Shift 2: Mache Platz fuer die rechte Kante auf Spalte x=" << right_col + 1 << "." << endl;
                    shift_right(right_col + 1, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    
                    int left_col = x_node[v];
                    cout << "[DEBUG] -> Shift 3: Mache Platz fuer die linke Kante auf Spalte x=" << left_col << "." << endl;
                    shift_right(left_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    
                    x_edge[real_out_edges[0]] = left_col;         
                    x_edge[real_out_edges[1]] = x_node[v];        
                    x_edge[real_out_edges[2]] = right_col + 1;
                    x_edge[real_out_edges[3]] = right_col + 2;
                    
                    bends_array[real_out_edges[0]].append(point(left_col * grid_size, y_v * grid_size));
                    bends_array[real_out_edges[2]].append(point((right_col + 1) * grid_size, y_v * grid_size));

                    // Bottom hook
                    bends_array[real_out_edges[3]].append(point(x_node[v] * grid_size, (y_v - 0.5) * grid_size));
                    bends_array[real_out_edges[3]].append(point((right_col + 2) * grid_size, (y_v - 0.5) * grid_size));
                    
                    cout << "[DEBUG] -> Zuweisung komplett:" << endl;
                    cout << "[DEBUG]    - Linke Kante: Left Port (Spalte " << left_col << ")" << endl;
                    cout << "[DEBUG]    - Mittlere Kante: Top Port (Spalte " << x_node[v] << ")" << endl;
                    cout << "[DEBUG]    - Rechte Kante: Right Port (Spalte " << right_col + 1 << ")" << endl;
                    cout << "[DEBUG]    - Rechteste Kante: Bottom Port Hook (Spalte " << right_col + 2 << ")" << endl;
                    break;
                }
            }

            cout << "[DEBUG] Füge Spalten für Ghost-Out-Edges hinzu. all_out_edges.size() = " << all_out_edges.size() << ", real_out_edges.size() = " << real_out_edges.size() << ", x_max = " << x_max << endl;
            // Ghost-Out-Edges virtuell im Raster einfügen
            {
                cout << "[DEBUG] real_out_edges: ";
                for (int i = 0; i < real_out_edges.size(); i++)
                {
                    cout << st_numbering[G.opposite(v, real_out_edges[i])] << "(" << G.index(real_out_edges[i]) << ") ";
                }
                cout << endl;

                cout << "[DEBUG] all_out_edges: ";
                for (int i = 0; i < all_out_edges.size(); i++) 
                {
                    cout << st_numbering[G.opposite(v, all_out_edges[i])] << "(" << G.index(all_out_edges[i]) << ") ";
                }
                cout << endl;

                int curr_x = real_out_edges.empty() ? x_node[v] : x_edge[real_out_edges[0]];
                int i = 0, j = 0;

                while(i < all_out_edges.size()) {
                    int all_idx = (i < all_out_edges.size()) ? G.index(all_out_edges[i]) : -1;
                    int real_idx = (j < real_out_edges.size()) ? G.index(real_out_edges[j]) : -1;

                    if (all_idx == real_idx) {
                        curr_x = x_edge[real_out_edges[j]];
                        i++; j++;
                        continue;
                    }

                    shift_right(curr_x, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    x_edge[all_out_edges[i]] = curr_x++;
                    i++;
                } 
            }
            
        }

        // -------------------------------------------------------------
        // Phase 5: Cleanup & Visualisierung
        // -------------------------------------------------------------
        forall_edges(e, G) {
            if (!bends_array[e].empty()) {
                edge rev_e = G.reversal(e);
                if (rev_e && bends_array[rev_e].empty()) {
                    list<point> rev_bends = bends_array[e];
                    rev_bends.reverse(); 
                    bends_array[rev_e] = rev_bends;
                }
            }
        }

        gw.del_messages();
        
        // Alle zusätzlich eingefügten Kanten (Dummy-Reversals und Biconnected-Edges) entfernen, sowie die temporären Reversals der make_bidirected-Phase entfernen
        G.del_edges(reverse_edges);
        G.del_edges(dummy_reversals);
        G.del_edges(biconnected_edges);
        reverse_edges.clear(); 
        dummy_reversals.clear();
        biconnected_edges.clear();

        gw.update_graph(); 

        node u;
        forall(u, st_list) {
            int final_y = (st_numbering[u] + 1); 
            gw.set_position(u, point(x_node[u] * grid_size, final_y * grid_size));
        }

        forall_edges(e, G) {
            if (!bends_array[e].empty()) {
                list<point> final_bends;
                point p;
                forall(p, bends_array[e]) {
                    double original_st = p.ycoord() / grid_size;
                    double final_y = (original_st + 1);
                    final_bends.append(point(p.xcoord(), final_y * grid_size));
                }
                gw.set_bends(e, final_bends);
            }
        }

        gw.set_flush(true);
        gw.redraw();

        gw.message("Biedl-Kant Algorithmus erfolgreich beendet! OK fuer Reset.");
        gw.edit();
        gw.del_messages();

        gw.restore_all_attributes();
        gw.update_graph();
        gw.redraw();
    }

    return 0;
}