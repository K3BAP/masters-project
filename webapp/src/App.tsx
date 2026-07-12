import { useMemo, useState } from 'react';
import { validateInput } from './algorithm/embedding';
import { computeSlopesDrawing } from './algorithm/pipeline';
import { computeOneBendDrawing, type OneBendOptions } from './algorithm/onebend/pipeline';
import type { OneBendResult } from './algorithm/onebend/types';
import type { DrawingResult, InputGraph } from './algorithm/types';
import { DrawingView } from './components/DrawingView';
import { Gallery } from './components/Gallery';
import { GraphEditor } from './components/GraphEditor';
import { OneBendLegend } from './components/OneBendLegend';
import { OneBendStatsPanel } from './components/OneBendStatsPanel';
import { OneBendStepper } from './components/OneBendStepper';
import { OneBendView } from './components/OneBendView';
import { SlopeLegend } from './components/SlopeLegend';
import { StatsPanel } from './components/StatsPanel';
import { Stepper } from './components/Stepper';
import { EXAMPLES } from './examples';
import { LANGS, useI18n } from './i18n';

type Algo = 'twobend' | 'onebend';

export default function App() {
  const { lang, setLang, t, translateError } = useI18n();
  const [algo, setAlgo] = useState<Algo>('twobend');
  const [graph, setGraph] = useState<InputGraph>(
    () => structuredClone(EXAMPLES.find((e) => e.id === 'wheel8')!.graph),
  );
  const [result, setResult] = useState<DrawingResult | null>(null);
  const [obResult, setObResult] = useState<OneBendResult | null>(null);
  const [step, setStep] = useState(0);
  const [stale, setStale] = useState(false);
  // Theorem 1: Parameter k automatisch (4·Δ_eff·n², Papier-Wahl) oder manuell
  const [kAuto, setKAuto] = useState(true);
  const [kText, setKText] = useState('100');
  // Theorem 1: Wurzeln der kanonischen Ordnung (leere Felder = automatisch)
  const [rootsAuto, setRootsAuto] = useState(true);
  const [v1Text, setV1Text] = useState('');
  const [v2Text, setV2Text] = useState('');
  const [vnText, setVnText] = useState('');
  // In der Ergebnisansicht angeklickter Knoten; wird auch im Editor markiert.
  const [selected, setSelected] = useState<number | null>(null);

  const issues = useMemo(() => validateInput(graph), [graph]);

  // Kreuzungen blockieren nicht: dann berechnet die Pipeline automatisch
  // eine planare Einbettung (Demoucron); nur fehlender Zusammenhang
  // (und n < 2) verhindert den Lauf.
  const canRun = graph.n >= 2 && !issues.disconnected;
  const needsAutoEmbedding = canRun && !issues.ok;

  const run = () => {
    if (algo === 'twobend') {
      const res = computeSlopesDrawing(graph);
      setResult(res);
      setObResult(null);
      setStep(res.ok ? res.stats.n + 1 : 0); // n+1 = Schritt "Fertig"
    } else {
      const opts: OneBendOptions = {};
      if (!kAuto) opts.k = Number(kText);
      if (!rootsAuto) {
        if (v1Text.trim() !== '') opts.v1 = Number(v1Text);
        if (v2Text.trim() !== '') opts.v2 = Number(v2Text);
        if (vnText.trim() !== '') opts.vn = Number(vnText);
      }
      const res = computeOneBendDrawing(graph, Object.keys(opts).length ? opts : undefined);
      setObResult(res);
      setResult(null);
      setStep(res.ok ? res.snapshots.length + 1 : 0); // S+1 = "Fertig"
    }
    setStale(false);
    setSelected(null);
  };

  const switchAlgo = (a: Algo) => {
    if (a === algo) return;
    setAlgo(a);
    setResult(null);
    setObResult(null);
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

  const activeError = algo === 'twobend' ? result?.error : obResult?.error;
  const hasResult = algo === 'twobend' ? result?.ok : obResult?.ok;

  return (
    <div className="app">
      <header>
        <h1>{algo === 'twobend' ? t('app_title') : t('app_title_onebend')}</h1>
        <span className="subtitle">
          {algo === 'twobend' ? t('app_subtitle') : t('app_subtitle_onebend')}
        </span>
        <div className="spacer" />
        <div className="algo-switch lang-switch">
          <button
            className={algo === 'twobend' ? 'active' : ''}
            title={t('algo_twobend_hint')}
            onClick={() => switchAlgo('twobend')}
          >
            {t('algo_twobend')}
          </button>
          <button
            className={algo === 'onebend' ? 'active' : ''}
            title={t('algo_onebend_hint')}
            onClick={() => switchAlgo('onebend')}
          >
            {t('algo_onebend')}
          </button>
        </div>
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
          <Gallery onLoad={(g) => { updateGraph(g); setResult(null); setObResult(null); }} />
          <GraphEditor
            graph={graph}
            issues={issues}
            onChange={updateGraph}
            selectedNode={selected}
          />
        </section>

        <section className="right">
          {algo === 'onebend' && (
            <div className="kparam">
              <label>
                <input
                  type="checkbox"
                  checked={kAuto}
                  onChange={(e) => { setKAuto(e.target.checked); if (obResult) setStale(true); }}
                />
                {t('kparam_auto')}
              </label>
              {!kAuto && (
                <label className="kparam-value">
                  k =
                  <input
                    type="number"
                    min={2}
                    step={1}
                    value={kText}
                    onChange={(e) => { setKText(e.target.value); if (obResult) setStale(true); }}
                  />
                </label>
              )}
              <span className="kparam-hint">{t('kparam_hint')}</span>
            </div>
          )}
          {algo === 'onebend' && (
            <div className="kparam">
              <label>
                <input
                  type="checkbox"
                  checked={rootsAuto}
                  onChange={(e) => { setRootsAuto(e.target.checked); if (obResult) setStale(true); }}
                />
                {t('roots_auto')}
              </label>
              {!rootsAuto && (
                <>
                  {([
                    ['v₁', v1Text, setV1Text],
                    ['v₂', v2Text, setV2Text],
                    ['vₙ', vnText, setVnText],
                  ] as Array<[string, string, (s: string) => void]>).map(([lbl, val, set]) => (
                    <label className="kparam-value roots-value" key={lbl}>
                      {lbl} =
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder={t('roots_auto_placeholder')}
                        value={val}
                        onChange={(e) => { set(e.target.value); if (obResult) setStale(true); }}
                      />
                    </label>
                  ))}
                </>
              )}
              <span className="kparam-hint">{t('roots_hint')}</span>
            </div>
          )}
          {activeError && (
            <div className="error-banner">{translateError(activeError)}</div>
          )}
          {hasResult && algo === 'twobend' && result && (
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
          {hasResult && algo === 'onebend' && obResult && (
            <>
              {stale && <div className="stale-banner">{t('banner_stale')}</div>}
              <OneBendStepper result={obResult} step={step} setStep={setStep} />
              <OneBendView
                result={obResult}
                step={step}
                selected={selected}
                onSelect={setSelected}
              />
              <div className="row">
                <OneBendStatsPanel result={obResult} />
                <OneBendLegend deltaEff={obResult.stats.deltaEff} k={obResult.stats.k} />
              </div>
            </>
          )}
          {!activeError && !hasResult && (
            <div className="placeholder">
              <p>{t('placeholder_1', { run: t('app_run') })}</p>
              <p>{algo === 'twobend' ? t('placeholder_2') : t('placeholder_2_onebend')}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
