// Implementation of the Biedl-Kant algorithm for planar graph drawing

#include "LEDA/graphics/graphwin.h"
#include "LEDA/graph/graph.h"
#include "LEDA/graph/graph_alg.h"

using namespace leda;

int main() {
    graph G;
    GraphWin gw(G, "Planar Graph Drawing - Biedl-Kant Algorithm");
    node v; edge e;
    gw.set_directed(false);
    gw.set_node_shape(gw_node_shape::rectangle_node);
    gw.set_node_width(60);
    gw.set_node_height(40);
    gw.set_node_label_font(gw_font_type::italic_font, 9);
    gw.open(window::center, window::center);
    while (gw.edit()) {

        // Step 1: Check if the graph is planar
        cout << "Graph created. Checking planarity..." << endl;
        if (!PLANAR(G)) {
            cout << "The graph is not planar. Please edit the graph to make it planar." << endl;
            gw.message("The graph is not planar. Please edit the graph to make it planar.");
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