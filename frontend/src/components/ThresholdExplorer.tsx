import React, { useMemo, useState } from 'react';
import { ConfusionMatrix } from './ConfusionMatrix';
import { RocCurve } from './RocCurve';
import { ThresholdAnalysis, bestF1Index, metricsAtIndex, nearestIndex } from '../utils/threshold';

interface ThresholdExplorerProps {
  analysis: ThresholdAnalysis;
  rocData?: { fpr: number[]; tpr: number[]; auc?: number };
  prData?: { precision: number[]; recall: number[] };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export const ThresholdExplorer: React.FC<ThresholdExplorerProps> = ({ analysis, rocData, prData }) => {
  const defaultIndex = useMemo(() => nearestIndex(analysis, 0.5), [analysis]);
  const bestIndex = useMemo(() => bestF1Index(analysis), [analysis]);
  const [index, setIndex] = useState(defaultIndex);

  const m = metricsAtIndex(analysis, index);
  const matrix = { matrix: [[m.tn, m.fp], [m.fn, m.tp]], labels: [analysis.negative_label, analysis.positive_label] };

  const tiles: { label: string; value: string }[] = [
    { label: 'Precision', value: pct(m.precision) },
    { label: 'Recall', value: pct(m.recall) },
    { label: 'F1', value: pct(m.f1) },
    { label: 'Accuracy', value: pct(m.accuracy) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label htmlFor="threshold-slider" className="text-xs font-semibold text-slate-300 whitespace-nowrap">
          Decision threshold for <span className="font-mono text-emerald-300">{analysis.positive_label}</span>
        </label>
        <input
          id="threshold-slider"
          type="range"
          min={0}
          max={analysis.thresholds.length - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`Threshold ${m.threshold.toFixed(2)}`}
          className="flex-1 accent-emerald-500"
        />
        <span className="font-mono text-sm text-emerald-300 w-12 text-right" data-testid="threshold-value">
          {m.threshold.toFixed(2)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIndex(defaultIndex)}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
          >
            Reset to 0.50
          </button>
          <button
            type="button"
            onClick={() => setIndex(bestIndex)}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
          >
            Best F1 ({analysis.thresholds[bestIndex].toFixed(2)})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{t.label}</div>
            <div className="text-lg font-mono font-bold text-slate-100">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <ConfusionMatrix data={matrix} />
        <RocCurve
          rocData={rocData}
          prData={prData}
          operatingPoint={{ fpr: m.fpr, tpr: m.recall, precision: m.precision, recall: m.recall }}
        />
      </div>
    </div>
  );
};
