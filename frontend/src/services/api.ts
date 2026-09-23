import {
  Project,
  Dataset,
  DatasetHealthReport,
  Experiment,
  LineageNode,
  ExperimentDiffResponse,
  ReproduceResponse,
  AIExplainResponse
} from '../types';

const BASE_URL = '/api';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, options);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorBody.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => fetchJson<Project[]>('/projects/'),
  getProject: (id: number) => fetchJson<Project>(`/projects/${id}`),
  createProject: (data: { name: string; description?: string; task_type: string }) =>
    fetchJson<Project>('/projects/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteProject: (id: number) =>
    fetchJson<{ message: string }>(`/projects/${id}`, { method: 'DELETE' }),
  seedSampleProjects: () =>
    fetchJson<{ message: string; projects: string[] }>('/projects/seed-sample', { method: 'POST' }),

  // Datasets
  getProjectDatasets: (projectId: number) =>
    fetchJson<Dataset[]>(`/datasets/project/${projectId}`),
  getDataset: (id: number) => fetchJson<Dataset>(`/datasets/${id}`),
  getDatasetHealth: (id: number, target?: string) =>
    fetchJson<DatasetHealthReport>(`/datasets/${id}/health${target ? `?target=${target}` : ''}`),
  getDatasetPreview: (id: number, limit = 50) =>
    fetchJson<{ columns: string[]; total_rows: number; data: any[] }>(
      `/datasets/${id}/preview?limit=${limit}`
    ),
  uploadDataset: async (projectId: number, file: File, targetColumn?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (targetColumn) {
      formData.append('target_column', targetColumn);
    }
    const res = await fetch(`${BASE_URL}/datasets/upload?project_id=${projectId}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json() as Promise<Dataset>;
  },

  // Experiments
  getProjectExperiments: (projectId: number) =>
    fetchJson<Experiment[]>(`/experiments/project/${projectId}`),
  getExperiment: (id: number) => fetchJson<Experiment>(`/experiments/${id}`),
  createExperiment: (data: any) =>
    fetchJson<Experiment>('/experiments/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteExperiment: (id: number) =>
    fetchJson<{ message: string }>(`/experiments/${id}`, { method: 'DELETE' }),
  getLineage: (projectId: number) =>
    fetchJson<LineageNode[]>(`/experiments/project/${projectId}/lineage`),
  getEvolution: (projectId: number) =>
    fetchJson<any[]>(`/experiments/project/${projectId}/evolution`),
  getPipelineGraph: (experimentId: number) =>
    fetchJson<any>(`/experiments/${experimentId}/pipeline-graph`),
  getDiff: (expAId: number, expBId: number) =>
    fetchJson<ExperimentDiffResponse>(`/experiments/${expAId}/diff/${expBId}`),

  // Reproducibility
  reproduceExperiment: (experimentId: number, tolerance = 1e-4) =>
    fetchJson<ReproduceResponse>('/reproduce/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment_id: experimentId, tolerance }),
    }),

  // AI Explanation
  explainExperiment: (experimentId: number, baselineExperimentId?: number) =>
    fetchJson<AIExplainResponse>('/ai/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experiment_id: experimentId,
        baseline_experiment_id: baselineExperimentId,
      }),
    }),

  // Settings
  getSettings: () => fetchJson<any>('/settings/'),
  updateSettings: (data: any) =>
    fetchJson<any>('/settings/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};
