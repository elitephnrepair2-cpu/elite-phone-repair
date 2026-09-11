import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type Connection,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeTypes,
  MarkerType,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AutomationNode, AutomationEdge, AutomationNodeType } from '../../types';

// ─── Custom node renderers ───────────────────────────────────────────────────

interface CustomNodeData extends Record<string, unknown> {
  label: string;
  summary: string;
  nodeType: AutomationNodeType;
  isSelected?: boolean;
}

const NODE_CONFIG: Record<AutomationNodeType, { icon: string; bg: string; border: string; text: string; handles: string[] }> = {
  trigger:    { icon: '⚡', bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', handles: [] },
  send_sms:   { icon: '💬', bg: 'bg-violet-50 dark:bg-violet-950', border: 'border-violet-400', text: 'text-violet-700 dark:text-violet-300', handles: ['default'] },
  wait:       { icon: '⏱️', bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-400', text: 'text-amber-700 dark:text-amber-300', handles: ['default'] },
  condition:  { icon: '🔀', bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-400', text: 'text-blue-700 dark:text-blue-300', handles: ['yes', 'no'] },
  update_tag: { icon: '🏷️', bg: 'bg-teal-50 dark:bg-teal-950', border: 'border-teal-400', text: 'text-teal-700 dark:text-teal-300', handles: ['default'] },
  end:        { icon: '🏁', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-400', text: 'text-slate-600 dark:text-slate-400', handles: [] },
};

// React Flow requires a Handle import separately from the main package
import { Handle, Position } from '@xyflow/react';

const AutomationFlowNode: React.FC<{ data: CustomNodeData; selected: boolean }> = ({ data, selected }) => {
  const cfg = NODE_CONFIG[data.nodeType] || NODE_CONFIG['end'];
  const isCondition = data.nodeType === 'condition';
  const isTrigger = data.nodeType === 'trigger';
  const isEnd = data.nodeType === 'end';

  return (
    <div
      className={`
        rounded-2xl border-2 shadow-md transition-all duration-150 min-w-[180px] max-w-[220px]
        ${cfg.bg} ${cfg.border}
        ${selected ? 'ring-2 ring-violet-400 ring-offset-1 shadow-xl scale-105' : 'hover:shadow-lg'}
      `}
    >
      {/* Target handle (top) — all non-trigger nodes */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white dark:!border-slate-800"
        />
      )}

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{cfg.icon}</span>
          <span className={`text-xs font-extrabold uppercase tracking-wide ${cfg.text}`}>
            {data.nodeType.replace('_', ' ')}
          </span>
        </div>

        {/* Summary */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-3 whitespace-pre-wrap">
          {data.summary}
        </p>

        {/* Condition branch labels */}
        {isCondition && (
          <div className="mt-2 flex justify-between text-[10px] font-bold">
            <span className="text-emerald-600 dark:text-emerald-400">YES ↙</span>
            <span className="text-rose-600 dark:text-rose-400">↘ NO</span>
          </div>
        )}
      </div>

      {/* Source handles (bottom) */}
      {!isEnd && !isCondition && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white dark:!border-slate-800"
        />
      )}
      {isCondition && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ left: '30%' }}
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-slate-800"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ left: '70%' }}
            className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white dark:!border-slate-800"
          />
        </>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  automationNode: AutomationFlowNode as any,
};

// ─── Custom deletable edge ────────────────────────────────────────────────────

const DeletableEdge: React.FC<EdgeProps> = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, label, labelStyle,
  selected, data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });
  const onDelete = (data as any)?.onDelete as (() => void) | undefined;

  return (
    <>
      {/* Invisible wider stroke for easier clicking */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd as string}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          filter: selected ? 'drop-shadow(0 0 4px rgba(139,92,246,0.6))' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          {label && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: typeof labelStyle?.fill === 'string' ? labelStyle.fill : '#10b981',
                textShadow: '0 0 3px white',
              }}
            >
              {label as string}
            </span>
          )}
          {selected && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete connection"
              className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-lg transition-colors border-2 border-white"
            >
              ✕
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  deletable: DeletableEdge,
};

// ─── Helper: DB node → React Flow node ──────────────────────────────────────

function getSummaryText(node: AutomationNode): string {
  const cfg = node.config as Record<string, any>;
  switch (node.type) {
    case 'trigger':
      return cfg.trigger_type === 'keyword_reply'
        ? `Keyword: "${cfg.keyword || '...'}"`
        : 'Manual enrollment';
    case 'send_sms':
      const msg = cfg.message || 'No message set';
      return msg.length > 80 ? msg.slice(0, 80) + '...' : msg;
    case 'wait':
      return `Wait ${cfg.duration || '?'} ${cfg.unit || 'days'}`;
    case 'condition':
      return 'Has customer replied?';
    case 'update_tag':
      return `${cfg.action === 'add' ? 'Add' : 'Remove'} tag: "${cfg.tag || '...'}"`;
    case 'end':
      return 'Automation complete';
    default:
      return '';
  }
}

function toRFNode(node: AutomationNode): Node<CustomNodeData> {
  return {
    id: node.id,
    type: 'automationNode',
    position: { x: node.position_x, y: node.position_y },
    data: {
      label: node.type.replace('_', ' '),
      summary: getSummaryText(node),
      nodeType: node.type as AutomationNodeType,
    },
    selected: false,
  };
}

