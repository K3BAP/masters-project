import { useMemo, useState } from 'react';
import { validateInput } from './algorithm/embedding';
import { computeSlopesDrawing } from './algorithm/pipeline';
import type { DrawingResult, InputGraph } from './algorithm/types';
import { DrawingView } from './components/DrawingView';
import { Gallery } from './components/Gallery';
import { GraphEditor } from './components/GraphEditor';
import { SlopeLegend } from './components/SlopeLegend';
import { StatsPanel } from './components/StatsPanel';
import { Stepper } from './components/Stepper';
import { EXAMPLES } from './examples';

export default function App() {
  const [graph, setGraph] = useState<InputGraph>(
    () => structuredClone(EXAMPLES.find((e) => e.id === 'wheel8')!.graph),
  );
  const [result, setResult] = useState<DrawingResult | null>(null);
  const [step, setStep] = useState(0); // 1..n; n = fertige Zeichnung
  const [stale, setStale] = useState(false);
  // In der Ergebnisansicht angeklickter Knoten; wird auch im Editor markiert.
  const [selected, setSelected] = useState<number | null>(null);

  const issues = useMemo(() => validateInput(graph), [graph]);

  // Kreuzungen blockieren nicht mehr: dann berechnet die Pipeline
  // automatisch eine planare Einbettung (Demoucron); nur fehlender
  // Zusammenhang (und n < 2) verhindert den Lauf.
  const canRun = graph.n >= 2 && !issues.disconnected;
  const needsAutoEmbedding = canRun && !issues.ok;

  const run = () => {
    const res = computeSlopesDrawing(graph);
    setResult(res);
    setStep(res.ok ? res.stats.n + 1 : 0); // n+1 = Schritt "Fertig" (ohne Hervorhebungen)
    setStale(false);
    setSelected(null);
  };

  const updateGraph = (g: InputGraph) => {
    setGraph(g);
    setStale(true);
    setSelected(null); // Indizes koennen sich verschieben (Loeschen)
  };

  const statusText = graph.n < 2
    ? 'Mindestens zwei Knoten zeichnen.'
    : issues.disconnected
      ? 'Der Graph ist nicht zusammenhängend.'
      : issues.crossingPairs.length > 0
        ? `${issues.crossingPairs.length} Kreuzung(en) – planare Einbettung wird automatisch berechnet.`
        : issues.vertexOnEdge.length > 0 || issues.coincident.length > 0
          ? 'Entartete Zeichnung – planare Einbettung wird automatisch berechnet.'
          : 'Bereit.';

  return (
    <div className="app">
      <header>
        <h1>Planare Zeichnungen mit ⌈Δ/2⌉ Steigungen</h1>
        <span className="subtitle">
          Bekos, Katsanou, Kindermann, Pavlidi – Theorem 4 (2 Knicke, polynomielle Fläche)
        </span>
        <div className="spacer" />
        <span className={!canRun ? 'status bad' : needsAutoEmbedding ? 'status warn' : 'status ok'}>
          {statusText}
        </span>
        <button className="primary" disabled={!canRun} onClick={run}>
          Zeichnung berechnen
        </button>
      </header>

      <main>
        <section className="left">
          <Gallery onLoad={(g) => { updateGraph(g); setResult(null); }} />
          <GraphEditor
            graph={graph}
            issues={issues}
            onChange={updateGraph}
            selectedNode={selected}
          />
        </section>

        <section className="right">
          {result && !result.ok && <div className="error-banner">{result.error}</div>}
          {result && result.ok && (
            <>
              {stale && (
                <div className="stale-banner">
                  Der Graph wurde geändert – Zeichnung neu berechnen.
                </div>
              )}
              <Stepper result={result} step={step} setStep={setStep} />
              <DrawingView
                result={result}
                step={step}
                selected={selected}
                onSelect={setSelected}
              />
              <div className="row">
                <StatsPanel result={result} />
                <SlopeLegend deltaEff={result.stats.deltaEff} />
              </div>
            </>
          )}
          {!result && (
            <div className="placeholder">
              <p>
                Links einen planaren Graphen zeichnen (oder ein Beispiel laden) und{' '}
                <em>Zeichnung berechnen</em> drücken.
              </p>
              <p>
                Der Algorithmus erzeugt eine planare Gitterzeichnung mit höchstens zwei Knicken
                pro Kante und höchstens ⌈Δ/2⌉ Steigungen (⌈Δ/2⌉+1 bei nötiger
                Bikonnektivitäts-Augmentierung) auf einem O(n) × O(Δn²)-Gitter. Die
                Schrittansicht zeigt den inkrementellen Aufbau entlang der st-Nummerierung.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
