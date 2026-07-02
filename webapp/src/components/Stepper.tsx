import { useEffect, useRef, useState } from 'react';
import type { DrawingResult } from '../algorithm/types';

interface Props {
  result: DrawingResult;
  step: number;
  setStep: (s: number) => void;
}

export function Stepper({ result, step, setStep }: Props) {
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
          {playing ? '⏸' : '▶ Abspielen'}
        </button>
        <button onClick={() => setStep(clamp(step + 1))} disabled={step >= last}>▶</button>
        <button onClick={() => setStep(last)} disabled={step >= last}>⏭</button>
        <input
          type="range" min={1} max={last} value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        />
        <span className="step-label">
          {step > n ? 'Fertig' : `Schritt ${step} / ${n}`}
        </span>
      </div>
      <div className="stepper-text">{describeStep(result, step)}</div>
    </div>
  );
}

function describeStep(result: DrawingResult, step: number): string {
  const n = result.stats.n;
  if (step > n) {
    const s = result.stats;
    return `Fertig – die Zeichnung ist vollständig: ${s.n} Knoten auf einem ` +
      `${s.width} × ${s.height}-Gitter mit ${s.slopesUsed} Steigungen und ` +
      `höchstens zwei Knicken pro Kante.` +
      (s.augmented
        ? ' Die gestrichelten Hilfskanten der Augmentierung gehören nicht zum' +
          ' Endergebnis (Schalter „Hilfskanten" blendet sie aus).'
        : '');
  }
  const ev = result.trace[step - 1];
  if (!ev) return '';
  const shifts = ev.shiftsLeft + ev.shiftsRight;
  const shiftText = shifts > 0
    ? ` ${shifts} neue Spalte${shifts === 1 ? '' : 'n'} eingefügt (shift right: ${ev.shiftsLeft} links, ${ev.shiftsRight} rechts).`
    : '';

  if (ev.st === 1) {
    return `Quelle v${ev.v} (st=1) in Zeile 0: ${ev.q} ausgehende Pending-Kanten werden ` +
      `gegen den Uhrzeigersinn an Ports angelegt; die st-Kante ist die linkeste.` + shiftText;
  }
  if (ev.st === n) {
    return `Senke v${ev.v} (st=${n}): alle ${ev.k} Pending-Kanten laufen ein; die Median-Kante ` +
      `endet vertikal in der Knotenspalte, die übrigen schließen mit geneigten Segmenten an.`;
  }
  const inText = ev.k === 1
    ? 'übernimmt die Spalte seiner einzigen eingehenden Pending-Kante'
    : `wird über der Median-Kante seiner ${ev.k} eingehenden Pending-Kanten platziert`;
  const outText = ev.q === 0 ? '' :
    ` ${ev.q} neue Pending-Kante${ev.q === 1 ? '' : 'n'} nach oben.`;
  return `Knoten v${ev.v} (st=${ev.st}) ${inText}; die restlichen In-Kanten knicken über ` +
    `Ports aus S an.${outText}${shiftText}`;
}
