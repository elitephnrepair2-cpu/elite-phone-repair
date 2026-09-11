import React, { useState, useEffect } from 'react';
import type {
  AutomationNode,
  AutomationNodeType,
  TriggerNodeConfig,
  SendSmsNodeConfig,
  WaitNodeConfig,
  ConditionNodeConfig,
  UpdateTagNodeConfig,
} from '../../types';
import { SmsPreview } from './SmsPreview';

interface NodeEditorProps {
  node: AutomationNode | null;
  onUpdate: (nodeId: string, config: Record<string, any>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
}

const NODE_TYPE_LABELS: Record<AutomationNodeType, string> = {
  trigger: 'Trigger',
  send_sms: 'Send SMS',
  wait: 'Wait',
  condition: 'Condition',
  update_tag: 'Update Tag',
  end: 'End',
};

const NODE_TYPE_COLORS: Record<AutomationNodeType, string> = {
  trigger: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  send_sms: 'bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400',
  wait: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
  condition: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
  update_tag: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400',
  end: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400',
};

const VARIABLES = [
  { label: 'First Name', value: '{{first_name}}' },
  { label: 'Last Name', value: '{{last_name}}' },
  { label: 'Phone', value: '{{phone}}' },
];

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onUpdate, onClose, onDelete }) => {
  const [localConfig, setLocalConfig] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (node) {
      setLocalConfig({ ...(node.config as Record<string, any>) });
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-4xl mb-3">👆</div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Select a node on the canvas to edit its settings
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (key: string, value: any) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    onUpdate(node.id, updated);
  };

  const insertVariable = (v: string) => {
    const msg = (localConfig.message || '') + v;
    handleChange('message', msg);
  };

  const colorClass = NODE_TYPE_COLORS[node.type];

  return (
    <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${colorClass}`}>
            {NODE_TYPE_LABELS[node.type]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {node.type !== 'trigger' && node.type !== 'end' && (
            <button
              onClick={() => {
                if (window.confirm('Delete this node?')) {
                  onDelete(node.id);
                  onClose();
                }
              }}
              className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Delete node"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── TRIGGER ── */}
        {node.type === 'trigger' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Trigger Type</label>
              <select
                value={(localConfig as TriggerNodeConfig).trigger_type || 'manual'}
                onChange={e => handleChange('trigger_type', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
              >
                <option value="manual">Manual Enrollment</option>
                <option value="keyword_reply">Keyword Reply (Inbound SMS)</option>
              </select>
            </div>

            {(localConfig as TriggerNodeConfig).trigger_type === 'keyword_reply' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Keyword</label>
                <input
                  type="text"
                  value={(localConfig as TriggerNodeConfig).keyword || ''}
                  onChange={e => handleChange('keyword', e.target.value.toUpperCase())}
                  placeholder="e.g. INFO, JOIN, REPAIR"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none uppercase tracking-widest"
                />
                <p className="text-xs text-slate-400 mt-1">Customer must text this exact word to trigger this automation.</p>
              </div>
            )}

            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                ℹ️ This is the entry point. Every automation starts here.
              </p>
            </div>
          </>
        )}

        {/* ── SEND SMS ── */}
        {node.type === 'send_sms' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Message</label>
              <textarea
                value={(localConfig as SendSmsNodeConfig).message || ''}
                onChange={e => handleChange('message', e.target.value)}
                placeholder="Type your SMS message here..."
                rows={5}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Variable chips */}
            <div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Insert Variable</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => insertVariable(v.value)}
                    className="px-2.5 py-1 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-lg text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview toggle */}
            <button
              onClick={() => setShowPreview(p => !p)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {showPreview ? 'Hide Preview' : 'Preview Message'}
            </button>

            {showPreview && (
              <SmsPreview message={(localConfig as SendSmsNodeConfig).message || ''} />
            )}
          </>
        )}

        {/* ── WAIT ── */}
        {node.type === 'wait' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Wait Duration</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={(localConfig as WaitNodeConfig).duration || 1}
                  onChange={e => handleChange('duration', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                />
                <select
                  value={(localConfig as WaitNodeConfig).unit || 'days'}
                  onChange={e => handleChange('unit', e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Contact will pause here for <strong>{(localConfig as WaitNodeConfig).duration || 1} {(localConfig as WaitNodeConfig).unit || 'days'}</strong> before continuing.
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                ⏱️ Execution resumes automatically by the background scheduler — no browser needed.
              </p>
            </div>
          </>
        )}

        {/* ── CONDITION ── */}
        {node.type === 'condition' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Condition</label>
              <select
                value={(localConfig as ConditionNodeConfig).condition_type || 'has_replied'}
                onChange={e => handleChange('condition_type', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
              >
                <option value="has_replied">Has customer replied since the last step?</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 border border-emerald-200 dark:border-emerald-700 text-center">
                <span className="text-lg">✅</span>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">YES branch</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Customer replied</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3 border border-rose-200 dark:border-rose-700 text-center">
                <span className="text-lg">❌</span>
                <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mt-1">NO branch</p>
                <p className="text-[10px] text-slate-500 mt-0.5">No reply yet</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connect two outgoing edges from this node: one labeled <strong>yes</strong> and one labeled <strong>no</strong>.
            </p>
          </>
        )}

        {/* ── UPDATE TAG ── */}
        {node.type === 'update_tag' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Action</label>
              <div className="flex gap-2">
                {(['add', 'remove'] as const).map(action => (
                  <button
                    key={action}
                    onClick={() => handleChange('action', action)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      (localConfig as UpdateTagNodeConfig).action === action
                        ? action === 'add'
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-rose-500 text-white border-rose-500'
                        : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {action === 'add' ? '+ Add Tag' : '− Remove Tag'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tag Name</label>
              <input
                type="text"
                value={(localConfig as UpdateTagNodeConfig).tag || ''}
                onChange={e => handleChange('tag', e.target.value)}
                placeholder="e.g. vip, follow-up-needed, no-reply"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>
          </>
        )}

        {/* ── END ── */}
        {node.type === 'end' && (
          <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-600">
            <div className="text-3xl mb-2">🏁</div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">End of Automation</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              When a contact reaches this node, their enrollment is marked complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
