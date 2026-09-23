import React, { useState } from 'react';
import { Database, Filter, Sliders, Cpu, Award, ArrowRight, CheckCircle2 } from 'lucide-react';

interface PipelineNode {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  details: Record<string, any>;
}

interface PipelineVisualizerProps {
  pipelineData?: {
    experiment_id: number;
    experiment_name: string;
    nodes: PipelineNode[];
    edges: Array<{ source: string; target: string; label: string }>;
  };
}

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({ pipelineData }) => {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  if (!pipelineData || !pipelineData.nodes) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        Pipeline structure loading or not available.
      </div>
    );
  }

  const { nodes } = pipelineData;
  const activeNode = nodes.find((n) => n.id === activeNodeId) || nodes[0];

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'data':
        return <Database className="w-4 h-4 text-sky-400" />;
      case 'preprocessing':
        return <Sliders className="w-4 h-4 text-amber-400" />;
      case 'features':
        return <Filter className="w-4 h-4 text-indigo-400" />;
      case 'model':
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'evaluation':
        return <Award className="w-4 h-4 text-teal-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Node Flowchart Horizontal Bar */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex items-center space-x-3 min-w-max p-2 bg-slate-950 rounded-xl border border-slate-800">
          {nodes.map((node, idx) => {
            const isSelected = activeNode?.id === node.id;

            return (
              <React.Fragment key={node.id}>
                {/* Node Box */}
                <div
                  onClick={() => setActiveNodeId(node.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center space-x-2.5 ${
                    isSelected
                      ? 'bg-slate-800 border-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="p-2 rounded-md bg-slate-800/80 border border-slate-700">
                    {getNodeIcon(node.type)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-wide">{node.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">
                      {node.subtitle}
                    </div>
                  </div>
                </div>

                {/* Arrow Connector */}
                {idx < nodes.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Node Detail Inspector Panel */}
      {activeNode && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-800">
            {getNodeIcon(activeNode.type)}
            <span className="font-bold text-white text-sm">{activeNode.title}</span>
            <span className="text-slate-400 font-mono">({activeNode.subtitle})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(activeNode.details).map(([k, v]) => (
              <div key={k} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {k.replace(/_/g, ' ')}
                </span>
                <span className="font-mono text-emerald-300 font-medium break-all">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
