// Leichtgewichtige Internationalisierung (DE / EN / EL) ohne Fremdbibliothek:
// typisiertes Woerterbuch, {param}-Interpolation, Context-Provider mit
// localStorage-Persistenz. Die Algorithmus-Schicht bleibt unberuehrt;
// bekannte Pipeline-Fehlermeldungen werden UI-seitig uebersetzt.

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'de' | 'en' | 'el';

export const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'de', label: 'DE' },
  { id: 'en', label: 'EN' },
  { id: 'el', label: 'ΕΛ' },
];

const de = {
  app_title: 'Planare Zeichnungen mit ⌈Δ/2⌉ Steigungen',
  app_subtitle: 'Bekos, Katsanou, Kindermann, Pavlidi – Theorem 4 (2 Knicke, polynomielle Fläche)',
  app_run: 'Zeichnung berechnen',
  status_ready: 'Bereit.',
  status_min_nodes: 'Mindestens zwei Knoten zeichnen.',
  status_disconnected: 'Der Graph ist nicht zusammenhängend.',
  status_crossings: '{n} Kreuzung(en) – planare Einbettung wird automatisch berechnet.',
  status_degenerate: 'Entartete Zeichnung – planare Einbettung wird automatisch berechnet.',
  banner_stale: 'Der Graph wurde geändert – Zeichnung neu berechnen.',
  placeholder_1:
    'Links einen planaren Graphen zeichnen (oder ein Beispiel laden) und „{run}“ drücken.',
  placeholder_2:
    'Der Algorithmus erzeugt eine planare Gitterzeichnung mit höchstens zwei Knicken pro ' +
    'Kante und höchstens ⌈Δ/2⌉ Steigungen (⌈Δ/2⌉+1 bei nötiger Bikonnektivitäts-' +
    'Augmentierung) auf einem O(n) × O(Δn²)-Gitter. Die Schrittansicht zeigt den ' +
    'inkrementellen Aufbau entlang der st-Nummerierung.',

  editor_node: 'Knoten',
  editor_edge: 'Kanten',
  editor_move: 'Verschieben',
  editor_delete: 'Löschen',
  editor_clear: 'Leeren',

  gallery_density: 'Dichte',
  gallery_random: 'Zufallsgraph',

  example_k4_name: 'K4',
  example_k4_desc: 'Vollständiger Graph, Δ=3 → 2 Steigungen',
  example_octahedron_name: 'Oktaeder',
  example_octahedron_desc: '4-regulär; die beweisbare Ausnahme: 3 Steigungen',
  example_wheel8_name: 'Rad W₈',
  example_wheel8_desc: 'Nabe mit Grad 8 → 4 Steigungen',
  example_wheel12_name: 'Rad W₁₂',
  example_wheel12_desc: 'Nabe mit Grad 12 → 6 Steigungen',
  example_star10_name: 'Stern S₁₀',
  example_star10_desc: 'Baum, Δ=10; zeigt Bikonnektivitäts-Augmentierung',
  example_grid44_name: 'Gitter 4×4',
  example_grid44_desc: 'Bikonnektiert, Δ=4 → orthogonal (2 Steigungen)',
  example_path6_name: 'Pfad P₆',
  example_path6_desc: 'Minimalbeispiel mit Augmentierung',

  view_compact: 'kompakt (y gestaucht)',
  view_aug: 'Hilfskanten',
  view_reset: 'Ansicht zurücksetzen',

  stepper_play: '▶ Abspielen',
  stepper_pause: '⏸',
  stepper_step: 'Schritt {s} / {n}',
  stepper_done: 'Fertig',
  step_source:
    'Quelle v{v} (st=1) in Zeile 0: {q} ausgehende Pending-Kanten werden gegen den ' +
    'Uhrzeigersinn an Ports angelegt; die st-Kante ist die linkeste.',
  step_sink:
    'Senke v{v} (st={n}): alle {k} Pending-Kanten laufen ein; die Median-Kante endet ' +
    'vertikal in der Knotenspalte, die übrigen schließen mit geneigten Segmenten an.',
  step_vertex_single:
    'Knoten v{v} (st={st}) übernimmt die Spalte seiner einzigen eingehenden Pending-Kante; ' +
    'die restlichen In-Kanten knicken über Ports aus S an.',
  step_vertex_median:
    'Knoten v{v} (st={st}) wird über der Median-Kante seiner {k} eingehenden Pending-Kanten ' +
    'platziert; die restlichen In-Kanten knicken über Ports aus S an.',
  step_out: ' Neue Pending-Kanten nach oben: {q}.',
  step_shifts: ' Neue Spalten eingefügt (shift right): {l} links, {r} rechts.',
  step_finished:
    'Fertig – die Zeichnung ist vollständig: {n} Knoten auf einem {w} × {h}-Gitter mit ' +
    '{s} Steigungen und höchstens zwei Knicken pro Kante.',
  step_finished_aug:
    ' Die gestrichelten Hilfskanten der Augmentierung gehören nicht zum Endergebnis ' +
    '(Schalter „Hilfskanten“ blendet sie aus).',

  stats_pass: 'VERIFIKATION: PASS',
  stats_fail: 'VERIFIKATION: FAIL',
  stats_nodes_edges: 'Knoten / Kanten',
  stats_incl_aug: ' (inkl. Hilfskanten)',
  stats_maxdeg: 'Maxgrad Δ / Δ_eff',
  stats_slopes: 'Steigungen',
  stats_slopes_value: '{used} benutzt, Schranke ⌈Δ/2⌉{plus} = {bound}',
  stats_grid: 'Gitter (B × H)',
  stats_rowspacing: 'Zeilenabstand R',
  stats_augmentation: 'Augmentierung',
  stats_aug_yes: 'ja (Bikonnektivität)',
  stats_aug_no: 'nein',
  stats_bump: ' · Regularitäts-/Quellen-Bump (+1 Steigung)',
  stats_report: 'Verifikationsbericht',

  legend_title: 'Steigungsmenge S ({n} Steigungen)',

  error_empty: 'Leerer Graph.',
  error_disconnected: 'Der Graph ist nicht zusammenhängend.',
  error_not_planar: 'Der Graph ist nicht planar.',
};

