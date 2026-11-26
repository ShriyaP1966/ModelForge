import React from 'react';

export interface PerClassRow {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

interface PerClassMetricsProps {
  classes: PerClassRow[];
}

export const PerClassMetrics: React.FC<PerClassMetricsProps> = ({ classes }) => {
  if (!classes || classes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Per-class metrics are not available for this run.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Precision, recall, F1 and support for each class on the validation split</caption>
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <th scope="col" className="py-2 pr-4">Class</th>
            <th scope="col" className="py-2 px-2 text-right">Precision</th>
            <th scope="col" className="py-2 px-2 text-right">Recall</th>
            <th scope="col" className="py-2 px-2 text-right">F1</th>
            <th scope="col" className="py-2 pl-2 text-right">Support</th>
          </tr>
        </thead>
        <tbody className="font-mono text-slate-200">
          {classes.map((c) => (
            <tr key={c.label} className="border-b border-slate-800/60 last:border-0">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-slate-100">{c.label}</th>
              <td className="py-2 px-2 text-right">{c.precision.toFixed(3)}</td>
              <td className="py-2 px-2 text-right">{c.recall.toFixed(3)}</td>
              <td className="py-2 px-2 text-right">{c.f1.toFixed(3)}</td>
              <td className="py-2 pl-2 text-right text-slate-400">{c.support}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
