import { useState } from 'react';
import type { InputGraph } from '../algorithm/types';
import { EXAMPLES } from '../examples';
import { randomPlanarGraph } from '../random';

interface Props {
  onLoad: (g: InputGraph) => void;
}

export function Gallery({ onLoad }: Props) {
  const [n, setN] = useState(16);
  const [density, setDensity] = useState(0.6);
  const [seed, setSeed] = useState(1);

  return (
    <div className="gallery">
      <div className="gallery-examples">
        {EXAMPLES.map((ex) => (
          <button key={ex.id} title={ex.description} onClick={() => onLoad(structuredClone(ex.graph))}>
            {ex.name}
          </button>
        ))}
      </div>
      <div className="gallery-random">
        <label>
          n = {n}
          <input type="range" min={5} max={80} value={n}
            onChange={(e) => setN(Number(e.target.value))} />
        </label>
        <label>
          Dichte = {density.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={density}
            onChange={(e) => setDensity(Number(e.target.value))} />
        </label>
        <button
          onClick={() => {
            onLoad(randomPlanarGraph(n, density, seed));
            setSeed(seed + 1);
          }}
        >
          Zufallsgraph
        </button>
      </div>
    </div>
  );
}
