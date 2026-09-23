import React from 'react';
import { LineageNode } from '../types';
import { formatModelName } from '../utils/formatting';
import { StatusBadge } from './StatusBadge';
import { Crown, GitFork, ArrowRight, Unlink } from 'lucide-react';

interface LineageTreeProps {
  nodes: LineageNode[];
  selectedId?: number;
  onSelectNode: (id: number) => void;
}

export const LineageTree: React.FC<LineageTreeProps> = ({
  nodes,
  selectedId,
  onSelectNode,
}) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm italic">
        No experiment lineage established yet. Create an experiment with a parent to form an evolutionary tree!
      </div>
    );
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // A node is a tree root if it has no parent_id, OR its parent_id points to
  // an experiment that isn't in this list (e.g. the parent was deleted).
  // Without the second condition, that node would be silently unreachable
  // from any root and would vanish from the tree entirely.
  const rootNodes = nodes.filter((n) => !n.parent_id || !nodeIds.has(n.parent_id));
  const childMap: Record<number, LineageNode[]> = {};
  nodes.forEach((n) => {
    if (n.parent_id && nodeIds.has(n.parent_id)) {
      if (!childMap[n.parent_id]) childMap[n.parent_id] = [];
      childMap[n.parent_id].push(n);
    }
  });

  const renderNode = (node: LineageNode, depth = 0) => {
    const isSelected = node.id === selectedId;
    const children = childMap[node.id] || [];
    const hasDanglingParent = !!node.parent_id && !nodeIds.has(node.parent_id);
    const hasMetric = typeof node.primary_metric_val === 'number';

    return (
      <div key={node.id} className="flex flex-col space-y-2">
        <div
          onClick={() => onSelectNode(node.id)}
          className={`relative flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
            isSelected
              ? 'bg-slate-800 border-emerald-500 shadow-md shadow-emerald-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          {/* Leader Crown Badge */}
          {node.is_leader && (
            <div className="absolute -top-2.5 -right-2.5 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] shadow-sm">
              <Crown className="w-3 h-3 fill-slate-950" />
              <span>LEADER</span>
            </div>
          )}

          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
              isSelected
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            #{node.id}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-white truncate">{node.name}</span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                {formatModelName(node.model_type)}
              </span>
              {node.status !== 'completed' && <StatusBadge status={node.status} size="sm" />}
            </div>

            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
              {hasMetric ? (
                <span className="font-mono text-emerald-400 font-bold">
                  {node.primary_metric.toUpperCase()}: {node.primary_metric_val!.toFixed(4)}
                </span>
              ) : (
                <span className="font-mono text-slate-500 italic">no metric yet</span>
              )}
              {node.parent_id && !hasDanglingParent && (
                <span className="flex items-center text-[11px] text-slate-500">
                  <GitFork className="w-3 h-3 mr-1" /> derived from #{node.parent_id}
                </span>
              )}
              {hasDanglingParent && (
                <span className="flex items-center text-[11px] text-amber-500/80" title={`Original parent experiment #${node.parent_id} is no longer available (likely deleted)`}>
                  <Unlink className="w-3 h-3 mr-1" /> parent #{node.parent_id} unavailable
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Child branches */}
        {children.length > 0 && (
          <div className="pl-6 ml-4 border-l-2 border-emerald-500/20 space-y-2 relative">
            {children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
        <span className="font-semibold uppercase tracking-wider">Experiment Derivations (DAG)</span>
        <span>{nodes.length} total lineage nodes</span>
      </div>

      <div className="space-y-3">
        {rootNodes.map((root) => renderNode(root))}
      </div>
    </div>
  );
};
