import React, { useState, useEffect } from 'react';
import { Project, Dataset, Experiment, LineageNode } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { LineageTree } from '../components/LineageTree';
import { EvolutionChart } from '../components/EvolutionChart';
import { ExperimentReplayModal } from '../components/ExperimentReplayModal';
import { formatModelName, formatMetric } from '../utils/formatting';
import {
  Activity,
  Database,
  Plus,
  GitCompare,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  Trash2,
  GitFork,
  CheckCircle2,
} from 'lucide-react';

interface ProjectDetailPageProps {
  projectId: number;
  onBack: () => void;
  onNavigateDataset: (datasetId: number) => void;
  onNavigateNewExperiment: (parentId?: number) => void;
  onNavigateExperiment: (experimentId: number) => void;
  onNavigateCompare: (expAId?: number, expBId?: number) => void;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  projectId,
  onBack,
  onNavigateDataset,
  onNavigateNewExperiment,
  onNavigateExperiment,
  onNavigateCompare,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [lineage, setLineage] = useState<LineageNode[]>([]);
  const [evolution, setEvolution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReplayOpen, setIsReplayOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projData, dsData, expData, linData, evoData] = await Promise.all([
        api.getProject(projectId),
        api.getProjectDatasets(projectId),
        api.getProjectExperiments(projectId),
        api.getLineage(projectId),
        api.getEvolution(projectId),
      ]);
      setProject(projData);
      setDatasets(dsData);
      setExperiments(expData);
      setLineage(linData);
      setEvolution(evoData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleDeleteExp = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm(`Delete experiment #${id}?`)) return;
    try {
      await api.deleteExperiment(id);
      loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  if (loading || !project) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center items-center">
        <Activity className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  const activeDataset = datasets[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <button onClick={onBack} className="hover:text-white flex items-center gap-1 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" /> Projects
        </button>
        <span>/</span>
        <span className="text-white font-mono">{project.name}</span>
      </div>

      {/* Project Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300">
              {project.task_type}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {project.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
            {project.description || 'No description provided.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeDataset && (
            <button
              onClick={() => onNavigateDataset(activeDataset.id)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <Database className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
              Dataset Intelligence
            </button>
          )}

          {experiments.length >= 2 && (
            <button
              onClick={() => onNavigateCompare()}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <GitCompare className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Compare Diffs
            </button>
          )}

          {evolution.length > 0 && (
            <button
              onClick={() => setIsReplayOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
              Experiment Replay
            </button>
          )}

          <button
            onClick={() => onNavigateNewExperiment()}
            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 mr-1 stroke-[2.5]" />
            New Experiment
          </button>
        </div>
      </div>

      {/* Dataset quick card if present */}
      {activeDataset ? (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <Database className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white font-mono">{activeDataset.filename}</span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({activeDataset.row_count} rows, {activeDataset.col_count} columns)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                SHA-256 Fingerprint: <span className="text-slate-300">{activeDataset.sha256_hash.substring(0, 16)}...</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateDataset(activeDataset.id)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            View Diagnostics <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
          <Database className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">No Dataset Uploaded Yet</h4>
          <p className="text-xs text-slate-500">Upload a CSV/XLSX dataset to begin controlled experimentation.</p>
        </div>
      )}

      {/* Visual Evolution & Lineage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <EvolutionChart
            timeline={evolution}
            onSelectExperiment={onNavigateExperiment}
          />
        </div>

        {/* Lineage Tree (1 col) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <LineageTree
            nodes={lineage}
            onSelectNode={onNavigateExperiment}
          />
        </div>
      </div>

      {/* Experiments History Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Experiment History</h3>
            <p className="text-xs text-slate-400">Controlled pipeline iterations & evaluation metrics</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {experiments.length} runs
          </span>
        </div>

        {experiments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">
            No experiments run yet. Click "New Experiment" to launch your initial baseline!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-4 font-semibold">Experiment Name</th>
                  <th className="py-3 px-4 font-semibold">Model Architecture</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Primary Metric</th>
                  <th className="py-3 px-4 font-semibold">Duration</th>
                  <th className="py-3 px-4 font-semibold">Lineage</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {experiments.map((exp) => {
                  const valMetric = exp.metrics.find(
                    (m) => m.split === 'val' && m.metric_name.toLowerCase() === exp.primary_metric.toLowerCase()
                  );

                  return (
                    <tr
                      key={exp.id}
                      onClick={() => onNavigateExperiment(exp.id)}
                      className="hover:bg-slate-850/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-300">#{exp.id}</td>
                      <td className="py-3 px-4 font-sans font-bold text-white max-w-xs truncate">
                        {exp.name}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {formatModelName(exp.model_type)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={exp.status} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        {valMetric ? (
                          <span className="font-bold text-emerald-400">
                            {exp.primary_metric.toUpperCase()}: {formatMetric(valMetric.metric_value, 4)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{exp.duration_ms}ms</td>
                      <td className="py-3 px-4 text-slate-400">
                        {exp.parent_id ? (
                          <span className="inline-flex items-center text-slate-400">
                            <GitFork className="w-3 h-3 mr-1" /> #{exp.parent_id}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Root Baseline</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onNavigateNewExperiment(exp.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400"
                            title="Branch child experiment from this run"
                          >
                            <GitFork className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteExp(e, exp.id)}
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                            title="Delete experiment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Replay Modal */}
      <ExperimentReplayModal
        isOpen={isReplayOpen}
        onClose={() => setIsReplayOpen(false)}
        timeline={evolution}
      />
    </div>
  );
};
