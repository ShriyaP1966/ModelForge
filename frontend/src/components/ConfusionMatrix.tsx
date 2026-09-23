import React from 'react';

interface ConfusionMatrixProps {
  data?: {
    matrix: number[][];
    labels: string[];
  };
}

export const ConfusionMatrix: React.FC<ConfusionMatrixProps> = ({ data }) => {
  if (!data || !data.matrix || data.matrix.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Confusion matrix not applicable or not available for this run.
      </div>
    );
  }

  const { matrix, labels } = data;
  const maxVal = Math.max(...matrix.flat(), 1);

  return (
    <div className="flex flex-col items-center">
      <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
        Predicted Class →
      </div>

      <div className="flex">
        {/* Actual class label header */}
        <div className="flex flex-col justify-center items-center mr-3">
          <span className="text-xs font-semibold text-slate-400 -rotate-90 uppercase tracking-wider whitespace-nowrap">
            ← True Class
          </span>
        </div>

        <div className="flex flex-col">
          {/* Top labels */}
          <div className="flex ml-16 mb-2">
            {labels.map((lbl, idx) => (
              <div key={idx} className="w-20 text-center text-xs font-mono text-slate-300 font-semibold truncate px-1">
                {lbl}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {matrix.map((row, rIdx) => (
            <div key={rIdx} className="flex items-center mb-2">
              <div className="w-16 text-right pr-3 text-xs font-mono text-slate-300 font-semibold truncate">
                {labels[rIdx]}
              </div>

              <div className="flex space-x-2">
                {row.map((val, cIdx) => {
                  const intensity = val / maxVal;
                  const isDiagonal = rIdx === cIdx;
                  
                  return (
                    <div
                      key={cIdx}
                      className={`w-20 h-16 rounded-lg flex flex-col items-center justify-center border transition-all ${
                        isDiagonal
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-bold'
                          : intensity > 0
                          ? 'border-slate-700 bg-slate-800 text-slate-200'
                          : 'border-slate-800/60 bg-slate-900/40 text-slate-600'
                      }`}
                      style={{
                        backgroundColor: isDiagonal
                          ? `rgba(16, 185, 129, ${0.15 + intensity * 0.45})`
                          : intensity > 0
                          ? `rgba(244, 63, 94, ${0.08 + intensity * 0.3})`
                          : undefined
                      }}
                      title={`True: ${labels[rIdx]}, Pred: ${labels[cIdx]} = ${val}`}
                    >
                      <span className="text-base font-mono font-bold">{val}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        {((val / Math.max(row.reduce((a, b) => a + b, 0), 1)) * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
