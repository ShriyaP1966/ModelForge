import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = status.toLowerCase();

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (norm === 'completed') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full ${sizeClasses}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        Completed
      </span>
    );
  }

  if (norm === 'running') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full ${sizeClasses}`}>
        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
        Running
      </span>
    );
  }

  if (norm === 'queued') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full ${sizeClasses}`}>
        <Clock className="w-3.5 h-3.5" />
        Queued
      </span>
    );
  }

  if (norm === 'failed') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full ${sizeClasses}`}>
        <XCircle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium bg-slate-700 text-slate-300 rounded-full ${sizeClasses}`}>
      {status}
    </span>
  );
};