export type MsgKey = keyof typeof de;

const en: Record<MsgKey, string> = {
  app_title: 'Planar drawings with ⌈Δ/2⌉ slopes',
  app_subtitle: 'Bekos, Katsanou, Kindermann, Pavlidi – Theorem 4 (2 bends, polynomial area)',
  app_run: 'Compute drawing',
  status_ready: 'Ready.',
  status_min_nodes: 'Draw at least two vertices.',
  status_disconnected: 'The graph is not connected.',
  status_crossings: '{n} crossing(s) – a planar embedding is computed automatically.',
  status_degenerate: 'Degenerate drawing – a planar embedding is computed automatically.',
  banner_stale: 'The graph has changed – recompute the drawing.',
  placeholder_1:
    'Draw a planar graph on the left (or load an example) and press “{run}”.',
  placeholder_2:
    'The algorithm produces a planar grid drawing with at most two bends per edge and at ' +
    'most ⌈Δ/2⌉ slopes (⌈Δ/2⌉+1 if biconnectivity augmentation is required) on an ' +
    'O(n) × O(Δn²) grid. The step view shows the incremental construction along the ' +
    'st-numbering.',

  editor_node: 'Vertices',
  editor_edge: 'Edges',
  editor_move: 'Move',
  editor_delete: 'Delete',
  editor_clear: 'Clear',

  gallery_density: 'Density',
  gallery_random: 'Random graph',

  example_k4_name: 'K4',
  example_k4_desc: 'Complete graph, Δ=3 → 2 slopes',
  example_octahedron_name: 'Octahedron',
  example_octahedron_desc: '4-regular; the provable exception: 3 slopes',
  example_wheel8_name: 'Wheel W₈',
  example_wheel8_desc: 'Hub of degree 8 → 4 slopes',
  example_wheel12_name: 'Wheel W₁₂',
  example_wheel12_desc: 'Hub of degree 12 → 6 slopes',
  example_star10_name: 'Star S₁₀',
  example_star10_desc: 'Tree, Δ=10; demonstrates biconnectivity augmentation',
  example_grid44_name: 'Grid 4×4',
  example_grid44_desc: 'Biconnected, Δ=4 → orthogonal (2 slopes)',
  example_path6_name: 'Path P₆',
  example_path6_desc: 'Minimal example with augmentation',

  view_compact: 'compact (y squeezed)',
  view_aug: 'helper edges',
  view_reset: 'Reset view',

  stepper_play: '▶ Play',
  stepper_pause: '⏸',
  stepper_step: 'Step {s} / {n}',
  stepper_done: 'Finished',
  step_source:
    'Source v{v} (st=1) in row 0: {q} outgoing pending edges are attached to ports in ' +
    'counterclockwise order; the st-edge is the leftmost one.',
  step_sink:
    'Sink v{v} (st={n}): all {k} pending edges arrive; the median edge ends vertically in ' +
    'the vertex column, the others attach with sloped segments.',
  step_vertex_single:
    'Vertex v{v} (st={st}) inherits the column of its single incoming pending edge; the ' +
    'remaining in-edges bend in via ports from S.',
  step_vertex_median:
    'Vertex v{v} (st={st}) is placed above the median edge of its {k} incoming pending ' +
    'edges; the remaining in-edges bend in via ports from S.',
  step_out: ' New pending edges upward: {q}.',
  step_shifts: ' New columns inserted (shift right): {l} left, {r} right.',
  step_finished:
    'Finished – the drawing is complete: {n} vertices on a {w} × {h} grid using {s} slopes ' +
    'and at most two bends per edge.',
  step_finished_aug:
    ' The dashed helper edges from the augmentation are not part of the final result ' +
    '(the “helper edges” toggle hides them).',

  stats_pass: 'VERIFICATION: PASS',
  stats_fail: 'VERIFICATION: FAIL',
  stats_nodes_edges: 'Vertices / edges',
  stats_incl_aug: ' (incl. helper edges)',
  stats_maxdeg: 'Max degree Δ / Δ_eff',
  stats_slopes: 'Slopes',
  stats_slopes_value: '{used} used, bound ⌈Δ/2⌉{plus} = {bound}',
  stats_grid: 'Grid (W × H)',
  stats_rowspacing: 'Row spacing R',
  stats_augmentation: 'Augmentation',
  stats_aug_yes: 'yes (biconnectivity)',
  stats_aug_no: 'no',
  stats_bump: ' · regularity/source bump (+1 slope)',
  stats_report: 'Verification report',

  legend_title: 'Slope set S ({n} slopes)',

  error_empty: 'Empty graph.',
  error_disconnected: 'The graph is not connected.',
  error_not_planar: 'The graph is not planar.',
};

