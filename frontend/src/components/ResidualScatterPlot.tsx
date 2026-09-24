import React, { useState } from 'react';
import { ResidualPoint } from '../types';

interface ResidualScatterPlotProps {
  residuals?: ResidualPoint[];
}

export const ResidualScatterPlot: React.FC<ResidualScatterPlotProps> = ({ residuals }) => {
  const [hovered, setHovered] = useState<ResidualPoint | null>(null);

  if (!residuals || residuals.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        No residual data available for this run.
      </div>
    );
  }

  const finite = residuals.filter(
    (r) => Number.isFinite(r.actual) && Number.isFinite(r.predicted)
  );
  if (finite.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Residual data for this run contains no plottable values.
      </div>
    );
  }

  const width = 560;
  const height = 320;
  const padding = 44;

  const allVals = finite.flatMap((r) => [r.actual, r.predicted]);
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  // Pad the domain a little so points never sit flush against the frame,
  // and guard against a degenerate zero-width domain (all values identical).
  const span = rawMax - rawMin > 0 ? rawMax - rawMin : Math.max(Math.abs(rawMax), 1);
  const domainMin = rawMin - span * 0.08;
  const domainMax = rawMax + span * 0.08;
  const domainRange = domainMax - domainMin > 0 ? domainMax - domainMin : 1;

  const toX = (val: number) => padding + ((val - domainMin) / domainRange) * (width - 2 * padding);
  const toY = (val: number) => height - padding - ((val - domainMin) / domainRange) * (height - 2 * padding);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => domainMin + t * domainRange);

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="w-full flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider">Predicted vs Actual</span>
        <span>
          {hovered
            ? (
              <span className="font-mono">
                Actual <span className="text-white font-bold">{hovered.actual}</span> · Predicted{' '}
                <span className="text-emerald-400 font-bold">{hovered.predicted}</span> · Δ{' '}
                <span className={hovered.residual >= 0 ? 'text-sky-400' : 'text-rose-400'}>
                  {hovered.residual > 0 ? `+${hovered.residual}` : hovered.residual}
                </span>
              </span>
            )
            : `${finite.length} sampled validation points — closer to the diagonal is better`}
        </span>
      </div>

      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Gridlines */}
          {ticks.map((v, i) => (
            <g key={i}>
              <line x1={toX(v)} y1={padding} x2={toX(v)} y2={height - padding} stroke="#1e293b" strokeDasharray="2,2" strokeWidth="1" />
              <line x1={padding} y1={toY(v)} x2={width - padding} y2={toY(v)} stroke="#1e293b" strokeDasharray="2,2" strokeWidth="1" />
              <text x={toX(v)} y={height - padding + 16} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="middle">
                {v.toFixed(1)}
              </text>
              <text x={padding - 8} y={toY(v) + 3} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Perfect-prediction reference line (y = x) */}
          <line
            x1={toX(domainMin)} y1={toY(domainMin)}
            x2={toX(domainMax)} y2={toY(domainMax)}
            stroke="#64748b" strokeDasharray="5,4" strokeWidth="1.5"
          />

          {/* Axes */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" strokeWidth="1.5" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" strokeWidth="1.5" />

          {/* Points */}
          {finite.map((r, idx) => (
            <circle
              key={idx}
              cx={toX(r.predicted)}
              cy={toY(r.actual)}
              r={hovered === r ? 5 : 3.5}
              fill={r.residual >= 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(251, 113, 133, 0.7)'}
              stroke={r.residual >= 0 ? '#38bdf8' : '#fb7185'}
              strokeWidth="1"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHovered(r)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          <text x={width / 2} y={height - 6} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
            Predicted Value
          </text>
          <text x={12} y={height / 2} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`}>
            Actual Value
          </text>
        </svg>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-500" style={{ borderTop: '1px dashed #64748b' }} /> Perfect prediction (y = x)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(56, 189, 248, 0.7)' }} /> Over-predicted (residual ≥ 0)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(251, 113, 133, 0.7)' }} /> Under-predicted (residual &lt; 0)
        </span>
      </div>
    </div>
  );
};
