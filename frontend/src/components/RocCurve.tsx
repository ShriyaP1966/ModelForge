import React, { useState } from 'react';

interface RocCurveProps {
  rocData?: {
    fpr: number[];
    tpr: number[];
    auc?: number;
  };
  prData?: {
    precision: number[];
    recall: number[];
  };
}

export const RocCurve: React.FC<RocCurveProps> = ({ rocData, prData }) => {
  const [activeTab, setActiveTab] = useState<'roc' | 'pr'>('roc');

  if (!rocData && !prData) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Curve analytics only available for binary classification models with probability output.
      </div>
    );
  }

  const width = 360;
  const height = 260;
  const padding = 36;

  const toSvgX = (val: number) => padding + val * (width - 2 * padding);
  const toSvgY = (val: number) => height - padding - val * (height - 2 * padding);

  let pathString = '';
  if (activeTab === 'roc' && rocData) {
    const pts = rocData.fpr.map((x, i) => `${toSvgX(x)},${toSvgY(rocData.tpr[i])}`);
    pathString = pts.length > 0 ? `M ${pts.join(' L ')}` : '';
  } else if (activeTab === 'pr' && prData) {
    const pts = prData.recall.map((x, i) => `${toSvgX(x)},${toSvgY(prData.precision[i])}`);
    pathString = pts.length > 0 ? `M ${pts.join(' L ')}` : '';
  }

  return (
    <div className="flex flex-col items-center">
      {/* Tabs */}
      <div className="flex space-x-2 mb-3 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
        {rocData && (
          <button
            onClick={() => setActiveTab('roc')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'roc'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ROC Curve {rocData.auc !== undefined && `(AUC: ${rocData.auc.toFixed(3)})`}
          </button>
        )}
        {prData && (
          <button
            onClick={() => setActiveTab('pr')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'pr'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Precision-Recall Curve
          </button>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative bg-slate-950 p-2 rounded-xl border border-slate-800">
        <svg width={width} height={height} className="overflow-visible">
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1.0].map((v) => (
            <g key={v}>
              {/* Horizontal */}
              <line
                x1={toSvgX(0)}
                y1={toSvgY(v)}
                x2={toSvgX(1)}
                y2={toSvgY(v)}
                stroke="#334155"
                strokeDasharray="2,2"
                strokeWidth="0.8"
              />
              <text
                x={toSvgX(0) - 6}
                y={toSvgY(v) + 3}
                fill="#64748b"
                fontSize="9"
                textAnchor="end"
                fontFamily="monospace"
              >
                {v.toFixed(2)}
              </text>

              {/* Vertical */}
              <line
                x1={toSvgX(v)}
                y1={toSvgY(0)}
                x2={toSvgX(v)}
                y2={toSvgY(1)}
                stroke="#334155"
                strokeDasharray="2,2"
                strokeWidth="0.8"
              />
              <text
                x={toSvgX(v)}
                y={toSvgY(0) + 14}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {v.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Random guessing diagonal baseline for ROC */}
          {activeTab === 'roc' && (
            <line
              x1={toSvgX(0)}
              y1={toSvgY(0)}
              x2={toSvgX(1)}
              y2={toSvgY(1)}
              stroke="#64748b"
              strokeDasharray="4,4"
              strokeWidth="1.5"
            />
          )}

          {/* Actual curve */}
          {pathString && (
            <path
              d={pathString}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Axes */}
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(1)}
            y2={toSvgY(0)}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(0)}
            y2={toSvgY(1)}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* Axis Labels */}
          <text
            x={width / 2}
            y={height - 6}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="middle"
            fontWeight="bold"
          >
            {activeTab === 'roc' ? 'False Positive Rate (FPR)' : 'Recall'}
          </text>
          <text
            x={10}
            y={height / 2}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="middle"
            transform={`rotate(-90 10 ${height / 2})`}
            fontWeight="bold"
          >
            {activeTab === 'roc' ? 'True Positive Rate (TPR)' : 'Precision'}
          </text>
        </svg>
      </div>
    </div>
  );
};
