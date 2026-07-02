// =====================================================================
// Interaktive GraphWin-App fuer 2-Bend-Zeichnungen mit ceil(Delta/2)
// Steigungen (Bekos, Katsanou, Kindermann, Pavlidi, Theorem 4 + Kor. 5).
// Aufbau analog zu biedl_kant.cpp; der Algorithmus selbst liegt in
// slopes_core.cpp und wird nach jedem "Done" auf den gezeichneten
// Graphen angewendet und geometrisch verifiziert.
// =====================================================================

#include "slopes_core.h"

#include <LEDA/graphics/graphwin.h>
#include <iostream>

using namespace leda;
using std::cout;
using std::endl;

int main() {
    graph G;
    GraphWin gw(G, "Planar Slope Drawing - Bekos et al. (Theorem 4)");
    gw.set_directed(false);
    gw.set_node_shape(gw_node_shape::rectangle_node);
    gw.set_node_width(50);
    gw.set_node_height(30);
    gw.set_node_label_font(gw_font_type::italic_font, 9);
    gw.open(window::center, window::center);

    const double grid_size = 40.0;

    while (gw.edit()) {
        gw.save_all_attributes();
        cout << "\n=============================================" << endl;
        cout << "[DEBUG] Neuer Durchlauf gestartet (Done geklickt)" << endl;

        SlopesResult res;
        node_array<int> st_num;
        if (!compute_slopes_drawing(G, res, &st_num, true)) {
            gw.message(string("%s", res.error.c_str()));
            continue;
        }

        std::string report;
        bool pass = verify_slopes_drawing(G, res, report);
        cout << report << endl;

        node v;
        forall_nodes(v, G)
            gw.set_label(v, string("%d (%d)", G.index(v), st_num[v]));

        gw.del_messages();
        gw.update_graph();

        forall_nodes(v, G)
            gw.set_position(v, point(res.pos[v].xcoord() * grid_size,
                                     res.pos[v].ycoord() * grid_size));
        edge e;
        forall_edges(e, G) {
            if (!res.bends[e].empty()) {
                list<point> b;
                point p;
                forall(p, res.bends[e])
                    b.append(point(p.xcoord() * grid_size, p.ycoord() * grid_size));
                gw.set_bends(e, b);
            }
        }

        gw.set_flush(true);
        gw.redraw();
        gw.center_graph();
        gw.zoom_graph();

        string msg("Slopes: %d/%d | Gitter: %d x %d | Verifikation: %s%s | OK fuer Reset.",
                   res.stats.slopes_used, res.stats.slopes_allowed,
                   (int)res.stats.width, (int)res.stats.height,
                   pass ? "PASS" : "FAIL (siehe Konsole)",
                   res.stats.regular_bumped ? " | Hinweis: regulaerer Graph, +1 Steigung" : "");
        gw.message(msg);
        gw.edit();
        gw.del_messages();

        gw.restore_all_attributes();
        gw.update_graph();
        gw.redraw();
    }

    return 0;
}
