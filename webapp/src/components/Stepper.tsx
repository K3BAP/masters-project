import { useEffect, useRef, useState } from 'react';
import type { DrawingResult } from '../algorithm/types';
import { useI18n } from '../i18n';

interface Props {
  result: DrawingResult;
  step: number;
  setStep: (s: number) => void;
}

export function Stepper({ result, step, setStep }: Props) {
  const { t } = useI18n();
  const n = result.stats.n;
  const last = n + 1; // Extraschritt "Fertig": Zeichnung ohne Hervorhebungen
  const [playing, setPlaying] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (stepRef.current >= last) { setPlaying(false); return; }
      setStep(stepRef.current + 1);
    }, 900);
    return () => clearInterval(id);
  }, [playing, last, setStep]);

  const clamp = (s: number) => Math.max(1, Math.min(last, s));

  return (
    <div className="stepper">
      <div className="stepper-controls">
        <button onClick={() => setStep(1)} disabled={step <= 1}>⏮</button>
        <button onClick={() => setStep(clamp(step - 1))} disabled={step <= 1}>◀</button>
        <button onClick={() => setPlaying(!playing)} disabled={step >= last && !playing}>
          {playing ? t('stepper_pause') : t('stepper_play')}
        </button>
        <button onClick={() => setStep(clamp(step + 1))} disabled={step >= last}>▶</button>
        <button onClick={() => setStep(last)} disabled={step >= last}>⏭</button>
        <input
          type="range" min={1} max={last} value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        />
        <span className="step-label">
          {step > n ? t('stepper_done') : t('stepper_step', { s: step, n })}
        </span>
      </div>
      <div className="stepper-text">{describeStep(result, step, t)}</div>
    </div>
  );
}

type T = ReturnType<typeof useI18n>['t'];

function describeStep(result: DrawingResult, step: number, t: T): string {
  const n = result.stats.n;
  if (step > n) {
    const s = result.stats;
    return t('step_finished', { n: s.n, w: s.width, h: s.height, s: s.slopesUsed }) +
      (s.augmented ? t('step_finished_aug') : '');
  }
  const ev = result.trace[step - 1];
  if (!ev) return '';

  const shifts = ev.shiftsLeft + ev.shiftsRight > 0
    ? t('step_shifts', { l: ev.shiftsLeft, r: ev.shiftsRight })
    : '';

  if (ev.st === 1) {
    return t('step_source', { v: ev.v, q: ev.q }) + shifts;
  }
  if (ev.st === n) {
    return t('step_sink', { v: ev.v, n, k: ev.k });
  }
  const intro = ev.k === 1
    ? t('step_vertex_single', { v: ev.v, st: ev.st })
    : t('step_vertex_median', { v: ev.v, st: ev.st, k: ev.k });
  const out = ev.q > 0 ? t('step_out', { q: ev.q }) : '';
  return intro + out + shifts;
}
