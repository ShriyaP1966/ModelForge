import React, { useState, useEffect } from 'react';
import { Experiment, ExperimentDiffResponse } from '../types';
import { api } from '../services/api';
import { ExperimentDiffView } from '../components/ExperimentDiffView';
import { formatModelName } from '../utils/formatting';
import { ArrowLeft, GitCompare, RotateCcw } from 'lucide-react';

interface CompareExperimentsPageProps {
  projectId: number;
  initialExpAId?: number;
  initialExpBId?: number;
  onBack: () => void;
}

export const CompareExperimentsPage: React.FC<CompareExperimentsPageProps> = ({
  projectId,
  initialExpAId,
  initialExpBId,
  onBack,
}) => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [expAId, setExpAId] = useState<number | undefined>(initialExpAId);
  const [expBId, setExpBId] = useState<number | undefined>(initialExpBId);
  const [diffData, setDiffData] = useState<ExperimentDiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    const loadExperiments = async () => {
      try {
        setLoading(true);
        const list = await api.getProjectExperiments(projectId);
        setExperiments(list);

        // Pick defaults if not set
        if (list.length >= 2) {
          const a = initialExpAId || list[list.length - 1].id;
          const b = initialExpBId || list[0].id;
          setExpAId(a);
          setExpBId(b);
          fetchDiff(a, b);
        } else if (list.length === 1) {
          setExpAId(list[0].id);
          setExpBId(list[0].id);
          fetchDiff(list[0].id, list[0].id);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadExperiments();
  }, [projectId, initialExpAId, initialExpBId]);

  const fetchDiff = async (a: number, b: number) => {
    setDiffLoading(true);
    try {
      const res = await api.getDiff(a, b);
      setDiffData(res);
    } catch (err: any) {
      alert(`Diff calculation failed: ${err.message}`);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleSelectA = (id: number) => {
    setExpAId(id);
    if (expBId) fetchDiff(id, expBId);
  };

  const handleSelectB = (id: number) => {
    setExpBId(id);
    if (expAId) fetchDiff(expAId, id);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center items-center">
        <RotateCcw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Back */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <button onClick={onBack} className="hover:text-white flex items-center gap-1 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" /> Project
        </button>
        <span>/</span>
        <span className="text-white font-mono">Experiment Comparison & Diff</span>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-amber-400" />
              Side-by-Side Experiment Diff
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">
              Analyze exactly what configuration shifted between runs and how those changes impacted validation metrics.
            </p>
          </div>
        </div>

        {/* Experiment Pickers */}
        <div className="pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Experiment A (Baseline / Previous):
            </label>
            <select
              value={expAId}
              onChange={(e) => handleSelectA(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              {experiments.map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.id} - {e.name} ({formatModelName(e.model_type)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Experiment B (Candidate / Current):
            </label>
            <select
              value={expBId}
              onChange={(e) => handleSelectB(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              {experiments.map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.id} - {e.name} ({formatModelName(e.model_type)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Diff View Content */}
      {diffLoading ? (
        <div className="py-12 flex justify-center items-center">
          <RotateCcw className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      ) : diffData ? (
        <ExperimentDiffView diffData={diffData} />
      ) : (
        <div className="p-12 text-center text-slate-500 italic">
          Select two experiments above to compute comparative diff.
        </div>
      )}
    </div>
  );
};
