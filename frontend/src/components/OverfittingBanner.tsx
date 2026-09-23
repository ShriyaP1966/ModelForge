import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface OverfittingBannerProps {
  overfittingData?: {
    gap: number;
    is_overfitting: boolean;
    severity: string;
    note: string;
  };
}

export const OverfittingBanner: React.FC<OverfittingBannerProps> = ({ overfittingData }) => {
  if (!overfittingData) return null;

  const { is_overfitting, severity, note, gap } = overfittingData;

  const isHigh = severity === 'High';
  const isModerate = severity === 'Moderate';

  return (
    <div
      className={`p-4 rounded-xl border flex items-start space-x-3 transition-all ${
        isHigh
          ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          : isModerate
          ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
          : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {isHigh ? (
          <AlertCircle className="w-5 h-5 text-rose-400" />
        ) : isModerate ? (
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        ) : (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        )}
      </div>

      <div className="flex-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold tracking-wide">
            {is_overfitting ? `Overfitting Diagnostic: ${severity} Risk` : 'Generalization Diagnostic: Optimal'}
          </span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700">
            Gap: Δ {gap > 0 ? `+${gap.toFixed(3)}` : gap.toFixed(3)}
          </span>
        </div>
        <p className="mt-1 text-xs opacity-90 leading-relaxed">{note}</p>
      </div>
    </div>
  );
};
