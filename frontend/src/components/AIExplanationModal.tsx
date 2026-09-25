import React from 'react';
import { Sparkles, X, BrainCircuit, Lightbulb, AlertTriangle, ArrowRightCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { AIExplainResponse } from '../types';

interface AIExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: AIExplainResponse | null;
  loading: boolean;
  error?: string | null;
  experimentName: string;
}

export const AIExplanationModal: React.FC<AIExplanationModalProps> = ({
  isOpen,
  onClose,
  explanation,
  loading,
  error,
  experimentName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">AI Experiment Analysis</h3>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {explanation?.provider === 'offline_deterministic'
                    ? 'Deterministic Engine (Zero-Cost / Offline)'
                    : explanation?.provider || 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Structured interpretation for: {experimentName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <BrainCircuit className="w-8 h-8 text-emerald-400 animate-pulse" />
              <p className="text-slate-400 text-xs font-mono">Synthesizing experiment metadata & formulating hypotheses...</p>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-center">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-rose-300 text-sm font-semibold">Explanation failed</p>
              <p className="text-slate-400 text-xs max-w-sm">{error}</p>
            </div>
          ) : explanation ? (
            <>
              {/* Executive Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 text-slate-200 leading-relaxed font-sans">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                  Executive Summary
                </span>
                {explanation.summary}
              </div>

              {/* What Changed */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Observed Configuration Changes</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  {explanation.what_changed.map((item, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Shifts */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <BrainCircuit className="w-4 h-4 text-sky-400" />
                  <span>Validation Metrics Shift</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  {explanation.performance_shifts.map((item, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                      <span className="text-sky-400 font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grounded Hypotheses */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Plausible Hypotheses</span>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-950/10 border border-amber-500/20 space-y-2">
                  {explanation.plausible_hypotheses.map((item, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-amber-200/90 leading-relaxed">
                      <span className="text-amber-400 font-bold">›</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risks & Limitations */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Risks & Model Limitations</span>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-950/10 border border-rose-500/20 space-y-2">
                  {explanation.risks_and_limitations.map((item, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-rose-200/90 leading-relaxed">
                      <span className="text-rose-400 font-bold">!</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Steps */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <ArrowRightCircle className="w-4 h-4 text-emerald-400" />
                  <span>Recommended Next Experiments</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-950/10 border border-emerald-500/20 space-y-2">
                  {explanation.suggested_next_experiments.map((item, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-emerald-200/90 leading-relaxed">
                      <span className="text-emerald-400 font-bold">→</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500 italic py-8">
              No explanation available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
