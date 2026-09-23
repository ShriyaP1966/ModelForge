import React, { useState } from 'react';

interface CorrelationHeatmapProps {
  correlationMatrix?: Record<string, Record<string, number>>;
}

const cellColor = (value: number): string => {
  if (!Number.isFinite(value)) return 'transparent';
  const intensity = Math.min(Math.abs(value), 1);
  return value >= 0
    ? `rgba(16, 185, 129, ${0.06 + intensity * 0.55})` // emerald: positive correlation
    : `rgba(244, 63, 94, ${0.06 + intensity * 0.55})`; // rose: negative correlation
};

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ correlationMatrix }) => {
  const [hovered, setHovered] = useState<{ row: string; col: string; value: number } | null>(null);

  const columns = correlationMatrix ? Object.keys(correlationMatrix) : [];

  if (!correlationMatrix || columns.length < 2) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Correlation heatmap requires at least two numerical columns. {columns.length === 1
          ? 'This dataset has only one numerical column.'
          : 'This dataset has no numerical columns.'}
      </div>
    );
  }

  const cellSize = columns.length > 10 ? 44 : columns.length > 6 ? 56 : 68;

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {hovered
            ? (
              <span className="font-mono">
                <span className="text-slate-200 font-semibold">{hovered.row}</span> × <span className="text-slate-200 font-semibold">{hovered.col}</span>
                {': '}
                <span className={hovered.value >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {hovered.value.toFixed(3)}
                </span>
              </span>
            )
            : 'Hover a cell to inspect the exact Pearson coefficient'}
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(244, 63, 94, 0.55)' }} /> Negative</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(16, 185, 129, 0.55)' }} /> Positive</span>
        </span>
      </div>

      <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 p-3">
        <div className="inline-flex flex-col min-w-max">
          {/* Column headers */}
          <div className="flex" style={{ marginLeft: cellSize }}>
            {columns.map((c) => (
              <div
                key={c}
                className="flex items-end justify-center text-[10px] font-mono text-slate-400 font-semibold truncate px-0.5"
                style={{ width: cellSize, height: 56 }}
                title={c}
              >
                <span className="-rotate-45 origin-bottom-left whitespace-nowrap">{c}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {columns.map((rowKey) => (
            <div key={rowKey} className="flex items-center">
              <div
                className="text-[10px] font-mono text-slate-400 font-semibold text-right pr-2 truncate"
                style={{ width: cellSize }}
                title={rowKey}
              >
                {rowKey}
              </div>
              {columns.map((colKey) => {
                const raw = correlationMatrix[rowKey]?.[colKey];
                const value = Number.isFinite(raw) ? (raw as number) : 0;
                const isDiagonal = rowKey === colKey;
                return (
                  <div
                    key={colKey}
                    onMouseEnter={() => setHovered({ row: rowKey, col: colKey, value })}
                    onMouseLeave={() => setHovered(null)}
                    className={`flex items-center justify-center border border-slate-900/60 font-mono text-[10px] font-bold cursor-default transition-transform ${
                      isDiagonal ? 'text-slate-500' : 'text-slate-200 hover:scale-[1.06] hover:z-10 hover:border-slate-600'
                    }`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: isDiagonal ? 'rgba(100, 116, 139, 0.12)' : cellColor(value),
                    }}
                  >
                    {value.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
