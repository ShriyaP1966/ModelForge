import React from 'react';
import { Layers, Activity, Settings, Plus, Sparkles, Database } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, id?: number) => void;
  activeProjectName?: string;
  onOpenNewProject: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  activeProjectName,
  onOpenNewProject
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Layers className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white font-mono">Model<span className="text-emerald-400">Forge</span></span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  LAB
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">AI Model Evolution & Reproducibility</p>
            </div>
          </div>

          {/* Active Context Breadcrumb */}
          {activeProjectName && (
            <div className="hidden md:flex items-center px-3 py-1 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs text-slate-300">
              <Database className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              <span>Project:</span>
              <span className="ml-1 font-semibold text-white truncate max-w-xs">{activeProjectName}</span>
            </div>
          )}

          {/* Actions & Navigation */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className={`p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${
                currentView === 'settings' ? 'text-emerald-400 bg-slate-800' : ''
              }`}
              title="Settings & AI Providers"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenNewProject}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              New Project
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
