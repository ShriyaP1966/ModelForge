import React from 'react';
import { CrossValidationResult } from '../types';
import { AlertTriangle } from 'lucide-react';

interface CrossValidationSummaryProps {
  result?: CrossValidationResult;
}

export const CrossValidationSummary: React.FC<CrossValidationSummaryProps> = ({ result }) => {
  if (!result) return null;

  if (result.error || result.mean === null) {
    return (
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{result.error || 'Cross-validation could not be computed for this run.'}</span>
      </div>
    );
  }

  const maxScore = Math.max(...result.scores, result.mean, 0.0001);
  const minScore = Math.min(...result.scores, result.mean);
  const range = maxScore - minScore > 0 ? maxScore - minScore : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-400">
          {result.effective_folds}-fold CV on <span className="text-emerald-400 font-bold uppercase">{result.metric}</span>
          {result.effective_folds !== result.requested_folds && (
            <span className="text-amber-500/80"> (reduced from {result.requested_folds} — dataset too small)</span>
          )}
        </span>
        <span className="font-mono text-sm">
          <span className="text-white font-bold">{result.mean.toFixed(4)}</span>
          <span className="text-slate-400"> ± {result.std?.toFixed(4)}</span>
        </span>
      </div>

      <div className="flex items-end gap-1.5 h-16">
        {result.scores.map((score, idx) => {
          const heightPct = Math.max(((score - minScore) / range) * 80 + 15, 8);
          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-[9px] font-mono text-slate-500">{score.toFixed(3)}</span>
              <div
                className="w-full rounded-t bg-gradient-to-t from-emerald-700 to-emerald-400"
                style={{ height: `${heightPct}%` }}
                title={`Fold ${idx + 1}: ${score.toFixed(4)}`}
              />
              <span className="text-[9px] font-mono text-slate-600">F{idx + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
