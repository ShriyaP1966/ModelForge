import React from 'react';
import { ExperimentDiffResponse } from '../types';
import { formatModelName, formatMetric } from '../utils/formatting';
import { ArrowRight, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ExperimentDiffViewProps {
  diffData: ExperimentDiffResponse;
}

export const ExperimentDiffView: React.FC<ExperimentDiffViewProps> = ({ diffData }) => {
  const { experiment_a, experiment_b, diffs, metrics_diff } = diffData;

  return (
    <div className="space-y-6">
      {/* Header comparison card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-1">
            Baseline / Previous Run
          </span>
          <div className="flex items-baseline justify-between">
            <h4 className="text-base font-bold text-white">#{experiment_a.id} {experiment_a.name}</h4>
            <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {formatModelName(experiment_a.model_type)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30">
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold block mb-1">
            Candidate / Current Run
          </span>
          <div className="flex items-baseline justify-between">
            <h4 className="text-base font-bold text-white">#{experiment_b.id} {experiment_b.name}</h4>
            <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              {formatModelName(experiment_b.model_type)}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Impact Section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Evaluation Metrics Shift
          </h4>
          <span className="text-xs text-slate-400">Δ = (Current - Previous)</span>
        </div>

        <div className="divide-y divide-slate-800 text-xs">
          {metrics_diff.map((m) => {
            const isImproved = m.status === 'improved';
            const isDeclined = m.status === 'declined';

            return (
              <div key={m.metric} className="p-3.5 flex items-center justify-between hover:bg-slate-850/50">
                <span className="font-semibold text-slate-300 uppercase tracking-wide w-1/4">
                  {m.metric.toUpperCase()}
                </span>

                <div className="flex items-center space-x-8 font-mono">
                  <span className="text-slate-400">{formatMetric(m.previous, 4)}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-white font-bold">{formatMetric(m.current, 4)}</span>
                </div>

                <div className="w-1/4 flex justify-end">
                  <div
                    className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs ${
                      isImproved
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isDeclined
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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
                    <span>
                      {m.delta !== undefined && m.delta > 0 ? `+${m.delta.toFixed(4)}` : m.delta?.toFixed(4) || '0.0000'}
                      {m.pct_change !== undefined && ` (${m.pct_change > 0 ? '+' : ''}${m.pct_change.toFixed(1)}%)`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration & Hyperparameters Diff Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Configuration & Hyperparameters Diff
          </h4>
          <span className="text-xs text-slate-400">
            {diffs.filter((d) => d.changed).length} modifications detected
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 font-semibold">Property</th>
                <th className="py-2.5 px-4 font-semibold">Previous (#{experiment_a.id})</th>
                <th className="py-2.5 px-4 font-semibold">Current (#{experiment_b.id})</th>
                <th className="py-2.5 px-4 font-semibold">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {diffs.map((item, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    item.changed ? 'bg-amber-950/10 hover:bg-amber-950/20' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="py-3 px-4 text-slate-400 font-sans font-medium">{item.category}</td>
                  <td className="py-3 px-4 font-semibold text-slate-200">{item.property}</td>
                  <td className="py-3 px-4 text-slate-400 truncate max-w-xs">{String(item.previous)}</td>
                  <td className={`py-3 px-4 font-bold truncate max-w-xs ${item.changed ? 'text-amber-300' : 'text-slate-300'}`}>
                    {String(item.current)}
                  </td>
                  <td className="py-3 px-4">
                    {item.changed ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        MODIFIED
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[10px]">UNCHANGED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
