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
import { LANGS, useI18n } from './i18n';

export default function App() {
  const { lang, setLang, t, translateError } = useI18n();
  const [graph, setGraph] = useState<InputGraph>(
    () => structuredClone(EXAMPLES.find((e) => e.id === 'wheel8')!.graph),
  );
  const [result, setResult] = useState<DrawingResult | null>(null);
  const [step, setStep] = useState(0); // 1..n; n+1 = Schritt "Fertig"
  const [stale, setStale] = useState(false);
  // In der Ergebnisansicht angeklickter Knoten; wird auch im Editor markiert.
  const [selected, setSelected] = useState<number | null>(null);

  const issues = useMemo(() => validateInput(graph), [graph]);

  // Kreuzungen blockieren nicht: dann berechnet die Pipeline automatisch
  // eine planare Einbettung (Demoucron); nur fehlender Zusammenhang
  // (und n < 2) verhindert den Lauf.
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
    ? t('status_min_nodes')
    : issues.disconnected
      ? t('status_disconnected')
      : issues.crossingPairs.length > 0
        ? t('status_crossings', { n: issues.crossingPairs.length })
        : issues.vertexOnEdge.length > 0 || issues.coincident.length > 0
          ? t('status_degenerate')
          : t('status_ready');

  return (
    <div className="app">
      <header>
        <h1>{t('app_title')}</h1>
        <span className="subtitle">{t('app_subtitle')}</span>
        <div className="spacer" />
        <span className={!canRun ? 'status bad' : needsAutoEmbedding ? 'status warn' : 'status ok'}>
          {statusText}
        </span>
        <div className="lang-switch">
          {LANGS.map((l) => (
            <button
              key={l.id}
              className={lang === l.id ? 'active' : ''}
              onClick={() => setLang(l.id)}
              title={l.id}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button className="primary" disabled={!canRun} onClick={run}>
          {t('app_run')}
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
          {result && !result.ok && (
            <div className="error-banner">{translateError(result.error ?? '')}</div>
          )}
          {result && result.ok && (
            <>
              {stale && <div className="stale-banner">{t('banner_stale')}</div>}
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
              <p>{t('placeholder_1', { run: t('app_run') })}</p>
              <p>{t('placeholder_2')}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
