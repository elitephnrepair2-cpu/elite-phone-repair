import React from 'react';
import type { AutomationNode, AutomationEdge, AutomationNodeType } from '../../types';

interface SequenceViewProps {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: AutomationNode) => void;
  onMoveNode: (nodeId: string, direction: 'up' | 'down') => void;
  onAddNode: (afterNodeId: string | null, type: AutomationNodeType) => void;
}

const NODE_ICONS: Record<AutomationNodeType, string> = {
  trigger: '⚡',
  send_sms: '💬',
  wait: '⏱️',
  condition: '🔀',
  update_tag: '🏷️',
  end: '🏁',
};

const NODE_COLORS: Record<AutomationNodeType, { bg: string; border: string; badge: string }> = {
  trigger: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300 dark:border-emerald-700', badge: 'bg-emerald-500' },
  send_sms: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-300 dark:border-violet-700', badge: 'bg-violet-500' },
  wait: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-700', badge: 'bg-amber-500' },
  condition: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-700', badge: 'bg-blue-500' },
  update_tag: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-300 dark:border-teal-700', badge: 'bg-teal-500' },
  end: { bg: 'bg-slate-100 dark:bg-slate-700/40', border: 'border-slate-300 dark:border-slate-600', badge: 'bg-slate-500' },
};

function getNodeSummary(node: AutomationNode): string {
  const cfg = node.config as Record<string, any>;
  switch (node.type) {
    case 'trigger':
      return cfg.trigger_type === 'keyword_reply'
        ? `Keyword reply: "${cfg.keyword || '...'}"`
        : 'Manual enrollment';
    case 'send_sms':
      const msg = cfg.message || '';
      return msg.length > 60 ? msg.slice(0, 60) + '...' : msg || 'No message set';
    case 'wait':
      return `Wait ${cfg.duration || '?'} ${cfg.unit || 'days'}`;
    case 'condition':
      return 'Has customer replied?';
    case 'update_tag':
      return `${cfg.action === 'add' ? 'Add' : 'Remove'} tag: "${cfg.tag || '...'}"`;
    case 'end':
      return 'Automation ends';
    default:
      return '';
  }
}

// Topological sort to order nodes for the sequence view
function getOrderedNodes(nodes: AutomationNode[], edges: AutomationEdge[]): AutomationNode[] {
  if (nodes.length === 0) return [];

  // Build adjacency list (source -> [targets])
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(n => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  edges.forEach(e => {
    if (e.source_handle !== 'no') { // for condition, follow the 'yes' or 'default' path
      adj.get(e.source_node_id)?.push(e.target_node_id);
      inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
    }
  });

  // Find the trigger node (in-degree 0 and type='trigger')
  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) {
    // Fallback: just return nodes ordered by position_y
    return [...nodes].sort((a, b) => a.position_y - b.position_y);
  }

  // Walk the main path (DFS/BFS from trigger, following default/yes edges)
  const visited = new Set<string>();
  const ordered: AutomationNode[] = [];
  const queue = [triggerNode.id];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodes.find(n => n.id === id);
    if (node) ordered.push(node);

    // Follow default and yes edges (not no)
    const targets = edges
      .filter(e => e.source_node_id === id && e.source_handle !== 'no')
      .map(e => e.target_node_id);
    queue.push(...targets);
  }

  // Append any unvisited nodes (disconnected)
  nodes.forEach(n => {
    if (!visited.has(n.id)) ordered.push(n);
  });

  return ordered;
}

const ADD_NODE_TYPES: { type: AutomationNodeType; label: string }[] = [
  { type: 'send_sms', label: 'Send SMS' },
  { type: 'wait', label: 'Wait' },
  { type: 'condition', label: 'Condition' },
  { type: 'update_tag', label: 'Update Tag' },
  { type: 'end', label: 'End' },
];

const AddNodeButton: React.FC<{ afterNodeId: string | null; onAdd: (afterNodeId: string | null, type: AutomationNodeType) => void }> = ({ afterNodeId, onAdd }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex flex-col items-center relative">
      <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700" />
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-violet-400 hover:text-violet-500 transition-colors flex items-center justify-center text-sm font-bold shadow-sm"
        >
          +
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-8 top-0 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-[140px]">
              {ADD_NODE_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => { onAdd(afterNodeId, type); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span>{NODE_ICONS[type]}</span> {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700" />
    </div>
  );
};

export const SequenceView: React.FC<SequenceViewProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onAddNode,
}) => {
  const orderedNodes = getOrderedNodes(nodes, edges);

  if (orderedNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No steps yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Switch to Flow View to add your first node, or use the + button below.
          </p>
          <button
            onClick={() => onAddNode(null, 'trigger')}
            className="mt-4 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
          >
            Add Trigger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-lg mx-auto">
        {/* Add before trigger */}
        <AddNodeButton afterNodeId={null} onAdd={onAddNode} />

        {orderedNodes.map((node, index) => {
          const colors = NODE_COLORS[node.type];
          const isSelected = selectedNodeId === node.id;
          const summary = getNodeSummary(node);

          return (
            <div key={node.id}>
              {/* Node card */}
              <div
                onClick={() => onSelectNode(node)}
                className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-150 shadow-sm hover:shadow-md ${colors.bg} ${
                  isSelected
                    ? `${colors.border} ring-2 ring-violet-400 ring-offset-2 dark:ring-offset-slate-900`
                    : `${colors.border} hover:shadow-lg`
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Step number */}
                  <div className={`w-8 h-8 rounded-full ${colors.badge} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{NODE_ICONS[node.type]}</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white capitalize">
                        {node.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{summary}</p>
                  </div>

                  {/* Move controls */}
                  {node.type !== 'trigger' && node.type !== 'end' && (
                    <div className="flex flex-col gap-1 ml-2">
                      <button
                        onClick={e => { e.stopPropagation(); onMoveNode(node.id, 'up'); }}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 hover:bg-white/60 dark:hover:bg-slate-700/60 rounded transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onMoveNode(node.id, 'down'); }}
                        disabled={index === orderedNodes.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 hover:bg-white/60 dark:hover:bg-slate-700/60 rounded transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Condition branches indicator */}
                {node.type === 'condition' && (
                  <div className="mt-3 flex gap-2">
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-200 dark:border-emerald-700">
                      YES →
                    </span>
                    <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-[10px] font-bold rounded-full border border-rose-200 dark:border-rose-700">
                      NO →
                    </span>
                  </div>
                )}
              </div>

              {/* Add node button between steps */}
              {index < orderedNodes.length - 1 && node.type !== 'end' && (
                <AddNodeButton afterNodeId={node.id} onAdd={onAddNode} />
              )}
            </div>
          );
        })}

        {/* Add after last node if last isn't 'end' */}
        {orderedNodes[orderedNodes.length - 1]?.type !== 'end' && (
          <AddNodeButton afterNodeId={orderedNodes[orderedNodes.length - 1]?.id || null} onAdd={onAddNode} />
        )}
      </div>
    </div>
  );
};
