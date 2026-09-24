import React from 'react';
import { LearningCurveResult } from '../types';

interface LearningCurveChartProps {
  result?: LearningCurveResult;
}

export const LearningCurveChart: React.FC<LearningCurveChartProps> = ({ result }) => {
  if (!result || result.error) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        {result?.error || 'Learning curve not available for this run.'}
      </div>
    );
  }

  const { train_sizes, train_scores_mean, val_scores_mean } = result;
  if (!train_sizes || train_sizes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Not enough data to compute a learning curve for this run.
      </div>
    );
  }

  const width = 640;
  const height = 260;
  const paddingX = 56;
  const paddingY = 32;

  const allScores = [...train_scores_mean, ...val_scores_mean].filter(
    (v): v is number => v !== null && Number.isFinite(v)
  );

  if (allScores.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Every fold failed to fit at every sampled training size for this run
        (likely too little data) -- no learning curve to show.
      </div>
    );
  }

  const minVal = Math.min(...allScores, 0);
  const maxVal = Math.max(...allScores, 1);
  const range = maxVal - minVal > 0 ? maxVal - minVal : 1;

  const getX = (idx: number) =>
    train_sizes.length === 1 ? width / 2 : paddingX + (idx / (train_sizes.length - 1)) * (width - 2 * paddingX);
  const getY = (val: number) => height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);

  // Build a path string that skips over null (unfittable) points, so a gap
  // in the data becomes a visible gap in the line rather than a crash or a
  // misleading straight line jumping across it.
  const buildPath = (scores: (number | null)[]) => {
    let d = '';
    let drawing = false;
    scores.forEach((val, idx) => {
      if (val === null || !Number.isFinite(val)) {
        drawing = false;
        return;
      }
      const cmd = drawing ? 'L' : 'M';
      d += `${cmd}${getX(idx)},${getY(val)} `;
      drawing = true;
    });
    return d.trim();
  };

  const trainPath = buildPath(train_scores_mean);
  const valPath = buildPath(val_scores_mean);

  const gapNote =
    val_scores_mean.some((v) => v === null) || train_scores_mean.some((v) => v === null);

  return (
    <div className="w-full flex flex-col items-center space-y-2">
      <div className="w-full flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider">
          Metric: <span className="text-emerald-400 font-mono">{result.metric.toUpperCase()}</span>
        </span>
        <span className="flex items-center gap-4 font-mono text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-sky-400 inline-block" /> Training score</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> Validation score ({result.folds}-fold)</span>
        </span>
      </div>

      <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const gridVal = minVal + pct * range;
            const y = getY(gridVal);
            return (
              <g key={i}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#1e293b" strokeDasharray="2,2" strokeWidth="1" />
                <text x={paddingX - 8} y={y + 3} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
                  {gridVal.toFixed(2)}
                </text>
              </g>
            );
          })}

          {trainPath && <path d={trainPath} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {valPath && <path d={valPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

          {train_scores_mean.map((val, idx) =>
            val !== null && Number.isFinite(val) ? (
              <circle key={`t${idx}`} cx={getX(idx)} cy={getY(val)} r="3.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            ) : null
          )}
          {val_scores_mean.map((val, idx) =>
            val !== null && Number.isFinite(val) ? (
              <circle key={`v${idx}`} cx={getX(idx)} cy={getY(val)} r="3.5" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
            ) : null
          )}

          {train_sizes.map((n, idx) => (
            <text key={idx} x={getX(idx)} y={height - 10} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="middle">
              {n}
            </text>
          ))}
          <text x={width / 2} y={height - 0} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
            Training Set Size (rows)
          </text>
        </svg>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl text-center">
        A validation score that keeps rising toward the training score as size increases suggests more data
        would help. A wide, flat gap between the two suggests overfitting regardless of data size.
        {gapNote && ' Gaps in a line mean that training size was too small (or too imbalanced) to fit at all.'}
      </p>
    </div>
  );
};
