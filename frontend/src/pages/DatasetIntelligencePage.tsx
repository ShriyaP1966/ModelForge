import React, { useState, useEffect, useMemo } from 'react';
import { Dataset, DatasetHealthReport } from '../types';
import { api } from '../services/api';
import { CorrelationHeatmap } from '../components/CorrelationHeatmap';
import { MissingValueHeatmap } from '../components/MissingValueHeatmap';
import { FeatureDistributionChart } from '../components/FeatureDistributionChart';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  ArrowLeft,
  Database,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  BarChart2,
  Upload,
  Activity,
  Layers,
  FileSpreadsheet,
  Grid3x3,
  ScanSearch,
} from 'lucide-react';

interface DatasetIntelligencePageProps {
  datasetId: number;
  onBack: () => void;
  onDatasetUpdated?: (datasetId: number) => void;
}

export const DatasetIntelligencePage: React.FC<DatasetIntelligencePageProps> = ({
  datasetId,
  onBack,
  onDatasetUpdated,
}) => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [health, setHealth] = useState<DatasetHealthReport | null>(null);
  const [preview, setPreview] = useState<{ columns: string[]; total_rows: number; data: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [distColumnName, setDistColumnName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = async (target?: string) => {
    try {
      setLoading(true);
      const [dsData, prevData] = await Promise.all([
        api.getDataset(datasetId),
        api.getDatasetPreview(datasetId),
      ]);
      setDataset(dsData);
      setPreview(prevData);

      const activeTarget = target || dsData.target_column || '';
      setSelectedTarget(activeTarget);

      const healthData = await api.getDatasetHealth(datasetId, activeTarget || undefined);
      setHealth(healthData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [datasetId]);

  // Default the distribution-chart column selector to the first visualizable
  // column (prefers the active target, falls back to the first non-constant
  // column) whenever a new health report loads or the previous selection no
  // longer exists in it.
  useEffect(() => {
    if (!health) return;
    const stillValid = health.columns.some((c) => c.name === distColumnName);
    if (stillValid) return;

    const preferred =
      health.columns.find((c) => c.name === selectedTarget && !c.is_constant) ||
      health.columns.find((c) => !c.is_constant) ||
      health.columns[0];
    setDistColumnName(preferred ? preferred.name : '');
  }, [health]);

  const handleTargetChange = (newTarget: string) => {
    setSelectedTarget(newTarget);
    loadData(newTarget);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dataset) return;

    setUploading(true);
    setUploadError(null);
    try {
      const newDs = await api.uploadDataset(dataset.project_id, file);
      if (onDatasetUpdated) {
        onDatasetUpdated(newDs.id);
      } else {
        loadData();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-selecting the same file after a failure
    }
  };

  if (loading || !dataset || !health) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center items-center">
        <Activity className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  const distColumn = health.columns.find((c) => c.name === distColumnName);

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'Excellent':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Good':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'Fair':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <ErrorBanner message={uploadError} onDismiss={() => setUploadError(null)} />

      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <button onClick={onBack} className="hover:text-white flex items-center gap-1 font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> Project
          </button>
          <span>/</span>
          <span className="text-white font-mono">{dataset.filename}</span>
        </div>

        {/* Upload replacement / new dataset */}
        <label className="cursor-pointer inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all">
          <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
          {uploading ? 'Processing File...' : 'Upload New Dataset'}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Dataset Overview & Health Score Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Gauge Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Dataset Health Score
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getHealthBadgeColor(health.health_status)}`}>
                {health.health_status}
              </span>
            </div>

            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-5xl font-black font-mono text-emerald-400">
                {health.health_score}
              </span>
              <span className="text-slate-500 font-mono text-lg">/ 100</span>
            </div>

            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Transparent indicator based on missingness, duplicate rows, constant features, class balance, and data leakage flags.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Duplicates: <strong className="text-white">{health.duplicate_rows}</strong></span>
            <span>Missing: <strong className="text-white">{health.missing_pct}%</strong></span>
          </div>
        </div>

        {/* Dataset Meta & Target Selector Card (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white font-mono truncate">{dataset.filename}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono mt-3">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ROWS</span>
                <span className="text-white font-bold text-base">{health.row_count}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">COLUMNS</span>
                <span className="text-white font-bold text-base">{health.col_count}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">TOTAL CELLS</span>
                <span className="text-white font-bold text-base">{health.row_count * health.col_count}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">TARGET CANDIDATE</span>
                <span className="text-emerald-400 font-bold truncate block">{selectedTarget || 'None'}</span>
              </div>
            </div>
          </div>

          {/* Target Column Selector */}
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-semibold">Active Target for Diagnosis & Class Balance:</span>
            <select
              value={selectedTarget}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Choose Target Column --</option>
              {health.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.inferred_type})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Diagnostics Alerts & Data Leakage Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Summary Notes */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Dataset Health Indicators
          </h3>

          <div className="space-y-2 text-xs">
            {health.summary_notes.map((note, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-slate-300 flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Leakage Warnings */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Data Leakage & Risk Indicators ({health.leakage_warnings.length})
          </h3>

          {health.leakage_warnings.length === 0 ? (
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>No obvious data leakage patterns or target proxy features detected!</span>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {health.leakage_warnings.map((warn, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-rose-300">Column: {warn.column}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">
                      {warn.risk} Risk
                    </span>
                  </div>
                  <ul className="list-disc pl-4 text-[11px] text-rose-300/80">
                    {warn.reasons.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Missing Value & Correlation Visual Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <ScanSearch className="w-4 h-4 text-amber-400" />
            Missing Value Diagnostics
          </h3>
          <MissingValueHeatmap columns={health.columns} />
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-sky-400" />
            Correlation Heatmap
          </h3>
          <CorrelationHeatmap correlationMatrix={health.correlation_matrix} />
        </div>
      </div>

      {/* Class Balance if available */}
      {health.class_balance && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-sky-400" />
            Target Class Distribution ({selectedTarget})
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            {Object.entries(health.class_balance).map(([clsName, count]) => {
              const pct = ((count / health.row_count) * 100).toFixed(1);
              return (
                <div key={clsName} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block truncate">{clsName}</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-bold text-white">{count}</span>
                    <span className="text-emerald-400 font-bold">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature Distributions */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-teal-400" />
            Feature Distribution
          </h3>
          <select
            value={distColumnName}
            onChange={(e) => setDistColumnName(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
          >
            {health.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.inferred_type})
              </option>
            ))}
          </select>
        </div>
        <FeatureDistributionChart column={distColumn} />
      </div>

      {/* Columns Schema & Quality Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Column Profiles & Statistical Summaries
          </h3>
          <span className="text-xs font-mono text-slate-400">{health.columns.length} columns analyzed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Column Name</th>
                <th className="py-2.5 px-4 font-semibold">Inferred Type</th>
                <th className="py-2.5 px-4 font-semibold">Missing Cells</th>
                <th className="py-2.5 px-4 font-semibold">Unique Cardinality</th>
                <th className="py-2.5 px-4 font-semibold">Outliers (IQR)</th>
                <th className="py-2.5 px-4 font-semibold">Summary Stats</th>
                <th className="py-2.5 px-4 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {health.columns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-white font-sans">{col.name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                      {col.inferred_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={col.missing_count > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                      {col.missing_count} ({col.missing_pct}%)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{col.unique_count}</td>
                  <td className="py-3 px-4 text-slate-400">{col.outlier_count}</td>
                  <td className="py-3 px-4 text-slate-400 truncate max-w-xs text-[11px]">
                    {col.stats.mean !== undefined
                      ? `μ: ${col.stats.mean}, σ: ${col.stats.std}, [${col.stats.min} .. ${col.stats.max}]`
                      : col.stats.top_categories
                      ? Object.keys(col.stats.top_categories).join(', ')
                      : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {col.is_potential_leakage && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 mr-1">
                        LEAK RISK
                      </span>
                    )}
                    {col.is_constant && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 mr-1">
                        CONSTANT
                      </span>
                    )}
                    {col.is_potential_target && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                        TARGET CANDIDATE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Preview Table */}
      {preview && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Raw Data Preview (First {preview.data.length} rows)
            </h3>
            <span className="text-xs font-mono text-slate-400">{preview.total_rows} total records</span>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 border-b border-slate-800">
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} className="py-2.5 px-3 font-semibold whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {preview.data.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-850/50">
                    {preview.columns.map((c) => (
                      <td key={c} className="py-2 px-3 text-slate-300 whitespace-nowrap">
                        {String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