const el: Record<MsgKey, string> = {
  app_title: 'Επίπεδα σχέδια με ⌈Δ/2⌉ κλίσεις',
  app_subtitle: 'Bekos, Katsanou, Kindermann, Pavlidi – Θεώρημα 4 (2 κάμψεις, πολυωνυμικό εμβαδόν)',
  app_run: 'Υπολογισμός σχεδίου',
  status_ready: 'Έτοιμο.',
  status_min_nodes: 'Σχεδιάστε τουλάχιστον δύο κόμβους.',
  status_disconnected: 'Το γράφημα δεν είναι συνεκτικό.',
  status_crossings: '{n} διασταύρωση(-εις) – υπολογίζεται αυτόματα επίπεδη εμφύτευση.',
  status_degenerate: 'Εκφυλισμένο σχέδιο – υπολογίζεται αυτόματα επίπεδη εμφύτευση.',
  banner_stale: 'Το γράφημα άλλαξε – υπολογίστε ξανά το σχέδιο.',
  placeholder_1:
    'Σχεδιάστε ένα επίπεδο γράφημα αριστερά (ή φορτώστε ένα παράδειγμα) και πατήστε «{run}».',
  placeholder_2:
    'Ο αλγόριθμος παράγει ένα επίπεδο σχέδιο πλέγματος με το πολύ δύο κάμψεις ανά ακμή και ' +
    'το πολύ ⌈Δ/2⌉ κλίσεις (⌈Δ/2⌉+1 αν χρειάζεται επαύξηση δισυνεκτικότητας) σε πλέγμα ' +
    'O(n) × O(Δn²). Η προβολή βημάτων δείχνει την αυξητική κατασκευή κατά την αρίθμηση st.',

  editor_node: 'Κόμβοι',
  editor_edge: 'Ακμές',
  editor_move: 'Μετακίνηση',
  editor_delete: 'Διαγραφή',
  editor_clear: 'Καθαρισμός',

  gallery_density: 'Πυκνότητα',
  gallery_random: 'Τυχαίο γράφημα',

  example_k4_name: 'K4',
  example_k4_desc: 'Πλήρες γράφημα, Δ=3 → 2 κλίσεις',
  example_octahedron_name: 'Οκτάεδρο',
  example_octahedron_desc: '4-κανονικό· η αποδείξιμη εξαίρεση: 3 κλίσεις',
  example_wheel8_name: 'Τροχός W₈',
  example_wheel8_desc: 'Κέντρο βαθμού 8 → 4 κλίσεις',
  example_wheel12_name: 'Τροχός W₁₂',
  example_wheel12_desc: 'Κέντρο βαθμού 12 → 6 κλίσεις',
  example_star10_name: 'Αστέρι S₁₀',
  example_star10_desc: 'Δέντρο, Δ=10· δείχνει την επαύξηση δισυνεκτικότητας',
  example_grid44_name: 'Πλέγμα 4×4',
  example_grid44_desc: 'Δισυνεκτικό, Δ=4 → ορθογώνιο (2 κλίσεις)',
  example_path6_name: 'Μονοπάτι P₆',
  example_path6_desc: 'Ελάχιστο παράδειγμα με επαύξηση',

  view_compact: 'συμπαγές (συμπίεση y)',
  view_aug: 'βοηθητικές ακμές',
  view_reset: 'Επαναφορά προβολής',

  stepper_play: '▶ Αναπαραγωγή',
  stepper_pause: '⏸',
  stepper_step: 'Βήμα {s} / {n}',
  stepper_done: 'Ολοκληρώθηκε',
  step_source:
    'Πηγή v{v} (st=1) στη γραμμή 0: {q} εξερχόμενες εκκρεμείς ακμές τοποθετούνται σε θύρες ' +
    'αριστερόστροφα· η ακμή st είναι η αριστερότερη.',
  step_sink:
    'Καταβόθρα v{v} (st={n}): και οι {k} εκκρεμείς ακμές καταλήγουν εδώ· η διάμεση ακμή ' +
    'τερματίζει κατακόρυφα στη στήλη του κόμβου, οι υπόλοιπες συνδέονται με κεκλιμένα τμήματα.',
  step_vertex_single:
    'Ο κόμβος v{v} (st={st}) κληρονομεί τη στήλη της μοναδικής εισερχόμενης εκκρεμούς ακμής ' +
    'του· οι υπόλοιπες εισερχόμενες ακμές συνδέονται μέσω θυρών από το S.',
  step_vertex_median:
    'Ο κόμβος v{v} (st={st}) τοποθετείται πάνω από τη διάμεση ακμή των {k} εισερχόμενων ' +
    'εκκρεμών ακμών του· οι υπόλοιπες εισερχόμενες ακμές συνδέονται μέσω θυρών από το S.',
  step_out: ' Νέες εκκρεμείς ακμές προς τα πάνω: {q}.',
  step_shifts: ' Εισήχθησαν νέες στήλες (shift right): {l} αριστερά, {r} δεξιά.',
  step_finished:
    'Ολοκληρώθηκε – το σχέδιο είναι πλήρες: {n} κόμβοι σε πλέγμα {w} × {h} με {s} κλίσεις ' +
    'και το πολύ δύο κάμψεις ανά ακμή.',
  step_finished_aug:
    ' Οι διακεκομμένες βοηθητικές ακμές της επαύξησης δεν ανήκουν στο τελικό αποτέλεσμα ' +
    '(ο διακόπτης «βοηθητικές ακμές» τις αποκρύπτει).',

  stats_pass: 'ΕΠΑΛΗΘΕΥΣΗ: PASS',
  stats_fail: 'ΕΠΑΛΗΘΕΥΣΗ: FAIL',
  stats_nodes_edges: 'Κόμβοι / ακμές',
  stats_incl_aug: ' (μαζί με βοηθητικές)',
  stats_maxdeg: 'Μέγιστος βαθμός Δ / Δ_eff',
  stats_slopes: 'Κλίσεις',
  stats_slopes_value: '{used} σε χρήση, όριο ⌈Δ/2⌉{plus} = {bound}',
  stats_grid: 'Πλέγμα (Π × Υ)',
  stats_rowspacing: 'Απόσταση γραμμών R',
  stats_augmentation: 'Επαύξηση',
  stats_aug_yes: 'ναι (δισυνεκτικότητα)',
  stats_aug_no: 'όχι',
  stats_bump: ' · προσαύξηση κανονικότητας/πηγής (+1 κλίση)',
  stats_report: 'Αναφορά επαλήθευσης',

  legend_title: 'Σύνολο κλίσεων S ({n} κλίσεις)',

  error_empty: 'Κενό γράφημα.',
  error_disconnected: 'Το γράφημα δεν είναι συνεκτικό.',
  error_not_planar: 'Το γράφημα δεν είναι επίπεδο.',
};

