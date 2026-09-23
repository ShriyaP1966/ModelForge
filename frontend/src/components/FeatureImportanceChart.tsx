import React from 'react';

interface FeatureImportanceProps {
  importances?: Array<{ feature: string; importance: number }>;
}

export const FeatureImportanceChart: React.FC<FeatureImportanceProps> = ({ importances }) => {
  if (!importances || importances.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Feature importance not extracted or not available for this model type.
      </div>
    );
  }

  const maxVal = Math.max(...importances.map((f) => f.importance), 0.001);

  return (
    <div className="space-y-2.5">
      {importances.slice(0, 10).map((item, idx) => {
        const pct = (item.importance / maxVal) * 100;

        return (
          <div key={idx} className="group">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-mono text-slate-300 font-semibold group-hover:text-emerald-400 transition-colors truncate max-w-xs">
                {item.feature.replace(/^num__|^cat__/, '')}
              </span>
              <span className="font-mono text-slate-400 text-[11px]">
                {(item.importance * 100).toFixed(1)}%
              </span>
            </div>

            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
