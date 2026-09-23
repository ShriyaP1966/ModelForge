import React, { useState, useEffect } from 'react';
import { Project } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { DatasetIntelligencePage } from './pages/DatasetIntelligencePage';
import { ExperimentDesignerPage } from './pages/ExperimentDesignerPage';
import { ExperimentDetailPage } from './pages/ExperimentDetailPage';
import { CompareExperimentsPage } from './pages/CompareExperimentsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Active selection context
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | null>(null);
  const [parentExperimentId, setParentExperimentId] = useState<number | undefined>(undefined);
  const [compareExpAId, setCompareExpAId] = useState<number | undefined>(undefined);
  const [compareExpBId, setCompareExpBId] = useState<number | undefined>(undefined);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  const handleNavigate = (view: string, id?: number) => {
    setCurrentView(view);
    if (view === 'dashboard') {
      setSelectedProjectId(null);
      setSelectedExperimentId(null);
      setSelectedDatasetId(null);
      fetchProjects();
    }
  };

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setCurrentView('project');
  };

  const handleNavigateDataset = (datasetId: number) => {
    setSelectedDatasetId(datasetId);
    setCurrentView('dataset');
  };

  const handleNavigateNewExperiment = (parentId?: number) => {
    setParentExperimentId(parentId);
    setCurrentView('new-experiment');
  };

  const handleNavigateExperiment = (experimentId: number) => {
    setSelectedExperimentId(experimentId);
    setCurrentView('experiment');
  };

  const handleNavigateCompare = (expAId?: number, expBId?: number) => {
    setCompareExpAId(expAId);
    setCompareExpBId(expBId);
    setCurrentView('compare');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        activeProjectName={activeProject?.name}
        onOpenNewProject={() => {
          setSelectedProjectId(null);
          setCurrentView('dashboard');
        }}
      />

      <main className="flex-1">
        {currentView === 'dashboard' && (
          <DashboardPage
            projects={projects}
            loading={loadingProjects}
            onSelectProject={handleSelectProject}
            onRefresh={fetchProjects}
          />
        )}

        {currentView === 'project' && selectedProjectId && (
          <ProjectDetailPage
            projectId={selectedProjectId}
            onBack={() => handleNavigate('dashboard')}
            onNavigateDataset={handleNavigateDataset}
            onNavigateNewExperiment={handleNavigateNewExperiment}
            onNavigateExperiment={handleNavigateExperiment}
            onNavigateCompare={handleNavigateCompare}
          />
        )}

        {currentView === 'dataset' && selectedDatasetId && (
          <DatasetIntelligencePage
            datasetId={selectedDatasetId}
            onBack={() => setCurrentView('project')}
            onDatasetUpdated={(newDsId) => {
              setSelectedDatasetId(newDsId);
              fetchProjects();
            }}
          />
        )}

        {currentView === 'new-experiment' && selectedProjectId && (
          <ExperimentDesignerPage
            projectId={selectedProjectId}
            parentId={parentExperimentId}
            onBack={() => setCurrentView('project')}
            onExperimentCreated={(newExpId) => {
              setSelectedExperimentId(newExpId);
              setCurrentView('experiment');
              fetchProjects();
            }}
          />
        )}

        {currentView === 'experiment' && selectedExperimentId && (
          <ExperimentDetailPage
            experimentId={selectedExperimentId}
            onBack={() => setCurrentView('project')}
            onNavigateNewBranch={(pId) => handleNavigateNewExperiment(pId)}
            onNavigateCompare={(a, b) => handleNavigateCompare(a, b)}
          />
        )}

        {currentView === 'compare' && selectedProjectId && (
          <CompareExperimentsPage
            projectId={selectedProjectId}
            initialExpAId={compareExpAId}
            initialExpBId={compareExpBId}
            onBack={() => setCurrentView('project')}
          />
        )}

        {currentView === 'settings' && (
          <SettingsPage onBack={() => handleNavigate('dashboard')} />
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-500 font-mono">
        <p>ModelForge • AI Model Evolution Lab • Designed for AI Tools & System Design Coursework</p>
      </footer>
    </div>
  );
}

export default App;
