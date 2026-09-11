import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import type { Automation, AutomationEnrollment, Customer } from '../../types';

interface AutomationsViewProps {
  customers: Customer[];
  onOpenBuilder: (automationId: string) => void;
  showAlert: (msg: string) => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600' },
  active: { label: 'Active', className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700' },
  paused: { label: 'Paused', className: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700' },
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual Enrollment',
  keyword_reply: 'Keyword Reply',
};

interface AutomationRow extends Automation {
  active_count: number;
  completed_count: number;
}

// ─── Enroll Contact Modal ────────────────────────────────────────────────────

interface EnrollModalProps {
  automation: AutomationRow;
  customers: Customer[];
  onClose: () => void;
  onEnrolled: () => void;
  showAlert: (msg: string) => void;
}

const EnrollModal: React.FC<EnrollModalProps> = ({ automation, customers, onClose, onEnrolled, showAlert }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isEnrolling, setIsEnrolling] = useState(false);

  const filtered = customers.filter(c =>
    c.marketing_sms_consent === true &&
    (search === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleEnroll = async () => {
    if (selected.size === 0) { showAlert('Select at least one customer.'); return; }
    setIsEnrolling(true);
    try {
      // Get existing active enrollments to prevent duplicates
      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('contact_id')
        .eq('automation_id', automation.id)
        .eq('status', 'active');

      const alreadyEnrolled = new Set((existing || []).map((e: any) => e.contact_id));
      const toEnroll = [...selected].filter(id => !alreadyEnrolled.has(id));

      if (toEnroll.length === 0) {
        showAlert('All selected customers are already actively enrolled in this automation.');
        setIsEnrolling(false);
        return;
      }

      // Get the trigger node to start from
      const { data: triggerNodes } = await supabase
        .from('automation_nodes')
        .select('id')
        .eq('automation_id', automation.id)
        .eq('type', 'trigger')
        .limit(1);

      const triggerNodeId = triggerNodes?.[0]?.id || null;

      const rows = toEnroll.map(contactId => ({
        automation_id: automation.id,
        contact_id: contactId,
        current_node_id: triggerNodeId,
        status: 'active',
        next_execution_at: new Date().toISOString(),
        metadata: { enrolled_by: 'staff_manual' },
      }));

      const { error } = await supabase.from('automation_enrollments').insert(rows);
      if (error) throw error;

      showAlert(`✅ Successfully enrolled ${toEnroll.length} customer${toEnroll.length > 1 ? 's' : ''}.${
        toEnroll.length < selected.size ? ` (${selected.size - toEnroll.length} were already enrolled and skipped)` : ''
      }`);
      onEnrolled();
      onClose();
    } catch (err: any) {
      showAlert('Failed to enroll: ' + err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Enroll Contacts</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">"{automation.name}"</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <input
            type="text"
            placeholder="Search customers with marketing consent..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none dark:text-white"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Only customers with marketing SMS consent are shown. {filtered.length} available.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No eligible customers found.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(c => (
                <label key={c.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.phone}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={handleEnroll}
              disabled={isEnrolling || selected.size === 0}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
            >
              {isEnrolling ? 'Enrolling...' : `Enroll ${selected.size > 0 ? selected.size : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main AutomationsView ────────────────────────────────────────────────────

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  customers,
  onOpenBuilder,
  showAlert,
  showConfirm,
}) => {
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbReady, setDbReady] = useState<boolean | null>(null); // null = checking, true = ready, false = migration needed
  const [enrollTarget, setEnrollTarget] = useState<AutomationRow | null>(null);

  const loadAutomations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: autos, error: autoError } = await supabase.from('automations').select('*').order('updated_at', { ascending: false });

      // Detect missing migration — Postgres error 42P01 = relation does not exist
      if (autoError) {
        const msg = autoError.message || '';
        const isMissingTable = msg.includes('relation') && msg.includes('does not exist') ||
          msg.includes('42P01') || (autoError as any).code === '42P01' || msg.includes('automations');
        if (isMissingTable) {
          setDbReady(false);
          setIsLoading(false);
          return;
        }
        // Some other error
        showAlert('Failed to load automations: ' + msg);
        setIsLoading(false);
        return;
      }

      setDbReady(true);
      if (!autos) { setIsLoading(false); return; }

      // Get enrollment counts per automation
      const { data: enrollments } = await supabase
        .from('automation_enrollments')
        .select('automation_id, status');

      const countMap: Record<string, { active: number; completed: number }> = {};
      (enrollments || []).forEach((e: any) => {
        if (!countMap[e.automation_id]) countMap[e.automation_id] = { active: 0, completed: 0 };
        if (e.status === 'active') countMap[e.automation_id].active++;
        if (e.status === 'completed') countMap[e.automation_id].completed++;
      });

      setAutomations(autos.map((a: Automation) => ({
        ...a,
        active_count: countMap[a.id]?.active || 0,
        completed_count: countMap[a.id]?.completed || 0,
      })));
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('does not exist') || msg.includes('42P01')) {
        setDbReady(false);
      } else {
        showAlert('Failed to load automations.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAutomations(); }, []);

  const handleCreate = async () => {
    if (dbReady === false) {
      showAlert('The automations database tables have not been set up yet. Please run supabase_migration_automations.sql in your Supabase SQL Editor first.');
      return;
    }
    const { data, error } = await supabase.from('automations').insert({
      name: 'New Automation',
      status: 'draft',
      trigger_type: 'manual',
      trigger_config: {},
    }).select().single();

    if (error || !data) {
      const msg = error?.message || '';
      if (msg.includes('does not exist') || msg.includes('42P01')) {
        setDbReady(false);
        return;
      }
      showAlert('Failed to create automation. Error: ' + (error?.message || 'Unknown error'));
      return;
    }
    onOpenBuilder(data.id);
  };

  const handleDuplicate = async (auto: AutomationRow) => {
    try {
      // Duplicate automation record
      const { data: newAuto, error } = await supabase.from('automations').insert({
        name: `${auto.name} (Copy)`,
        status: 'draft',
        trigger_type: auto.trigger_type,
        trigger_config: auto.trigger_config,
      }).select().single();
      if (error || !newAuto) throw error;

      // Duplicate nodes with new automation_id and build ID map for edges
      const { data: srcNodes } = await supabase.from('automation_nodes').select('*').eq('automation_id', auto.id);
      const nodeIdMap: Record<string, string> = {};
      if (srcNodes && srcNodes.length > 0) {
        const { data: newNodes } = await supabase.from('automation_nodes').insert(
          srcNodes.map((n: any) => ({ automation_id: newAuto.id, type: n.type, config: n.config, position_x: n.position_x, position_y: n.position_y }))
        ).select();
        (newNodes || []).forEach((n: any, i: number) => { nodeIdMap[srcNodes[i].id] = n.id; });
      }

      // Duplicate edges with remapped IDs
      const { data: srcEdges } = await supabase.from('automation_edges').select('*').eq('automation_id', auto.id);
      if (srcEdges && srcEdges.length > 0) {
        await supabase.from('automation_edges').insert(
          srcEdges.map((e: any) => ({
            automation_id: newAuto.id,
            source_node_id: nodeIdMap[e.source_node_id] || e.source_node_id,
            target_node_id: nodeIdMap[e.target_node_id] || e.target_node_id,
            source_handle: e.source_handle,
          }))
        );
      }

      showAlert(`✅ "${auto.name}" duplicated successfully.`);
      loadAutomations();
    } catch (err: any) {
      showAlert('Failed to duplicate: ' + err.message);
    }
  };

  const handleToggleStatus = async (auto: AutomationRow) => {
    const next = auto.status === 'active' ? 'paused' : 'active';
    if (next === 'active') {
      const { data: nodeCount } = await supabase.from('automation_nodes').select('id', { count: 'exact', head: true }).eq('automation_id', auto.id);
      // Check if has trigger
      const { data: triggerCheck } = await supabase.from('automation_nodes').select('id').eq('automation_id', auto.id).eq('type', 'trigger').limit(1);
      if (!triggerCheck || triggerCheck.length === 0) {
        showAlert('Cannot activate: automation has no trigger node. Open the builder to add one.');
        return;
      }
    }
    const { error } = await supabase.from('automations').update({ status: next, updated_at: new Date().toISOString() }).eq('id', auto.id);
    if (!error) loadAutomations();
  };

  const handleDelete = (auto: AutomationRow) => {
    showConfirm(
      `Delete "${auto.name}"? This will also delete all nodes, edges, and enrollment history. This cannot be undone.`,
      async () => {
        const { error } = await supabase.from('automations').delete().eq('id', auto.id);
        if (error) showAlert('Failed to delete.');
        else loadAutomations();
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-violet-100 dark:bg-violet-950/60 rounded-xl text-2xl">🔄</span>
            Automations
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-14">
            Build automated SMS sequences that run in the background.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={dbReady === false}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Automation
        </button>
      </div>

      {/* Safety notice */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 flex items-start gap-3">
        <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
        <div>
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">SMS Safety</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Only <strong>Active</strong> automations can send messages. Draft and Paused automations never text customers. Only customers with marketing SMS consent will receive automated messages.
          </p>
        </div>
      </div>

      {/* ── Database setup required banner ── */}
      {dbReady === false && (
        <div className="bg-white dark:bg-slate-800 border-2 border-violet-300 dark:border-violet-700 rounded-3xl overflow-hidden shadow-xl">
          <div className="bg-violet-600 px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-black text-base">One-time database setup required</h3>
              <p className="text-violet-200 text-xs mt-0.5">The Automations tables haven't been created in Supabase yet.</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Run the migration SQL in your <strong>Supabase Dashboard → SQL Editor</strong>. This is a one-time step.
            </p>

            {/* Steps */}
            <ol className="space-y-3">
              {[
                { step: '1', text: 'Go to your Supabase project dashboard' },
                { step: '2', text: 'Click SQL Editor in the left sidebar' },
                { step: '3', text: 'Open supabase_migration_automations.sql from your project folder' },
                { step: '4', text: 'Paste the contents and click Run' },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{text}</span>
                </li>
              ))}
            </ol>

            {/* SQL file reference + copy instruction */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <code className="text-slate-400 text-xs ml-2">supabase_migration_automations.sql</code>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/supabase_migration_automations.sql');
                      if (res.ok) {
                        const text = await res.text();
                        await navigator.clipboard.writeText(text);
                        alert('✅ SQL copied to clipboard! Paste it into Supabase SQL Editor and click Run.');
                      } else {
                        // Fallback: copy the file path so user knows where to find it
                        await navigator.clipboard.writeText('supabase_migration_automations.sql');
                        alert('File path copied. Open this file from your project root and paste its contents into Supabase SQL Editor.');
                      }
                    } catch {
                      alert('Open supabase_migration_automations.sql from your project folder and paste it into Supabase SQL Editor.');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy SQL
                </button>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] text-slate-400 font-mono">
                  <span className="text-slate-500">-- </span>
                  <span className="text-emerald-400">CREATE TABLE IF NOT EXISTS</span>
                  <span className="text-white"> public.automations (...</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  <span className="text-slate-500">-- </span>
                  <span className="text-emerald-400">CREATE TABLE IF NOT EXISTS</span>
                  <span className="text-white"> public.automation_nodes (...</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  <span className="text-slate-500">-- </span>
                  <span className="text-slate-500">+ 4 more tables, RLS policies, indexes...</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Supabase Dashboard
              </a>
              <button
                onClick={() => { setDbReady(null); loadAutomations(); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automations table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-16 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">No automations yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
            Create your first automation to start building an SMS sequence.
          </p>
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors shadow-md"
          >
            Create Your First Automation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(auto => {
            const pill = STATUS_PILL[auto.status] || STATUS_PILL['draft'];
            return (
              <div
                key={auto.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 bg-violet-100 dark:bg-violet-950/60 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🔄</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{auto.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${pill.className}`}>
                        {pill.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <span>⚡</span>
                        {TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        {auto.active_count} active
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                        {auto.completed_count} completed
                      </span>
                      <span>
                        Updated {new Date(auto.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {/* Enroll — only for active manual trigger automations */}
                    {auto.status === 'active' && auto.trigger_type === 'manual' && (
                      <button
                        onClick={() => setEnrollTarget(auto)}
                        className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                      >
                        Enroll
                      </button>
                    )}

                    <button
                      onClick={() => onOpenBuilder(auto.id)}
                      className="px-3 py-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-700 text-xs font-bold rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-colors"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleToggleStatus(auto)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
                        auto.status === 'active'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700 hover:bg-amber-100'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {auto.status === 'active' ? 'Pause' : 'Activate'}
                    </button>

                    <button
                      onClick={() => handleDuplicate(auto)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleDelete(auto)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enroll modal */}
      {enrollTarget && (
        <EnrollModal
          automation={enrollTarget}
          customers={customers}
          onClose={() => setEnrollTarget(null)}
          onEnrolled={loadAutomations}
          showAlert={showAlert}
        />
      )}
    </div>
  );
};
