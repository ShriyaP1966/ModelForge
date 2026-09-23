import React, { useState, useEffect } from 'react';
import { Experiment, ReproduceResponse, AIExplainResponse } from '../types';
import { api } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { OverfittingBanner } from '../components/OverfittingBanner';
import { ConfusionMatrix } from '../components/ConfusionMatrix';
import { RocCurve } from '../components/RocCurve';
import { FeatureImportanceChart } from '../components/FeatureImportanceChart';
import { PipelineVisualizer } from '../components/PipelineVisualizer';
import { AIExplanationModal } from '../components/AIExplanationModal';
import { CrossValidationSummary } from '../components/CrossValidationSummary';
import { formatModelName, formatMetric } from '../utils/formatting';
import {
  ArrowLeft,
  RotateCcw,
  Sparkles,
  GitFork,
  GitCompare,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Fingerprint,
} from 'lucide-react';

interface ExperimentDetailPageProps {
  experimentId: number;
  onBack: () => void;
  onNavigateNewBranch: (parentId: number) => void;
  onNavigateCompare: (expAId: number, expBId: number) => void;
}

export const ExperimentDetailPage: React.FC<ExperimentDetailPageProps> = ({
  experimentId,
  onBack,
  onNavigateNewBranch,
  onNavigateCompare,
}) => {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [pipelineGraph, setPipelineGraph] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Reproducibility
  const [reproducing, setReproducing] = useState(false);
  const [reproResult, setReproResult] = useState<ReproduceResponse | null>(null);

  // AI Explanation
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<AIExplainResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [expData, graphData] = await Promise.all([
        api.getExperiment(experimentId),
        api.getPipelineGraph(experimentId),
      ]);
      setExperiment(expData);
      setPipelineGraph(graphData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [experimentId]);

  const handleReproduce = async () => {
    setReproducing(true);
    try {
      const res = await api.reproduceExperiment(experimentId, 1e-4);
      setReproResult(res);
    } catch (err: any) {
      alert(`Reproduce failed: ${err.message}`);
    } finally {
      setReproducing(false);
    }
  };

  const handleExplainAI = async () => {
    setIsAiModalOpen(true);
    if (aiExplanation) return;

    setLoadingAi(true);
    try {
      const res = await api.explainExperiment(experimentId);
      setAiExplanation(res);
    } catch (err: any) {
      alert(`AI explanation failed: ${err.message}`);
    } finally {
      setLoadingAi(false);
    }
  };

  if (loading || !experiment) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center items-center">
        <RotateCcw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Extract artifacts
  const cmArtifact = experiment.artifacts.find((a) => a.artifact_type === 'confusion_matrix');
  const rocArtifact = experiment.artifacts.find((a) => a.artifact_type === 'roc_curve');
  const prArtifact = experiment.artifacts.find((a) => a.artifact_type === 'pr_curve');
  const featArtifact = experiment.artifacts.find((a) => a.artifact_type === 'feature_importance');
  const overfitArtifact = experiment.artifacts.find((a) => a.artifact_type === 'overfitting');
  const residualArtifact = experiment.artifacts.find((a) => a.artifact_type === 'residuals');
  const cvArtifact = experiment.artifacts.find((a) => a.artifact_type === 'cross_validation');

  const valMetrics = experiment.metrics.filter((m) => m.split === 'val');
  const trainMetrics = experiment.metrics.filter((m) => m.split === 'train');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <button onClick={onBack} className="hover:text-white flex items-center gap-1 font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> Project
          </button>
          <span>/</span>
          <span className="text-white font-mono">Experiment #{experiment.id}</span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {experiment.parent_id && (
            <button
              onClick={() => onNavigateCompare(experiment.parent_id!, experiment.id)}
              className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <GitCompare className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Diff with Parent (#{experiment.parent_id})
            </button>
          )}

          <button
            onClick={handleExplainAI}
            className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
            AI Explanation
          </button>

          <button
            onClick={handleReproduce}
            disabled={reproducing}
            className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 text-sky-400 ${reproducing ? 'animate-spin' : ''}`} />
            {reproducing ? 'Reproducing Run...' : 'Reproduce Experiment'}
          </button>

          <button
            onClick={() => onNavigateNewBranch(experiment.id)}
            className="inline-flex items-center px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <GitFork className="w-3.5 h-3.5 mr-1 stroke-[2.5]" />
            Branch Child Experiment
          </button>
        </div>
      </div>

      {/* Experiment Overview Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <StatusBadge status={experiment.status} />
              <span className="text-xs font-mono text-slate-400">
                Random Seed: <strong className="text-white">{experiment.random_seed}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">
                Split: <strong className="text-white">{(experiment.test_size * 100).toFixed(0)}% Test</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">
                Duration: <strong className="text-white">{experiment.duration_ms}ms</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {experiment.name}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
              Architecture: <span className="text-emerald-400 font-semibold">{formatModelName(experiment.model_type)}</span>
              {experiment.description ? ` — ${experiment.description}` : ''}
            </p>
          </div>

          {/* Dataset Fingerprint Tag */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block flex items-center gap-1">
              <Fingerprint className="w-3.5 h-3.5 text-emerald-400" /> Dataset Fingerprint
            </span>
            <span className="text-slate-300 font-bold block mt-1 truncate max-w-[200px]" title={experiment.dataset_fingerprint || ''}>
              {experiment.dataset_fingerprint ? experiment.dataset_fingerprint.substring(0, 16) + '...' : 'Locked'}
            </span>
          </div>
        </div>

        {/* Reproducibility Result Banner if triggered */}
        {reproResult && (
          <div
            className={`p-4 rounded-xl border space-y-3 transition-all ${
              reproResult.within_tolerance
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {reproResult.within_tolerance ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="font-bold text-sm tracking-wide">
                  {reproResult.within_tolerance
                    ? 'Reproducibility Certified: Exact Verification Succeeded'
                    : 'Reproducibility Discrepancy Detected'}
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700">
                Tolerance ε = {reproResult.tolerance}
              </span>
            </div>

            <p className="text-xs leading-relaxed opacity-90">{reproResult.message}</p>

            {/* Metrics Comparison Table */}
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {Object.entries(reproResult.original_metrics).map(([k, orig]) => {
                const rep = reproResult.reproduced_metrics[k];
                const diff = reproResult.metric_differences[k];
                return (
                  <div key={k} className="p-2 rounded bg-slate-950/80 border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block uppercase">{k}</span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-white font-bold">{formatMetric(orig, 4)}</span>
                      <span className="text-emerald-400 font-semibold">→ {formatMetric(rep, 4)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">Δ = {diff?.toFixed(6) ?? '0.000000'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Validation Metrics Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Validation Performance Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {valMetrics.map((m) => {
            const trainMatch = trainMetrics.find((tm) => tm.metric_name === m.metric_name);
            return (
              <MetricCard
                key={m.metric_name}
                name={m.metric_name}
                value={m.metric_value}
                isPrimary={m.metric_name.toLowerCase() === experiment.primary_metric.toLowerCase()}
                trainValue={trainMatch?.metric_value}
              />
            );
          })}
        </div>
      </div>

      {/* Overfitting Diagnostic Banner */}
      {overfitArtifact && (
        <OverfittingBanner overfittingData={overfitArtifact.data} />
      )}

      {/* Cross-Validation Summary */}
      {cvArtifact && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Cross-Validation (Additional to the Split Above)
          </h2>
          <CrossValidationSummary result={cvArtifact.data} />
        </div>
      )}

      {/* Interactive Pipeline Visualizer */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Active Pipeline Graph
          </h2>
          <span className="text-xs text-slate-400">Click any component node to inspect parameters</span>
        </div>

        <PipelineVisualizer pipelineData={pipelineGraph} />
      </div>

      {/* Model Visuals: Confusion Matrix, ROC/PR Curves, Feature Importances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classification Visuals */}
        {cmArtifact && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Confusion Matrix Heatmap
            </h3>
            <ConfusionMatrix data={cmArtifact.data} />
          </div>
        )}

        {(rocArtifact || prArtifact) && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              ROC & Precision-Recall Analysis
            </h3>
            <RocCurve rocData={rocArtifact?.data} prData={prArtifact?.data} />
          </div>
        )}

        {/* Feature Importance Chart */}
        {featArtifact && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Predictive Feature Importance
            </h3>
            <FeatureImportanceChart importances={featArtifact.data?.importances} />
          </div>
        )}

        {/* Regression Residuals Scatter if applicable */}
        {residualArtifact && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Residual Analysis (Predicted vs Actual)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs font-mono max-h-60 overflow-y-auto">
              {residualArtifact.data?.residuals?.map((r: any, idx: number) => (
                <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="flex justify-between text-slate-400 text-[10px]">
                    <span>Act: {r.actual}</span>
                    <span>Pred: {r.predicted}</span>
                  </div>
                  <div className="mt-1 font-bold text-emerald-400 text-right">
                    Δ {r.residual > 0 ? `+${r.residual}` : r.residual}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Explanation Modal */}
      <AIExplanationModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        explanation={aiExplanation}
        loading={loadingAi}
        experimentName={experiment.name}
      />
    </div>
  );
};
