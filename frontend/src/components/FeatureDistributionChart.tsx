import React from 'react';
import { ColumnSummary } from '../types';

interface FeatureDistributionChartProps {
  column?: ColumnSummary;
}

const NumericHistogram: React.FC<{ column: ColumnSummary }> = ({ column }) => {
  const hist = column.stats.histogram!;
  const { min, max, q25, median, q75 } = column.stats;
  const maxCount = Math.max(...hist.counts, 1);

  const width = 560;
  const height = 160;
  const barGap = 2;
  const barWidth = (width - barGap * (hist.counts.length - 1)) / hist.counts.length;

  const domainMin = hist.bin_edges[0];
  const domainMax = hist.bin_edges[hist.bin_edges.length - 1];
  const domainRange = domainMax - domainMin > 0 ? domainMax - domainMin : 1;
  const toX = (val: number) => ((val - domainMin) / domainRange) * width;

  return (
    <div className="space-y-3">
      <div className="bg-slate-950 rounded-xl border border-slate-800 p-3">
        <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full h-auto">
          {hist.counts.map((count, idx) => {
            const barHeight = (count / maxCount) * height;
            return (
              <g key={idx}>
                <rect
                  x={idx * (barWidth + barGap)}
                  y={height - barHeight}
                  width={barWidth}
                  height={barHeight}
                  fill="rgba(16, 185, 129, 0.55)"
                  stroke="rgba(16, 185, 129, 0.9)"
                  strokeWidth="0.5"
                />
                <title>
                  {`[${hist.bin_edges[idx].toFixed(2)}, ${hist.bin_edges[idx + 1].toFixed(2)}) — ${count} rows`}
                </title>
              </g>
            );
          })}
          <line x1={0} y1={height} x2={width} y2={height} stroke="#334155" strokeWidth="1" />
          <text x={0} y={height + 16} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="start">
            {domainMin.toFixed(2)}
          </text>
          <text x={width} y={height + 16} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
            {domainMax.toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Compact box-plot strip using the same min/q25/median/q75/max summary
          already computed server-side. */}
      {min !== undefined && max !== undefined && q25 !== undefined && q75 !== undefined && median !== undefined && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Box Plot (5-Number Summary)</div>
          <svg viewBox={`0 0 ${width} 48`} className="w-full h-auto">
            {/* Whisker line */}
            <line x1={toX(min)} y1={24} x2={toX(max)} y2={24} stroke="#64748b" strokeWidth="1.5" />
            <line x1={toX(min)} y1={14} x2={toX(min)} y2={34} stroke="#64748b" strokeWidth="1.5" />
            <line x1={toX(max)} y1={14} x2={toX(max)} y2={34} stroke="#64748b" strokeWidth="1.5" />
            {/* IQR box */}
            <rect
              x={toX(q25)}
              y={8}
              width={Math.max(toX(q75) - toX(q25), 1)}
              height={32}
              fill="rgba(16, 185, 129, 0.18)"
              stroke="#10b981"
              strokeWidth="1.5"
            />
            {/* Median line */}
            <line x1={toX(median)} y1={8} x2={toX(median)} y2={40} stroke="#34d399" strokeWidth="2.5" />
            <title>{`min ${min.toFixed(2)} · q25 ${q25.toFixed(2)} · median ${median.toFixed(2)} · q75 ${q75.toFixed(2)} · max ${max.toFixed(2)}`}</title>
          </svg>
          <div className="flex justify-between mt-1 text-[10px] font-mono text-slate-400">
            <span>min {min.toFixed(2)}</span>
            <span>q25 {q25.toFixed(2)}</span>
            <span className="text-emerald-400 font-bold">median {median.toFixed(2)}</span>
            <span>q75 {q75.toFixed(2)}</span>
            <span>max {max.toFixed(2)}</span>
          </div>
        </div>
      )}

      {column.outlier_count > 0 && (
        <p className="text-[11px] text-amber-400/90 font-mono">
          {column.outlier_count} outlier{column.outlier_count === 1 ? '' : 's'} detected via IQR (1.5× rule), beyond the whiskers above.
        </p>
      )}
    </div>
  );
};

const CategoricalBarChart: React.FC<{ column: ColumnSummary }> = ({ column }) => {
  const topCategories = Object.entries(column.stats.top_categories || {});
  const maxCount = Math.max(...topCategories.map(([, v]) => v), 1);

  return (
    <div className="space-y-2.5">
      {topCategories.map(([label, count]) => {
        const pct = (count / maxCount) * 100;
        return (
          <div key={label} className="group">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-mono text-slate-300 font-semibold truncate max-w-xs" title={label}>
                {label}
              </span>
              <span className="font-mono text-slate-400 text-[11px]">{count} rows</span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-600 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
      {column.unique_count > topCategories.length && (
        <p className="text-[11px] text-slate-500 italic">
          Showing top {topCategories.length} of {column.unique_count} distinct values.
        </p>
      )}
    </div>
  );
};

export const FeatureDistributionChart: React.FC<FeatureDistributionChartProps> = ({ column }) => {
  if (!column) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Select a column above to inspect its distribution.
      </div>
    );
  }

  if (column.stats.histogram) {
    return <NumericHistogram column={column} />;
  }

  if (column.stats.top_categories && Object.keys(column.stats.top_categories).length > 0) {
    return <CategoricalBarChart column={column} />;
  }

  return (
    <div className="p-8 text-center text-slate-500 text-sm italic">
      {column.is_constant
        ? `"${column.name}" is constant (a single repeated value) — there is no distribution shape to visualize.`
        : `Not enough distinct values in "${column.name}" to render a distribution chart.`}
    </div>
  );
};
