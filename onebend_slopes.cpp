// =====================================================================
// Interaktive GraphWin-App fuer 1-Bend-Zeichnungen mit 3*Delta-8
// Steigungen (Bekos, Katsanou, Kindermann, Pavlidi, Theorem 1 + Kor. 2).
// Aufbau analog zu biedl_kant_slopes.cpp; der Algorithmus liegt in
// onebend_core.cpp und wird nach jedem "Done" auf den gezeichneten
// Graphen angewendet und geometrisch verifiziert.
//
// Anzeige-Hinweis: Theorem-1-Zeichnungen sind extrem hoch (O(Delta n^3))
// und schmal (O(Delta n^2)); fuer die Darstellung werden x und y
// getrennt auf eine Ziel-Leinwand skaliert. Parallelitaet gleicher
// Steigungen bleibt dabei erhalten, die Steigungswerte selbst sind nur
// in den logischen Koordinaten exakt (Konsole/Verifier).
// =====================================================================

#include "onebend_core.h"

#include <LEDA/graphics/graphwin.h>
#include <algorithm>
#include <iostream>

using namespace leda;
using std::cout;
using std::endl;

int main() {
    graph G;
    GraphWin gw(G, "Planar 1-Bend Drawing - Bekos et al. (Theorem 1)");
    gw.set_directed(false);
    gw.set_node_shape(gw_node_shape::rectangle_node);
    gw.set_node_width(50);
    gw.set_node_height(30);
    gw.set_node_label_font(gw_font_type::italic_font, 9);
    gw.open(window::center, window::center);

    while (gw.edit()) {
        gw.save_all_attributes();
        cout << "\n=============================================" << endl;
        cout << "[DEBUG] Neuer Durchlauf gestartet (Done geklickt)" << endl;

        OneBendResult res;
        if (!compute_onebend_drawing(G, res, true)) {
            gw.message(string("%s", res.error.c_str()));
            continue;
        }

        std::string report;
        bool pass = verify_onebend_drawing(G, res, report);
        cout << report << endl;

        // Anisotrope Skalierung auf eine Ziel-Leinwand
        const double target_w = 1200.0, target_h = 800.0;
        double sx = target_w / std::max((double)res.stats.width, 1.0);
        double sy = target_h / std::max((double)res.stats.height, 1.0);

        node v;
        forall_nodes(v, G)
            gw.set_label(v, string("%d (P%d)", G.index(v), res.part[v]));

        gw.del_messages();
        gw.update_graph();

        forall_nodes(v, G)
            gw.set_position(v, point(res.pos[v].xcoord() * sx,
                                     res.pos[v].ycoord() * sy));
        edge e;
        forall_edges(e, G) {
            if (!res.bends[e].empty()) {
                list<point> b;
                point p;
                forall(p, res.bends[e])
                    b.append(point(p.xcoord() * sx, p.ycoord() * sy));
                gw.set_bends(e, b);
            }
            switch (res.color[e]) {
                case OB_BLUE:  gw.set_color(e, blue);  break;
                case OB_GREEN: gw.set_color(e, green); break;
                case OB_RED:   gw.set_color(e, red);   break;
                default:       gw.set_color(e, black); break;
            }
        }

        gw.set_flush(true);
        gw.redraw();
        gw.center_graph();
        gw.zoom_graph();

        string msg("Steigungen: %d/%d | Gitter: %.0f x %.0f | k=%.0f | Verifikation: %s%s%s | OK fuer Reset.",
                   res.stats.slopes_used, res.stats.slopes_allowed,
                   (double)res.stats.width, (double)res.stats.height,
                   (double)res.stats.k,
                   pass ? "PASS" : "FAIL (siehe Konsole)",
                   res.stats.augmented ? " | augmentiert" : "",
                   res.stats.special_vn ? " | Sonderfall vn" : "");
        gw.message(msg);
        gw.edit();
        gw.del_messages();

        gw.restore_all_attributes();
        gw.update_graph();
        gw.redraw();
    }

    return 0;
}
