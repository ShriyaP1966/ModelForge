import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/40 text-rose-300 text-xs flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span className="leading-relaxed">{message}</span>
      </div>
      <button
        onClick={onDismiss}
        className="text-rose-400 hover:text-rose-200 flex-shrink-0"
        aria-label="Dismiss error"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