const DICTS: Record<Lang, Record<MsgKey, string>> = { de, en, el };

// Bekannte (deutsche) Fehlermeldungen der Algorithmus-Pipeline -> Keys.
// Der Algorithmuskern bleibt sprachunabhaengig getestet; unbekannte
// Meldungen werden unveraendert angezeigt.
const PIPELINE_ERRORS: Array<[string, MsgKey]> = [
  ['Leerer Graph.', 'error_empty'],
  ['Der Graph ist nicht zusammenhaengend.', 'error_disconnected'],
  ['Der Graph ist nicht planar.', 'error_not_planar'],
];

export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    name in params ? String(params[name]) : m);
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MsgKey, params?: Record<string, string | number>) => string;
  translateError: (msg: string) => string;
}

const I18nContext = createContext<I18n>({
  lang: 'de',
  setLang: () => {},
  t: (k) => k,
  translateError: (m) => m,
});

const STORAGE_KEY = 'slopes-lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return stored === 'de' || stored === 'en' || stored === 'el' ? stored : 'de';
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* z.B. Private Mode */ }
  };

  const t = (key: MsgKey, params?: Record<string, string | number>) =>
    format(DICTS[lang][key] ?? key, params);

  const translateError = (msg: string) => {
    const hit = PIPELINE_ERRORS.find(([g]) => g === msg);
    return hit ? t(hit[1]) : msg;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, translateError }}>
      {children}
    </I18nContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18n {
  return useContext(I18nContext);
}
