import React from 'react';
import { formatMetric, formatModelName } from '../utils/formatting';

interface EvolutionPoint {
  id: number;
  name: string;
  model_type: string;
  primary_metric: string;
  validation_metrics: Record<string, number>;
  training_metrics: Record<string, number>;
}

interface EvolutionChartProps {
  timeline: EvolutionPoint[];
  selectedId?: number;
  onSelectExperiment: (id: number) => void;
  metricKey?: string;
}

export const EvolutionChart: React.FC<EvolutionChartProps> = ({
  timeline,
  selectedId,
  onSelectExperiment,
  metricKey,
}) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        No completed experiments to display in evolution timeline yet. Run multiple experiments to visualize model evolution!
      </div>
    );
  }

  const activeMetric = metricKey || timeline[0]?.primary_metric || 'f1';
  const higherIsBetter = !['mae', 'mse', 'rmse'].includes(activeMetric.toLowerCase());

  // Extract points
  const points = timeline.map((exp, idx) => {
    const val = exp.validation_metrics[activeMetric] ?? exp.validation_metrics[exp.primary_metric] ?? 0;
    const trainVal = exp.training_metrics[activeMetric] ?? exp.training_metrics[exp.primary_metric];
    return {
      id: exp.id,
      name: exp.name,
      model_type: exp.model_type,
      val,
      trainVal,
      idx,
    };
  });

  const values = points.map((p) => p.val);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1.0);
  const range = maxVal - minVal > 0 ? maxVal - minVal : 1;

  const width = 640;
  const height = 240;
  const paddingX = 60;
  const paddingY = 40;

  const getX = (idx: number) => {
    if (points.length === 1) return width / 2;
    return paddingX + (idx / (points.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val: number) => {
    return height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);
  };

  const pathStr = points.map((p, i) => `${getX(i)},${getY(p.val)}`).join(' L ');

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2 px-2 text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider">
          Metric Evolution: <span className="text-emerald-400 font-mono">{activeMetric.toUpperCase()}</span>
        </span>
        <span>{points.length} sequential experiment iterations</span>
      </div>

      <div className="relative w-full overflow-x-auto bg-slate-950 p-3 rounded-xl border border-slate-800">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
          {/* Background grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const gridVal = minVal + pct * range;
            const y = getY(gridVal);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="2,2"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 10}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {gridVal.toFixed(3)}
                </text>
              </g>
            );
          })}

          {/* Evolution Line */}
          {points.length > 1 && (
            <path
              d={`M ${pathStr}`}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Nodes */}
          {points.map((p, i) => {
            const cx = getX(i);
            const cy = getY(p.val);
            const isSelected = p.id === selectedId;

            return (
              <g
                key={p.id}
                className="cursor-pointer group"
                onClick={() => onSelectExperiment(p.id)}
              >
                {/* Glow ring on selected */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="12"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeOpacity="0.5"
                    className="animate-pulse"
                  />
                )}

                {/* Node Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? '7' : '5'}
                  fill={isSelected ? '#10b981' : '#0f172a'}
                  stroke="#10b981"
                  strokeWidth={isSelected ? '3' : '2'}
                  className="transition-all duration-200 group-hover:scale-125"
                />

                {/* Score Label above node */}
                <text
                  x={cx}
                  y={cy - 12}
                  fill={isSelected ? '#34d399' : '#e2e8f0'}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {p.val.toFixed(3)}
                </text>

                {/* Experiment Name / ID below axis */}
                <text
                  x={cx}
                  y={height - 15}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  #{p.id} {formatModelName(p.model_type).split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
