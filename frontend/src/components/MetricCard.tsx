import React from 'react';
import { formatMetric, formatMetricName } from '../utils/formatting';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  name: string;
  value: number;
  isPrimary?: boolean;
  delta?: number;
  trainValue?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  name,
  value,
  isPrimary = false,
  delta,
  trainValue,
}) => {
  const higherIsBetter = !['mae', 'mse', 'rmse'].includes(name.toLowerCase());
  const isImproved = delta !== undefined && (higherIsBetter ? delta > 0 : delta < 0);
  const isDeclined = delta !== undefined && (higherIsBetter ? delta < 0 : delta > 0);

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isPrimary
          ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {formatMetricName(name)}
        </span>
        {isPrimary && (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 rounded-md">
            Primary Target
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className={`text-2xl font-bold font-mono tracking-tight ${isPrimary ? 'text-emerald-400' : 'text-white'}`}>
          {formatMetric(value, 4)}
        </span>

        {delta !== undefined && (
          <div
            className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
              isImproved
                ? 'bg-emerald-500/10 text-emerald-400'
                : isDeclined
                ? 'bg-rose-500/10 text-rose-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isImproved ? (
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
            ) : isDeclined ? (
              <TrendingDown className="w-3.5 h-3.5 mr-1" />
            ) : (
              <Minus className="w-3.5 h-3.5 mr-1" />
            )}
            <span>{delta > 0 ? `+${delta.toFixed(4)}` : delta.toFixed(4)}</span>
          </div>
        )}
      </div>

      {trainValue !== undefined && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Train split:</span>
          <span className="font-mono text-slate-300">{formatMetric(trainValue, 4)}</span>
        </div>
      )}
    </div>
  );
};
