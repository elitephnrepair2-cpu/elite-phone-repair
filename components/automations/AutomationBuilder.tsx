import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import type {
  Automation,
  AutomationNode,
  AutomationEdge,
  AutomationNodeType,
  AutomationStatus,
} from '../../types';
import { FlowCanvas } from './FlowCanvas';
import { SequenceView } from './SequenceView';
import { NodeEditor } from './NodeEditor';

interface AutomationBuilderProps {
  automationId: string;
  onBack: () => void;
  showAlert: (msg: string) => void;
}

type BuilderView = 'flow' | 'sequence';

const STATUS_COLORS: Record<AutomationStatus, string> = {
  draft: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600',
  active: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700',
  paused: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700',
};

const DEFAULT_POSITIONS: Record<AutomationNodeType, { x: number; y: number }> = {
  trigger: { x: 300, y: 50 },
  send_sms: { x: 300, y: 250 },
  wait: { x: 300, y: 400 },
  condition: { x: 300, y: 550 },
  update_tag: { x: 300, y: 700 },
  end: { x: 300, y: 850 },
};

function getNextPosition(existingNodes: AutomationNode[], type: AutomationNodeType): { x: number; y: number } {
  if (existingNodes.length === 0) return DEFAULT_POSITIONS[type] || { x: 300, y: 100 };
  const maxY = Math.max(...existingNodes.map(n => n.position_y));
  return { x: 300, y: maxY + 200 };
}

