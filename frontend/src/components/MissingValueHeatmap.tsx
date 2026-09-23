import React from 'react';
import { ColumnSummary } from '../types';
import { CheckCircle2 } from 'lucide-react';

interface MissingValueHeatmapProps {
  columns?: ColumnSummary[];
}

// Mirrors the severity thresholds the backend's health-score penalty logic
// already uses (dataset_analyzer.py: >25% = high, >5% = moderate), so the
// visualization agrees with the health score rather than inventing its own cutoffs.
const severityColor = (pct: number): { bg: string; label: string } => {
  if (pct <= 0) return { bg: 'rgba(51, 65, 85, 0.5)', label: 'None' };
  if (pct <= 5) return { bg: 'rgba(20, 184, 166, 0.45)', label: 'Low' };
  if (pct <= 25) return { bg: 'rgba(245, 158, 11, 0.5)', label: 'Moderate' };
  return { bg: 'rgba(244, 63, 94, 0.55)', label: 'High' };
};

export const MissingValueHeatmap: React.FC<MissingValueHeatmapProps> = ({ columns }) => {
  if (!columns || columns.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        No column information available to render missing-value diagnostics.
      </div>
    );
  }

  const anyMissing = columns.some((c) => c.missing_count > 0);

  if (!anyMissing) {
    return (
      <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>No missing values detected across any of the {columns.length} columns.</span>
      </div>
    );
  }

  const sorted = [...columns].sort((a, b) => b.missing_pct - a.missing_pct);

  return (
    <div className="space-y-1.5">
      {sorted.map((col) => {
        const { bg, label } = severityColor(col.missing_pct);
        return (
          <div key={col.name} className="flex items-center gap-3 text-xs font-mono">
            <span className="w-32 sm:w-40 truncate text-slate-300 font-semibold" title={col.name}>
              {col.name}
            </span>
            <div className="flex-1 h-5 rounded bg-slate-900 border border-slate-800 overflow-hidden relative">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${Math.max(col.missing_pct, col.missing_pct > 0 ? 1.5 : 0)}%`, backgroundColor: bg }}
              />
            </div>
            <span className="w-28 text-right text-slate-400 flex-shrink-0">
              {col.missing_count} ({col.missing_pct}%)
            </span>
            <span
              className="w-16 text-right text-[10px] uppercase tracking-wider font-bold flex-shrink-0"
              style={{ color: col.missing_pct <= 0 ? '#64748b' : col.missing_pct <= 5 ? '#2dd4bf' : col.missing_pct <= 25 ? '#f59e0b' : '#fb7185' }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
