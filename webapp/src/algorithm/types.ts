// Gemeinsame Typen des Algorithmuskerns (Port von slopes_core.cpp).

export interface Point {
  x: number;
  y: number;
}

/** Eingabegraph aus Editor/Galerie/Generator: schlicht, mit Zeichnungskoordinaten. */
export interface InputGraph {
  n: number;
  edges: Array<[number, number]>;
  pos: Point[];
}

/** Ungerichtete Kante des (ggf. augmentierten) Arbeitsgraphen. */
export interface Edge {
  u: number;
  v: number;
  aug: boolean; // durch Bikonnektivitaets-Augmentierung eingefuegt
}

/** Halbkante ("Dart") am Knoten: Kante e, zeigt zum Nachbarn `to`. */
export interface Dart {
  e: number;
  to: number;
}

/** Kombinatorische Einbettung: Rotationssystem pro Knoten. */
export interface EmbeddedGraph {
  n: number;
  edges: Edge[];
  rot: Dart[][];
}

/** Ein Port: gerichteter Strahl aus dem Steigungs-Set. */
export interface Port {
  slope: number;
  vertical: boolean;
  side: 1 | -1; // +1 = rechte Halbebene bzw. vertikal-oben, -1 = links bzw. vertikal-unten
}

/** Protokoll eines Konstruktionsschritts (fuer den Stepper). */
export interface TraceEvent {
  v: number;          // Knotenindex
  st: number;         // st-Nummer
  k: number;          // Anzahl In-Kanten
  q: number;          // Anzahl Out-Kanten
  medianEdge: number; // Kanten-Id der Median-In-Kante (-1 bei Quelle)
  inEdges: number[];  // In-Kanten links nach rechts
  outEdges: number[]; // Out-Kanten links nach rechts
  shiftsLeft: number;
  shiftsRight: number;
}

export interface Stats {
  n: number;
  m: number;
  deltaOrig: number;
  deltaEff: number;
  slopesAllowedStrict: number;
  slopesUsed: number;
  augmented: boolean;
  bumped: boolean;
  width: number;
  height: number;
  rowSpacing: number;
}

/** Endergebnis des Algorithmus in logischen Gitterkoordinaten. */
export interface DrawingResult {
  ok: boolean;
  error?: string;
  /** Positionen aller Knoten (Originalknoten; es entstehen keine neuen Knoten). */
  pos: Point[];
  /** Kanten des augmentierten Graphen (aug-Flag unterscheidet Hilfskanten). */
  edges: Edge[];
  /** Polylinie pro Kante, orientiert vom st-kleineren zum st-groesseren Endpunkt. */
  polylines: Point[][];
  /** Spalte des vertikalen Mittelsegments pro Kante (fuer den Stepper). */
  xEdge: number[];
  st: number[];
  stats: Stats;
  trace: TraceEvent[];
  /** Verifikationsbericht (deutsch) und Ergebnis. */
  verified?: boolean;
  report?: string;
}

export const UNASSIGNED = Number.MIN_SAFE_INTEGER;
