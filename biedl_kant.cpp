// Implementation of the Biedl-Kant algorithm for planar graph drawing

#include "LEDA/graphics/graphwin.h"
#include "LEDA/graph/graph.h"
#include "LEDA/graph/graph_alg.h"

using namespace leda;

// Shifts all nodes, edges and bends to the right of target_x by one unit to free a column
void shift_right(int target_x, 
                 graph& G, 
                 node_array<int>& x_coord, 
                 edge_array<int>& x_edge, 
                 edge_array<list<point>>& bends_array, 
                 node_array<int>& st_numbering, 
                 int current_st, 
                 int& x_max, 
                 int grid_size) 
{
    // 1. Wenn wir am rechten Rand oder darüber hinaus shiften, wächst der Graph
    if (target_x <= x_max) {
        x_max++;
    }

    // 2. Alle BEREITS PLATZIERTEN Knoten verschieben
    node w;
    forall_nodes(w, G) {
        if (st_numbering[w] <= current_st && x_coord[w] >= target_x) {
            x_coord[w]++;
        }
    }

    // 3. Spalten und Knickpunkte der Kanten verschieben
    edge e;
    forall_edges(e, G) {
        // Wir dürfen nur Kanten verschieben, die auch wirklich schon geroutet 
        // wurden (also mindestens einen bearbeiteten Knoten haben).
        node u = G.source(e);
        node tgt = G.target(e);
        
        if (st_numbering[u] <= current_st || st_numbering[tgt] <= current_st) {
            if (x_edge[e] >= target_x) {
                x_edge[e]++;
            }
        }

        // Bends (Knickpunkte) physisch auf dem Raster verschieben
        if (!bends_array[e].empty()) {
            list<point> shifted_bends;
            point p;
            forall(p, bends_array[e]) {
                // Wir vergleichen auf Raster-Ebene (multipliziert mit grid_size)
                if (p.xcoord() >= target_x * grid_size) {
                    shifted_bends.append(point(p.xcoord() + grid_size, p.ycoord()));
                } else {
                    shifted_bends.append(p);
                }
            }
            // Überschreibe die alte Liste mit der verschobenen Liste
            bends_array[e] = shifted_bends;
        }
    }
}

