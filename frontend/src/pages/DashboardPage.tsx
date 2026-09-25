import React, { useState } from 'react';
import { Project } from '../types';
import { FolderGit2, Plus, Sparkles, Layers, ArrowRight, Trash2, Cpu } from 'lucide-react';
import { api } from '../services/api';
import { ErrorBanner } from '../components/ErrorBanner';

interface DashboardPageProps {
  projects: Project[];
  loading: boolean;
  onSelectProject: (id: number) => void;
  onRefresh: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  projects,
  loading,
  onSelectProject,
  onRefresh,
}) => {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<'classification' | 'regression'>('classification');
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const p = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        task_type: taskType,
      });
      setIsNewModalOpen(false);
      setName('');
      setDescription('');
      onRefresh();
      onSelectProject(p.id);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedSamples = async () => {
    setSeeding(true);
    setPageError(null);
    try {
      await api.seedSampleProjects();
      onRefresh();
    } catch (err: any) {
      setPageError(err.message || 'Failed to seed samples.');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project and all its experiments?')) return;
    setPageError(null);
    try {
      await api.deleteProject(id);
      onRefresh();
    } catch (err: any) {
      setPageError(err.message || 'Delete failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 p-8 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Model Evolution Lab</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            See how your machine-learning model <span className="text-emerald-400">evolves</span>.
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Diagnose datasets, construct leak-free pipelines, track experiment lineage, inspect configuration diffs, and guarantee zero-variance reproducibility.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => { setModalError(null); setIsNewModalOpen(true); }}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 mr-2 stroke-[2.5]" />
              Create Project
            </button>

            <button
              onClick={handleSeedSamples}
              disabled={seeding}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <Cpu className="w-4 h-4 mr-2 text-emerald-400" />
              {seeding ? 'Loading Sample Workspaces...' : 'Load Coursework Samples'}
            </button>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-emerald-400" />
            Projects & Workspaces
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">No Projects Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Get started by creating your first project or loading sample coursework datasets.
            </p>
            <button
              onClick={handleSeedSamples}
              disabled={seeding}
              className="px-4 py-2 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50"
            >
              {seeding ? 'Loading Sample Workspaces...' : 'Load Sample Datasets'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-950/20 transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      {p.task_type}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {p.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex space-x-3">
                    <span>{p.dataset_count} data</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">{p.experiment_count} exps</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
            <h3 className="text-lg font-bold text-white">Create New Project</h3>
            <ErrorBanner message={modalError} onDismiss={() => setModalError(null)} />
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label htmlFor="new-proj-name" className="block text-slate-400 font-semibold mb-1">Project Name</label>
                <input
                  id="new-proj-name"
                  type="text"
                  required
                  placeholder="e.g. Customer Churn Prediction"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div>
                <label htmlFor="new-proj-description" className="block text-slate-400 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  id="new-proj-description"
                  rows={3}
                  placeholder="Goals, hypothesis, and scope of this ML experiment..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Task Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTaskType('classification')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-all ${
                      taskType === 'classification'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Classification
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskType('regression')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-all ${
                      taskType === 'regression'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Regression
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
