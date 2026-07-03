import { useEffect, useRef, useState } from 'react';
import type { OneBendResult } from '../algorithm/onebend/types';
import { useI18n } from '../i18n';

interface Props {
  result: OneBendResult;
  /** 1..S = Snapshots; S+1 = Schritt "Fertig". */
  step: number;
  setStep: (s: number) => void;
}

export function OneBendStepper({ result, step, setStep }: Props) {
  const { t } = useI18n();
  const S = result.snapshots.length;
  const last = S + 1;
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
          {step > S ? t('stepper_done') : t('stepper_step', { s: step, n: S })}
        </span>
      </div>
      <div className="stepper-text">{describeStep(result, step, t)}</div>
    </div>
  );
}

type T = ReturnType<typeof useI18n>['t'];

function describeStep(result: OneBendResult, step: number, t: T): string {
  const S = result.snapshots.length;
  if (step > S) {
    const s = result.stats;
    return t('ob_step_finished', { n: s.n, w: s.width, h: s.height, s: s.slopesUsed }) +
      (s.augmented ? t('step_finished_aug') : '');
  }
  const snap = result.snapshots[step - 1];
  if (!snap) return '';
  const d3 = result.stats.deltaEff - 3;
  switch (snap.kind) {
    case 'base':
      return t('ob_step_base', { v1: result.v1, v2: result.v2, size: snap.partSize - 2 });
    case 'chain':
      return t('ob_step_chain', { i: snap.partIndex, size: snap.partSize });
    case 'singleton':
      return t('ob_step_singleton', { i: snap.partIndex, q: snap.q ?? 0, d3 });
    case 'special':
      return t('ob_step_special', { vn: result.vn });
    case 'closing':
      return t('ob_step_closing', { v1: result.v1, v2: result.v2, d3 });
  }
}