int main() {
    graph G;
    GraphWin gw(G, "Planar Graph Drawing - Biedl-Kant Algorithm");
    node v, w; edge e;
    gw.set_directed(false);
    gw.set_node_shape(gw_node_shape::rectangle_node);
    gw.set_node_width(60);
    gw.set_node_height(40);
    gw.set_node_label_font(gw_font_type::italic_font, 9);
    gw.open(window::center, window::center);

    int grid_size = 50; // Abstand zwischen den Rasterlinien
    while (gw.edit()) {

        // Step 1: Check if the graph is planar
        cout << "Graph created. Checking planarity..." << endl;
        list<edge> reverse_edges;
        G.make_bidirected(reverse_edges);
        if (!PLANAR(G, true)) {
            cout << "The graph is not planar. Please edit the graph to make it planar." << endl;
            gw.message("The graph is not planar. Please edit the graph to make it planar.");
            forall(e, reverse_edges) { G.del_edge(e); }
            continue;
        }

        // Step 2: Check if max deg <= 4
        cout << "Checking maximum degree..." << endl;
        int max_deg = 0;
        forall_nodes(v, G) {
            int deg = outdeg(v);
            if (deg > max_deg) {
                max_deg = deg;
            }
        }
        cout << "Maximum degree: " << max_deg << endl;
        if (max_deg > 4) {
            cout << "The maximum degree is greater than 4. Please edit the graph to ensure all vertices have degree at most 4." << endl;
            gw.message("The maximum degree is greater than 4. Please edit the graph to ensure all vertices have degree at most 4.");
            continue;
        }

        // Snapshot
        gw.save_all_attributes();

        // Step 3: Make the graph biconnected
        cout << "Making the graph biconnected..." << endl;
        gw.message("Making the graph biconnected...");
        list<edge> biconnected_edges = Make_Biconnected(G);
        gw.update_graph();

        forall(e, biconnected_edges) {
            gw.set_color(e, red);
        }

        sleep(1.5);

        // Step 4: Compute ST-numbering
        cout << "Computing ST-numbering..." << endl;
        gw.message("Computing ST-numbering...");
        node_array<int> st_numbering(G);
        list<node> st_list;
        if (!ST_NUMBERING(G, st_numbering, st_list, nil)) {
            cout << "ST-numbering failed. Please check the graph structure." << endl;
            gw.message("ST-numbering failed. Please check the graph structure.");
            continue;
        }

        // Print out st-numbering for debugging
        cout << "ST-numbering:" << endl;
        forall(v, st_list) {
            int node_id = G.index(v);
            
            cout << "Node " << node_id << ": " << st_numbering[v] << endl;
            gw.set_label(v, string("%d (%d)", node_id, st_numbering[v]));
            
        }

        // Cleanup biconnected edges
        cout << "Cleaning up biconnected edges..." << endl;
        forall(e, biconnected_edges) {
            G.del_edge(e);
        }

        // Compute x coordinates based on st-numbering
        cout << "Computing x-coordinates based on ST-numbering..." << endl;
        edge_array<int> x_edge(G);
        node_array<int> x_node(G);
        edge_array<list<point>> bends_array(G);
        int x_max = 0;
        cout << "Processing node " << G.index(v) << " with st-number " << st_numbering[v] << endl;
            
        forall(v, st_list) {
            cout << "Processing node " << G.index(v) << " with st-number " << st_numbering[v] << endl;
            
            std::vector<edge> in_edges;
            std::vector<edge> cycle; // Collect all edges for out-analysis

            // 1. Kanten sammeln
            edge e;
            forall_adj_edges(e, v) {
                cycle.push_back(e);
                node w = G.opposite(v, e);
                if (st_numbering[w] < st_numbering[v]) {
                    // WICHTIG: Die x-Koordinate liegt auf der Kante, 
                    // die von unten KAM (also das Reversal der aktuellen Halb-Kante)
                    in_edges.push_back(G.reversal(e)); 
                }
            }

            // 2. IN-EDGES strikt von Links nach Rechts sortieren
            std::sort(in_edges.begin(), in_edges.end(), [&x_edge](edge a, edge b) {
                return x_edge[a] < x_edge[b];
            });

            // 3. OUT-EDGES strikt von Links nach Rechts sortieren (Nahtstellen-Suche)
            std::vector<edge> out_edges;
            int deg = cycle.size();
            int start_idx = 0; // Wo fängt die linkeste OUT-Kante an?

            // Wir suchen den Wechsel von IN nach OUT im Uhrzeigersinn
            if (st_numbering[v] != 1 && st_numbering[v] != st_list.size()) { 
                for (int i = 0; i < deg; i++) {
                    edge curr_e = cycle[i];
                    edge next_e = cycle[(i + 1) % deg];
                    
                    bool curr_is_in = (st_numbering[G.opposite(v, curr_e)] < st_numbering[v]);
                    bool next_is_out = (st_numbering[G.opposite(v, next_e)] > st_numbering[v]);
                    
                    if (curr_is_in && next_is_out) {
                        start_idx = (i + 1) % deg; // Treffer! Die erste Kante nach dem Wechsel
                        break;
                    }
                }
            }

            // Jetzt sammeln wir alle OUT-Kanten ab dieser linken Nahtstelle ein
            for (int i = 0; i < deg; i++) {
                edge current_e = cycle[(start_idx + i) % deg];
                node w = G.opposite(v, current_e);
                if (st_numbering[w] > st_numbering[v]) {
                    out_edges.push_back(current_e);
                }
            }

            int in_count = in_edges.size();
            int out_count = out_edges.size();
            cout << "In-edges: " << in_count << ", Out-edges: " << out_count << endl;

            // =========================================================
            // Ab hier ist dein Switch-Case super einfach, weil 
            // in_edges[0] = IMMER links, in_edges[1] = IMMER mitte, etc.
            // =========================================================
            
            // Zur besseren Lesbarkeit: Die y-Koordinate des aktuellen Knotens
            int y_v = st_numbering[v];

            // ==========================================
            // ZUWEISUNG DER EINGEHENDEN KANTEN (IN-EDGES)
            // ==========================================
            switch (in_count) {
                case 0:
                    // Startknoten (oder ein Knoten, der seine einzige IN-Kante durch 
                    // den Dummy-Cleanup verloren hat)
                    if (st_numbering[v] == 1) {
                        x_node[v] = 0; 
                    } else {
                        x_node[v] = ++x_max; // Braucht eine komplett neue Spalte
                    }
                    break;

                case 1:
                    // 1 Kante: Ist automatisch der Stamm. Keine Knicke nötig!
                    x_node[v] = x_edge[in_edges[0]];
                    break;

                case 2:
                    // 2 Kanten: Wir wählen die rechte als Stamm. 
                    x_node[v] = x_edge[in_edges[1]]; // Knoten erbt rechte Spalte
                    
                    // Die LINKE Kante muss abknicken:
                    // Sie knickt auf ihrer eigenen x-Spur ab, genau auf der Höhe von v.
                    bends_array[in_edges[0]].append(point(x_edge[in_edges[0]] * grid_size, y_v * grid_size));
                    break;

                case 3:
                    // 3 Kanten: Die mittlere ist der Stamm.
                    x_node[v] = x_edge[in_edges[1]]; // Knoten erbt mittlere Spalte
                    
                    // Die LINKE Kante knickt ab:
                    bends_array[in_edges[0]].append(point(x_edge[in_edges[0]] * grid_size, y_v * grid_size));
                    
                    // Die RECHTE Kante knickt ab:
                    bends_array[in_edges[2]].append(point(x_edge[in_edges[2]] * grid_size, y_v * grid_size));
                    break;

                case 4:
                    // Dies kann eigentlich nur beim finalen Zielknoten (t) passieren, 
                    // da ein normaler Knoten bei Max-Grad 4 nicht 4 IN und 1 OUT haben kann.
                    // Wir nehmen z.B. in_edges[1] als Stamm, alle anderen knicken.
                    x_node[v] = x_edge[in_edges[1]];
                    
                    bends_array[in_edges[0]].append(point(x_edge[in_edges[0]] * grid_size, y_v * grid_size));
                    bends_array[in_edges[2]].append(point(x_edge[in_edges[2]] * grid_size, y_v * grid_size));
                    bends_array[in_edges[3]].append(point(x_edge[in_edges[3]] * grid_size, y_v * grid_size));
                    break;
            }

            // ==========================================
            // ZUWEISUNG DER AUSGEHENDEN KANTEN (OUT-EDGES)
            // ==========================================
            switch (out_count) {
                case 1:
                    // 1 Kante: Geht schnurgerade nach oben (erbt den Stamm)
                    x_edge[out_edges[0]] = x_node[v];
                    break;
                
                case 2:
                    // 2 Kanten: Links bekommt neue Spalte, Rechts erbt den Stamm.
                    {
                        int free_col = x_node[v];
                        // WICHTIG: Hier jetzt x_node übergeben statt x_coord!
                        shift_right(free_col, G, x_node, x_edge, bends_array, st_numbering, st_numbering[v], x_max, grid_size);
                        
                        x_edge[out_edges[0]] = free_col;         // Linke Kante geht in die Lücke
                        x_edge[out_edges[1]] = x_node[v];        // Rechte Kante erbt den Stamm (der mitgerutscht ist)
                        
                        // Bend für die abzweigende linke Kante setzen
                        bends_array[out_edges[0]].append(point(free_col * grid_size, st_numbering[v] * grid_size));
                    }
                    break;
                
                case 3:
                    // 3 Kanten: Links (neu), Mitte (erbt), Rechts (neu)
                    {
                        // 1. Platz für die RECHTE Kante machen
                        int right_col = x_node[v] + 1;
                        shift_right(right_col, G, x_node, x_edge, bends_array, st_numbering, st_numbering[v], x_max, grid_size);
                        
                        // 2. Platz für die LINKE Kante machen
                        int left_col = x_node[v];
                        shift_right(left_col, G, x_node, x_edge, bends_array, st_numbering, st_numbering[v], x_max, grid_size);

                        x_edge[out_edges[0]] = left_col;         // Linke Kante
                        x_edge[out_edges[1]] = x_node[v];        // Mittlere Kante (Stamm)
                        x_edge[out_edges[2]] = right_col + 1;    // Rechte Kante (wurde durch den 2. Shift nochmal um 1 verschoben!)

                        // Bends setzen
                        bends_array[out_edges[0]].append(point(left_col * grid_size, st_numbering[v] * grid_size));
                        bends_array[out_edges[2]].append(point((right_col + 1) * grid_size, st_numbering[v] * grid_size));
                    }
                    break;
            }

        }

        // =================================================================
        // 5. VISUALISIERUNG ANWENDEN
        // =================================================================
        cout << "Wende berechnete Koordinaten und Knicke an..." << endl;

        // 1. TOPOLOGIE AUFRÄUMEN
        // Wir löschen die Rückkanten, BEVOR wir GraphWin updaten.
        forall(e, reverse_edges) { 
            G.del_edge(e); 
        }
        reverse_edges.clear(); 
        
        // 2. GRAPH-FENSTER SYNCHRONISIEREN
        // WICHTIG: update_graph() setzt oft Bends zurück. 
        // Daher muss es VOR set_position und set_bends stehen!
        gw.update_graph(); 

        // 3. KNOTEN-POSITIONEN SETZEN
        // Wir ermitteln die höchste ST-Nummer, um die Zeichnung auf den Kopf zu stellen,
        // damit ST=1 (Start) schön unten auf dem Bildschirm liegt.
        int max_y = st_list.size(); 
        
        node u;
        forall_nodes(u, G) {
            int inverted_y = (max_y - st_numbering[u] + 1); 
            gw.set_position(u, point(x_node[u] * grid_size, inverted_y * grid_size));
        }

        // 4. KNICKPUNKTE (BENDS) SETZEN
        edge edge_iter;
        forall_edges(edge_iter, G) {
            if (!bends_array[edge_iter].empty()) {
                
                // Da wir die y-Achse für die Knoten umgedreht haben, 
                // müssen wir auch die y-Koordinaten der Knickpunkte invertieren!
                list<point> final_bends;
                point p;
                forall(p, bends_array[edge_iter]) {
                    // Rechnerisch: Pixel -> ST-Nummer -> Invertierte ST-Nummer -> Pixel
                    double original_st = p.ycoord() / grid_size;
                    double inverted_y = (max_y - original_st + 1);
                    final_bends.append(point(p.xcoord(), inverted_y * grid_size));
                }
                
                gw.set_bends(edge_iter, final_bends);
            }
        }

        gw.update_graph();
        gw.set_flush(true);
        gw.redraw();

        // Blocking call to allow user to see the result
        gw.edit();
        
        gw.del_messages();

        // Restore original attributes
        gw.update_graph();
        gw.restore_all_attributes();
        gw.redraw();
    }

    return 0;
}