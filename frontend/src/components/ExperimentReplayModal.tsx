import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, RotateCcw, Award } from 'lucide-react';
import { formatModelName, formatMetric } from '../utils/formatting';
import { PipelineVisualizer } from './PipelineVisualizer';

interface ExperimentReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeline: any[];
}

export const ExperimentReplayModal: React.FC<ExperimentReplayModalProps> = ({
  isOpen,
  onClose,
  timeline,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1500);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= timeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speedMs);
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeline.length, speedMs]);

  if (!isOpen || timeline.length === 0) return null;

  const current = timeline[currentIndex];
  const previous = currentIndex > 0 ? timeline[currentIndex - 1] : null;

  const pmKey = current?.primary_metric || 'f1';
  const currentVal = current?.validation_metrics[pmKey];
  const prevVal = previous?.validation_metrics[pmKey];
  const delta = prevVal !== undefined && currentVal !== undefined ? currentVal - prevVal : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">Experiment Replay</h3>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
              Step {currentIndex + 1} of {timeline.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Active Experiment Highlight Card */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  Experiment #{current.id}
                </span>
                <span className="text-xs text-slate-400">{new Date(current.created_at).toLocaleTimeString()}</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">{current.name}</h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Architecture: <span className="text-slate-200">{formatModelName(current.model_type)}</span>
              </p>
            </div>

            {/* Metric Shift Counter */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 min-w-[160px] text-right">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                {pmKey.toUpperCase()} Score
              </span>
              <div className="flex items-baseline justify-end space-x-2">
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {formatMetric(currentVal, 4)}
                </span>
                {delta !== undefined && (
                  <span className={`text-xs font-mono font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(current.validation_metrics).map(([k, v]) => (
              <div key={k} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {k}
                </span>
                <span className="text-base font-bold font-mono text-white mt-1 block">
                  {formatMetric(v as number, 4)}
                </span>
              </div>
            ))}
          </div>

          {/* Preprocessing & Feature Snapshot */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] block">
              Active Configuration Snapshot
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">SCALER</span>
                <span className="text-slate-200">{current.preprocessing_config?.scaler || 'none'}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">IMPUTER</span>
                <span className="text-slate-200">{current.preprocessing_config?.imputer_strategy || 'mean'}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">FEATURES</span>
                <span className="text-slate-200">
                  {current.feature_selection?.length ? `${current.feature_selection.length} selected` : 'All Features'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Player Controls Footer */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex flex-col space-y-3">
          {/* Progress Timeline Slider */}
          <input
            type="range"
            min={0}
            max={timeline.length - 1}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(parseInt(e.target.value));
            }}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={currentIndex === 0}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex((prev) => Math.min(timeline.length - 1, prev + 1));
                }}
                disabled={currentIndex === timeline.length - 1}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <span>Speed:</span>
              <button
                onClick={() => setSpeedMs(2000)}
                className={`px-2 py-0.5 rounded ${speedMs === 2000 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'hover:bg-slate-800'}`}
              >
                0.5x
              </button>
              <button
                onClick={() => setSpeedMs(1200)}
                className={`px-2 py-0.5 rounded ${speedMs === 1200 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'hover:bg-slate-800'}`}
              >
                1x
              </button>
              <button
                onClick={() => setSpeedMs(600)}
                className={`px-2 py-0.5 rounded ${speedMs === 600 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'hover:bg-slate-800'}`}
              >
                2x
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
