// Typen des 1-Bend-Algorithmus (Port von onebend_core.h, Theorem 1 +
// Korollar 2 aus Bekos et al.).

import type { Edge, Point } from '../types';

export type OneBendColor = 'black' | 'blue' | 'green' | 'red';

export interface OneBendStats {
  n: number;
  m: number;
  deltaOrig: number;
  deltaAug: number;
  deltaEff: number; // max(deltaAug, 5) -- bestimmt die Steigungsmenge S
  k: number; // Parameter k = 4 * deltaEff * n^2
  slopesAllowed: number; // |S| = 3*deltaEff - 8
  /** 3*max(Delta,5)-8 (3-zusammenhaengend) bzw. ceil(9*Delta/2)+1 (Kor. 2). */
  slopesAllowedStrict: number;
  slopesUsed: number;
  augmented: boolean;
  specialVn: boolean; // Sonderfall deg(vn) = deltaEff
  parts: number; // Teile der kanonischen Ordnung (inkl. P0)
  width: number;
  height: number;
}

export type SnapshotKind = 'base' | 'chain' | 'singleton' | 'special' | 'closing';

/**
 * Vollstaendiger Zwischenstand nach einem Konstruktionsschritt.
 * Anders als bei Theorem 4 lassen sich die Zwischenschritte nicht aus dem
 * Endbild ableiten: Streckungen verschieben bereits platzierte Knoten.
 */
export interface OneBendSnapshot {
  kind: SnapshotKind;
  partIndex: number; // Teilindex der kanonischen Ordnung
  pos: Array<Point | null>; // je Knoten; null = noch nicht platziert
  polylines: Array<Point[] | null>; // je Kante; null = noch nicht gezeichnet
  newNodes: number[];
  newEdges: number[];
  partSize: number;
  q?: number; // Fall 2: Anzahl innerer Nachbarn + 1
}

export interface OneBendResult {
  ok: boolean;
  error?: string;
  pos: Point[];
  /** Kanten des augmentierten Graphen (aug-Flag unterscheidet Hilfskanten). */
  edges: Edge[];
  /** Polylinie pro Kante, orientiert vom frueheren zum spaeteren Teil. */
  polylines: Point[][];
  colors: OneBendColor[];
  part: number[];
  v1: number;
  v2: number;
  vn: number;
  stats: OneBendStats;
  snapshots: OneBendSnapshot[];
  verified?: boolean;
  report?: string;
}

export function emptyOneBendStats(): OneBendStats {
  return {
    n: 0, m: 0, deltaOrig: 0, deltaAug: 0, deltaEff: 0, k: 0,
    slopesAllowed: 0, slopesAllowedStrict: 0, slopesUsed: 0,
    augmented: false, specialVn: false, parts: 0, width: 0, height: 0,
  };
}
