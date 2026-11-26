import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../services/api';
import { saveBlob } from '../utils/download';
import { ErrorBanner } from './ErrorBanner';

export interface ExportItem {
  label: string;
  /** API path including the query string, e.g. `/experiments/3/export?format=json`. */
  path: string;
  filename: string;
}

interface ExportButtonsProps {
  items: ExportItem[];
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ items }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (item: ExportItem) => {
    setBusy(item.path);
    setError(null);
    try {
      saveBlob(await api.downloadExport(item.path), item.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => handleClick(item)}
          disabled={busy !== null}
          className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
          {busy === item.path ? 'Preparing...' : item.label}
        </button>
      ))}
      <div className="w-full">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>
    </>
  );
};
