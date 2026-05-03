// =====================================================================
// Implementation of the Biedl-Kant Algorithm for Planar Graph Drawing
// =====================================================================

#include <LEDA/graphics/graphwin.h>
#include <LEDA/graph/graph.h>
#include <LEDA/graph/graph_alg.h>
#include <vector>
#include <algorithm>
#include <iostream> // Für cout

using namespace leda;
using std::cout;
using std::endl;

// =====================================================================
// HILFSFUNKTION: Column Shift für überschneidungsfreies Routing
// =====================================================================
void shift_right(int target_x, graph& G, node_array<int>& x_node, edge_array<int>& x_edge, edge_array<list<point>>& bends_array, node_array<int>& st_numbering, int current_st, int& x_max, int grid_size) {
    // cout << "[DEBUG] Shift Right aufgerufen fuer target_x=" << target_x << endl;
    if (target_x <= x_max) {
        x_max++;
    }
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
    gw.set_node_width(30); 
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
        
        cout << "[DEBUG] Phase 1: Teste Planaritaet..." << endl;
        if (!PLANAR(G, true)) {
            gw.message("Der Graph ist nicht planar. Bitte ändern.");
            forall(e, reverse_edges) { G.del_edge(e); }
            continue;
        }

        cout << "[DEBUG] Phase 1: Teste Knotengrade..." << endl;
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
        cout << "[DEBUG] Phase 2: Suche optimalen Start/Ziel..." << endl;
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

        // WICHTIGER FIX: Den neuen Dummy-Kanten Rückkanten geben!
        cout << "[DEBUG] Erstelle fehlende Reversals fuer Dummys..." << endl;
        edge dummy_e;
        forall(dummy_e, biconnected_edges) {
            edge rev = G.new_edge(G.target(dummy_e), G.source(dummy_e));
            G.set_reversal(dummy_e, rev);
            G.set_reversal(rev, dummy_e);
            dummy_reversals.append(rev);
        }
        
        // -------------------------------------------------------------
        // Phase 3: ST-Numbering
        // -------------------------------------------------------------
        cout << "[DEBUG] Phase 3: Berechne ST-Numbering..." << endl;
        node_array<int> st_numbering(G);
        list<node> st_list;
        if (!ST_NUMBERING(G, st_numbering, st_list, optimal_st_edge)) {
            cout << "[ERROR] ST-Numbering fehlgeschlagen!" << endl;
            gw.message("ST-Numbering fehlgeschlagen!");
            forall(e, dummy_reversals) { G.del_edge(e); }
            forall(e, biconnected_edges) { G.del_edge(e); }
            forall(e, reverse_edges) { G.del_edge(e); }
            continue;
        }
        cout << "[DEBUG] ST-Numbering erfolgreich. Knoten in st_list: " << st_list.size() << endl;

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
            cout << "\n[DEBUG] --> Bearbeite Knoten " << G.index(v) << " (ST=" << y_v << ")" << endl;
            
            std::vector<edge> in_edges;
            std::vector<edge> cycle;

            edge e;
            forall_adj_edges(e, v) {
                cycle.push_back(e);
                node w = G.opposite(v, e);
                if (st_numbering[w] < y_v) {
                    edge rev = G.reversal(e);
                    if (rev == nil) {
                        cout << "[FATAL ERROR] Rueckkante (reversal) ist nil fuer Kante zu ST=" << st_numbering[w] << endl;
                        // Ohne das Crash!
                        continue;
                    }
                    in_edges.push_back(rev); 
                }
            }

            cout << "[DEBUG] Kanten sortieren. In_Count = " << in_edges.size() << endl;
            std::sort(in_edges.begin(), in_edges.end(), [&x_edge](edge a, edge b) {
                return x_edge[a] < x_edge[b];
            });

            std::vector<edge> out_edges;
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

            for (int i = 0; i < deg; i++) {
                edge current_e = cycle[(start_idx + i) % deg];
                if (st_numbering[G.opposite(v, current_e)] > y_v) {
                    out_edges.push_back(current_e);
                }
            }

            int in_count = in_edges.size();
            int out_count = out_edges.size();
            cout << "[DEBUG] Verteile IN=" << in_count << " und OUT=" << out_count << " Kanten" << endl;

            // --- IN-EDGES VERTEILEN ---
            switch (in_count) {
                case 0: x_node[v] = 0; break;
                case 1: x_node[v] = x_edge[in_edges[0]]; break;
                case 2:
                    x_node[v] = x_edge[in_edges[1]];
                    bends_array[in_edges[0]].append(point(x_edge[in_edges[0]] * grid_size, y_v * grid_size));
                    break;
                case 3:
                    x_node[v] = x_edge[in_edges[1]];
                    bends_array[in_edges[0]].append(point(x_edge[in_edges[0]] * grid_size, y_v * grid_size));
                    bends_array[in_edges[2]].append(point(x_edge[in_edges[2]] * grid_size, y_v * grid_size));
                    break;
                case 4:
                    x_node[v] = x_edge[in_edges[1]];
                    bends_array[in_edges[0]].append(point(x_edge[in_edges[0]] * grid_size, y_v * grid_size));
                    bends_array[in_edges[3]].append(point(x_edge[in_edges[3]] * grid_size, y_v * grid_size));
                    bends_array[in_edges[2]].append(point(x_edge[in_edges[2]] * grid_size, (y_v + 1) * grid_size));
                    bends_array[in_edges[2]].append(point(x_node[v] * grid_size, (y_v + 1) * grid_size));
                    break;
                default:
                    cout << "[DEBUG] ACHTUNG: Default Case fuer in_count aufgerufen!" << endl;
                    if(in_count > 0) {
                        int mid = in_count / 2;
                        x_node[v] = x_edge[in_edges[mid]];
                        for (int i = 0; i < in_count; i++) {
                            if (i != mid) bends_array[in_edges[i]].append(point(x_edge[in_edges[i]] * grid_size, y_v * grid_size));
                        }
                    }
                    break;
            }

            // --- OUT-EDGES VERTEILEN ---
            switch (out_count) {
                case 0: break;
                case 1: x_edge[out_edges[0]] = x_node[v]; break;
                case 2: {
                    int free_col = x_node[v];
                    shift_right(free_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    x_edge[out_edges[0]] = free_col;         
                    x_edge[out_edges[1]] = x_node[v];        
                    bends_array[out_edges[0]].append(point(free_col * grid_size, y_v * grid_size));
                    break;
                }
                case 3: {
                    int right_col = x_node[v] + 1;
                    shift_right(right_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    int left_col = x_node[v];
                    shift_right(left_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                    x_edge[out_edges[0]] = left_col;         
                    x_edge[out_edges[1]] = x_node[v];        
                    x_edge[out_edges[2]] = right_col + 1;    
                    bends_array[out_edges[0]].append(point(left_col * grid_size, y_v * grid_size));
                    bends_array[out_edges[2]].append(point((right_col + 1) * grid_size, y_v * grid_size));
                    break;
                }
                default: {
                    cout << "[DEBUG] ACHTUNG: Default Case fuer out_count aufgerufen!" << endl;
                    int mid_out = out_count / 2;
                    x_edge[out_edges[mid_out]] = x_node[v];
                    for (int i = 0; i < mid_out; i++) {
                        int free_col = x_node[v];
                        shift_right(free_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                        x_edge[out_edges[i]] = free_col;
                        bends_array[out_edges[i]].append(point(free_col * grid_size, y_v * grid_size));
                    }
                    for (int i = mid_out + 1; i < out_count; i++) {
                        int right_col = x_node[v] + 1;
                        shift_right(right_col, G, x_node, x_edge, bends_array, st_numbering, y_v, x_max, grid_size);
                        x_edge[out_edges[i]] = right_col;
                        bends_array[out_edges[i]].append(point(right_col * grid_size, y_v * grid_size));
                    }
                    break;
                }
            }
        }
        cout << "[DEBUG] Phase 4 abgeschlossen!" << endl;

        // -------------------------------------------------------------
        // Phase 5: Cleanup & Visualisierung
        // -------------------------------------------------------------
        cout << "[DEBUG] Phase 5: Knicke auf Reverse Edges uebertragen..." << endl;
        edge edge_iter;
        forall_edges(edge_iter, G) {
            if (!bends_array[edge_iter].empty()) {
                edge rev_e = G.reversal(edge_iter);
                if (rev_e && bends_array[rev_e].empty()) {
                    list<point> rev_bends = bends_array[edge_iter];
                    rev_bends.reverse(); 
                    bends_array[rev_e] = rev_bends;
                }
            }
        }

        cout << "[DEBUG] Phase 5: Cleanup der Kanten..." << endl;
        gw.del_messages();
        
        forall(e, dummy_reversals) { G.del_edge(e); }
        dummy_reversals.clear();

        forall(e, reverse_edges) { G.del_edge(e); }
        reverse_edges.clear(); 
        
        forall(e, biconnected_edges) { G.del_edge(e); }
        biconnected_edges.clear();

        cout << "[DEBUG] Phase 5: gw.update_graph()..." << endl;
        gw.update_graph(); 

        cout << "[DEBUG] Phase 5: Setze Knotenpositionen und Knicke..." << endl;
        int max_y = st_list.size() + 1; 
        node u;
        forall_nodes(u, G) {
            int inverted_y = (max_y - st_numbering[u] + 1); 
            gw.set_position(u, point(x_node[u] * grid_size, inverted_y * grid_size));
        }

        forall_edges(edge_iter, G) {
            if (!bends_array[edge_iter].empty()) {
                list<point> final_bends;
                point p;
                forall(p, bends_array[edge_iter]) {
                    double original_st = p.ycoord() / grid_size;
                    double inverted_y = (max_y - original_st + 1);
                    final_bends.append(point(p.xcoord(), inverted_y * grid_size));
                }
                gw.set_bends(edge_iter, final_bends);
            }
        }

        cout << "[DEBUG] Zeichne Graph..." << endl;
        gw.set_flush(true);
        gw.redraw();
        cout << "[DEBUG] FERTIG!" << endl;

        gw.message("Biedl-Kant Algorithmus erfolgreich beendet! OK fuer Reset.");
        gw.edit();
        gw.del_messages();
        
        cout << "[DEBUG] Restore Attributes..." << endl;
        gw.restore_all_attributes();
        gw.update_graph();
        gw.redraw();
    }

    return 0;
}