function toRFEdge(edge: AutomationEdge): Edge {
  const isYes = edge.source_handle === 'yes';
  const isNo = edge.source_handle === 'no';
  return {
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    sourceHandle: edge.source_handle || 'default',
    type: 'deletable',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: isYes ? '#10b981' : isNo ? '#f43f5e' : '#8b5cf6' },
    style: {
      stroke: isYes ? '#10b981' : isNo ? '#f43f5e' : '#8b5cf6',
      strokeWidth: 2,
    },
    label: isYes ? 'YES' : isNo ? 'NO' : undefined,
    labelStyle: {
      fontSize: 10,
      fontWeight: 700,
      fill: isYes ? '#10b981' : '#f43f5e',
    },
    labelBgStyle: { fill: 'transparent' },
  };
}

// ─── Node type selector palette ──────────────────────────────────────────────

const NODE_PALETTE: { type: AutomationNodeType; label: string; description: string }[] = [
  { type: 'send_sms', label: 'Send SMS', description: 'Send a text message' },
  { type: 'wait', label: 'Wait', description: 'Pause for a set time' },
  { type: 'condition', label: 'Condition', description: 'Branch on reply check' },
  { type: 'update_tag', label: 'Update Tag', description: 'Add or remove a tag' },
  { type: 'end', label: 'End', description: 'End the automation' },
];

// ─── Main FlowCanvas component ───────────────────────────────────────────────

interface FlowCanvasProps {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: AutomationNode | null) => void;
  onNodePositionChange: (nodeId: string, x: number, y: number) => void;
  onEdgeCreate: (sourceNodeId: string, targetNodeId: string, sourceHandle: string) => void;
  onAddNode: (type: AutomationNodeType) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes: dbNodes,
  edges: dbEdges,
  selectedNodeId,
  onSelectNode,
  onNodePositionChange,
  onEdgeCreate,
  onAddNode,
  onDeleteNode,
  onDeleteEdge,
}) => {
  // Keep a fresh ref to onDeleteEdge so edge data callbacks never go stale
  const onDeleteEdgeRef = useRef(onDeleteEdge);
  useEffect(() => { onDeleteEdgeRef.current = onDeleteEdge; }, [onDeleteEdge]);

  // Stable edge factory — injects the delete callback into each edge's data
  const makeRFEdge = useCallback((edge: AutomationEdge): Edge => ({
    ...toRFEdge(edge),
    data: { onDelete: () => onDeleteEdgeRef.current(edge.id) },
  }), []);

  const initialRFNodes = useMemo(
    () => dbNodes.map(n => ({ ...toRFNode(n), selected: n.id === selectedNodeId })),
    [dbNodes, selectedNodeId]
  );
  const initialRFEdges = useMemo(() => dbEdges.map(makeRFEdge), [dbEdges, makeRFEdge]);

  const [rfNodes, setRFNodes, onNodesChange] = useNodesState(initialRFNodes);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState(initialRFEdges);

  // Sync when DB nodes/edges update
  React.useEffect(() => {
    setRFNodes(dbNodes.map(n => ({ ...toRFNode(n), selected: n.id === selectedNodeId })));
  }, [dbNodes, selectedNodeId]);

  React.useEffect(() => {
    setRFEdges(dbEdges.map(makeRFEdge));
  }, [dbEdges, makeRFEdge]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const handle = params.sourceHandle || 'default';
      onEdgeCreate(params.source, params.target, handle);
      setRFEdges(eds => addEdge({
        ...params,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      } as any, eds));
    },
    [onEdgeCreate]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, rfNode: Node) => {
      const dbNode = dbNodes.find(n => n.id === rfNode.id);
      if (dbNode) onSelectNode(dbNode);
    },
    [dbNodes, onSelectNode]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, rfNode: Node) => {
      onNodePositionChange(rfNode.id, rfNode.position.x, rfNode.position.y);
    },
    [onNodePositionChange]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        const node = dbNodes.find(n => n.id === selectedNodeId);
        if (node && node.type !== 'trigger' && node.type !== 'end') {
          onDeleteNode(selectedNodeId);
        }
      }
    },
    [selectedNodeId, dbNodes, onDeleteNode]
  );

  // Called by ReactFlow when selected edges are deleted via keyboard
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach(e => onDeleteEdge(e.id));
    },
    [onDeleteEdge]
  );

  return (
    <div className="flex-1 flex overflow-hidden" onKeyDown={onKeyDown} tabIndex={0}>
      {/* Left node palette */}
      <div className="w-52 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-3 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1 mb-3">Add Step</p>
        {NODE_PALETTE.map(({ type, label, description }) => {
          const cfg = NODE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => onAddNode(type)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border} hover:shadow-md transition-all duration-150 group`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span>{cfg.icon}</span>
                <span className={`text-xs font-bold ${cfg.text}`}>{label}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{description}</p>
            </button>
          );
        })}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-slate-50 dark:bg-slate-900">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          snapToGrid
          snapGrid={[16, 16]}
          deleteKeyCode={['Delete', 'Backspace']}
          className="bg-slate-50 dark:bg-slate-900"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#94a3b8"
          />
          <Controls
            className="[&_button]:bg-white [&_button]:dark:bg-slate-800 [&_button]:border [&_button]:border-slate-200 [&_button]:dark:border-slate-600 [&_button]:text-slate-600 [&_button]:dark:text-slate-300"
          />
          <MiniMap
            nodeColor={node => {
              const data = node.data as CustomNodeData;
              const map: Record<string, string> = {
                trigger: '#10b981', send_sms: '#8b5cf6', wait: '#f59e0b',
                condition: '#3b82f6', update_tag: '#14b8a6', end: '#64748b',
              };
              return map[data?.nodeType] || '#64748b';
            }}
            maskColor="rgba(0,0,0,0.2)"
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
          />

          {/* Empty state overlay */}
          {dbNodes.length === 0 && (
            <Panel position="top-center" className="mt-24">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center max-w-sm">
                <div className="text-5xl mb-4">🗺️</div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Your canvas is empty</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-5">
                  Start by clicking a step type from the left panel to add it to the canvas.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
};