export const AutomationBuilder: React.FC<AutomationBuilderProps> = ({
  automationId,
  onBack,
  showAlert,
}) => {
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [nodes, setNodes] = useState<AutomationNode[]>([]);
  const [edges, setEdges] = useState<AutomationEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [builderView, setBuilderView] = useState<BuilderView>('flow');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load automation data ──────────────────────────────────────────────────
  useEffect(() => {
    loadAutomation();
  }, [automationId]);

  const loadAutomation = async () => {
    setIsLoading(true);
    try {
      const [{ data: auto }, { data: nodeData }, { data: edgeData }] = await Promise.all([
        supabase.from('automations').select('*').eq('id', automationId).single(),
        supabase.from('automation_nodes').select('*').eq('automation_id', automationId).order('position_y'),
        supabase.from('automation_edges').select('*').eq('automation_id', automationId),
      ]);

      if (auto) {
        setAutomation(auto as Automation);
        setNameValue(auto.name);
      }
      if (nodeData) setNodes(nodeData as AutomationNode[]);
      if (edgeData) setEdges(edgeData as AutomationEdge[]);
    } catch (err) {
      showAlert('Failed to load automation.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Auto-save with debounce ───────────────────────────────────────────────
  const scheduleSave = useCallback((updatedNodes: AutomationNode[], updatedEdges: AutomationEdge[]) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      persistNodes(updatedNodes, updatedEdges);
    }, 1500);
  }, []);

  const persistNodes = async (updatedNodes: AutomationNode[], updatedEdges: AutomationEdge[]) => {
    if (!automation) return;
    setIsSaving(true);
    try {
      // Upsert all nodes
      if (updatedNodes.length > 0) {
        const nodeRows = updatedNodes.map(n => ({
          id: n.id,
          automation_id: n.automation_id,
          type: n.type,
          config: n.config,
          position_x: n.position_x,
          position_y: n.position_y,
        }));
        const { error } = await supabase.from('automation_nodes').upsert(nodeRows, { onConflict: 'id' });
        if (error) throw error;
      }

      // Sync edges: delete all, re-insert
      await supabase.from('automation_edges').delete().eq('automation_id', automation.id);
      if (updatedEdges.length > 0) {
        const edgeRows = updatedEdges.map(e => ({
          id: e.id,
          automation_id: e.automation_id,
          source_node_id: e.source_node_id,
          target_node_id: e.target_node_id,
          source_handle: e.source_handle,
        }));
        await supabase.from('automation_edges').insert(edgeRows);
      }

      // Touch updated_at
      await supabase.from('automations').update({ updated_at: new Date().toISOString() }).eq('id', automation.id);
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Name editing ──────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!automation || nameValue.trim() === automation.name) { setEditingName(false); return; }
    const trimmed = nameValue.trim() || 'Untitled Automation';
    const { error } = await supabase.from('automations').update({ name: trimmed, updated_at: new Date().toISOString() }).eq('id', automation.id);
    if (!error) setAutomation(a => a ? { ...a, name: trimmed } : a);
    setEditingName(false);
  };

  // ── Status toggle ─────────────────────────────────────────────────────────
  const cycleStatus = async () => {
    if (!automation) return;
    const next: Record<AutomationStatus, AutomationStatus> = { draft: 'active', active: 'paused', paused: 'active' };
    const newStatus = next[automation.status];

    if (newStatus === 'active' && nodes.length === 0) {
      showAlert('Cannot activate an automation with no nodes. Add at least a trigger and one action.');
      return;
    }

    const { error } = await supabase.from('automations').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', automation.id);
    if (!error) setAutomation(a => a ? { ...a, status: newStatus } : a);
  };

  // ── Node operations ───────────────────────────────────────────────────────
  const handleAddNode = useCallback(async (type: AutomationNodeType) => {
    if (!automation) return;

    // Prevent duplicate triggers
    if (type === 'trigger' && nodes.some(n => n.type === 'trigger')) {
      showAlert('An automation can only have one trigger.');
      return;
    }

    const pos = getNextPosition(nodes, type);
    const defaultConfig: Record<string, any> = {
      trigger: { trigger_type: 'manual' },
      send_sms: { message: '' },
      wait: { duration: 1, unit: 'days' },
      condition: { condition_type: 'has_replied' },
      update_tag: { action: 'add', tag: '' },
      end: {},
    };

    const { data, error } = await supabase.from('automation_nodes').insert({
      automation_id: automation.id,
      type,
      config: defaultConfig[type] || {},
      position_x: pos.x,
      position_y: pos.y,
    }).select().single();

    if (error || !data) { showAlert('Failed to add node.'); return; }
    const newNode = data as AutomationNode;
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    setSelectedNodeId(newNode.id);

    // Auto-connect to last node if it has a default handle
    const lastNode = nodes[nodes.length - 1];
    if (lastNode && lastNode.type !== 'end' && lastNode.type !== 'condition') {
      handleEdgeCreate(lastNode.id, newNode.id, 'default', updatedNodes);
    }
  }, [automation, nodes]);

  const handleAddNodeInSequence = useCallback(async (afterNodeId: string | null, type: AutomationNodeType) => {
    await handleAddNode(type);
  }, [handleAddNode]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    const { error } = await supabase.from('automation_nodes').delete().eq('id', nodeId);
    if (error) { showAlert('Failed to delete node.'); return; }

    // Remove connected edges
    const updatedEdges = edges.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId);
    const updatedNodes = nodes.filter(n => n.id !== nodeId);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setSelectedNodeId(null);
    scheduleSave(updatedNodes, updatedEdges);
  }, [nodes, edges, scheduleSave]);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    const { error } = await supabase.from('automation_edges').delete().eq('id', edgeId);
    if (error) { showAlert('Failed to delete connection.'); return; }
    const updatedEdges = edges.filter(e => e.id !== edgeId);
    setEdges(updatedEdges);
    scheduleSave(nodes, updatedEdges);
  }, [nodes, edges, scheduleSave]);

  const handleNodeConfigUpdate = useCallback((nodeId: string, config: Record<string, any>) => {
    const updatedNodes = nodes.map(n => n.id === nodeId ? { ...n, config: config as any } : n);
    setNodes(updatedNodes);
    scheduleSave(updatedNodes, edges);
  }, [nodes, edges, scheduleSave]);

  const handleNodePositionChange = useCallback((nodeId: string, x: number, y: number) => {
    const updatedNodes = nodes.map(n => n.id === nodeId ? { ...n, position_x: x, position_y: y } : n);
    setNodes(updatedNodes);
    scheduleSave(updatedNodes, edges);
  }, [nodes, edges, scheduleSave]);

  const handleEdgeCreate = useCallback(async (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle: string,
    currentNodes?: AutomationNode[]
  ) => {
    if (!automation) return;
    const usedNodes = currentNodes || nodes;

    // Deduplicate
    const exists = edges.find(e =>
      e.source_node_id === sourceNodeId &&
      e.target_node_id === targetNodeId &&
      e.source_handle === sourceHandle
    );
    if (exists) return;

    const { data, error } = await supabase.from('automation_edges').insert({
      automation_id: automation.id,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      source_handle: sourceHandle || 'default',
    }).select().single();

    if (error || !data) return;
    const newEdge = data as AutomationEdge;
    const updatedEdges = [...edges, newEdge];
    setEdges(updatedEdges);
    scheduleSave(usedNodes, updatedEdges);
  }, [automation, nodes, edges, scheduleSave]);

  // ── Sequence view reorder ─────────────────────────────────────────────────
  const handleMoveNode = useCallback((nodeId: string, direction: 'up' | 'down') => {
    // Reorder by swapping position_y values
    const sortedNodes = [...nodes].sort((a, b) => a.position_y - b.position_y);
    const idx = sortedNodes.findIndex(n => n.id === nodeId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedNodes.length) return;

    const tempY = sortedNodes[idx].position_y;
    sortedNodes[idx] = { ...sortedNodes[idx], position_y: sortedNodes[swapIdx].position_y };
    sortedNodes[swapIdx] = { ...sortedNodes[swapIdx], position_y: tempY };

    setNodes(sortedNodes);
    scheduleSave(sortedNodes, edges);
  }, [nodes, edges, scheduleSave]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">Loading automation...</p>
        </div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Automation not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        {/* Back */}
        <button
          onClick={onBack}
          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors flex-shrink-0"
          title="Back to Automations"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Automation name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="text-lg font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 border border-violet-400 rounded-xl px-3 py-1 outline-none min-w-0 w-full max-w-xs"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-lg font-bold text-slate-900 dark:text-white truncate hover:text-violet-600 dark:hover:text-violet-400 transition-colors text-left"
              title="Click to rename"
            >
              {automation.name}
            </button>
          )}
          <span className="text-slate-300 dark:text-slate-600 text-xs hidden sm:block">/ Edit</span>
        </div>

        {/* Status badge + toggle */}
        <button
          onClick={cycleStatus}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${STATUS_COLORS[automation.status]}`}
          title={
            automation.status === 'draft' ? 'Click to activate' :
            automation.status === 'active' ? 'Click to pause' :
            'Click to resume'
          }
        >
          {automation.status === 'draft' && '📝 Draft'}
          {automation.status === 'active' && '✅ Active'}
          {automation.status === 'paused' && '⏸ Paused'}
        </button>

        {/* View toggle */}
        <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-600 flex-shrink-0">
          <button
            onClick={() => setBuilderView('flow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              builderView === 'flow'
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Flow View
          </button>
          <button
            onClick={() => setBuilderView('sequence')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              builderView === 'sequence'
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Sequence View
          </button>
        </div>

        {/* Save indicator */}
        <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 flex-shrink-0">
          {isSaving ? (
            <>
              <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 overflow-hidden">
        {builderView === 'flow' ? (
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={node => setSelectedNodeId(node?.id || null)}
            onNodePositionChange={handleNodePositionChange}
            onEdgeCreate={handleEdgeCreate}
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
          />
        ) : (
          <SequenceView
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={node => setSelectedNodeId(node.id)}
            onMoveNode={handleMoveNode}
            onAddNode={handleAddNodeInSequence}
          />
        )}

        {/* Right: Node editor */}
        <NodeEditor
          node={selectedNode}
          onUpdate={handleNodeConfigUpdate}
          onClose={() => setSelectedNodeId(null)}
          onDelete={handleDeleteNode}
        />
      </div>
    </div>
  );
};
