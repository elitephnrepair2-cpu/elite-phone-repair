import React, { useState } from 'react';
import type { PartsOrder } from '../types';

interface PartsDashboardProps {
  partsOrders: PartsOrder[];
  onAddPart: (part: Pick<PartsOrder, 'part_type' | 'status' | 'notes'>) => void;
  onUpdatePartStatus: (id: string, newStatus: string) => void;
  onDeletePart: (id: string) => void;
}

const PartsDashboard: React.FC<PartsDashboardProps> = ({
  partsOrders,
  onAddPart,
  onUpdatePartStatus,
  onDeletePart
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPartType, setNewPartType] = useState('');
  const [newPartNotes, setNewPartNotes] = useState('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const filteredParts = partsOrders.filter(part => {
    if (statusFilter !== 'All' && part.status !== statusFilter) return false;
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartType.trim()) return;

    onAddPart({
      part_type: newPartType,
      status: 'Pending',
      notes: newPartNotes || null
    });

    setNewPartType('');
    setNewPartNotes('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Parts to Order</h2>
          <p className="text-slate-500 text-sm mt-1">Manage and track parts requested by technicians.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Ordered">Ordered</option>
            <option value="Received">Received</option>
          </select>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Part
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-100/50 border-y border-slate-200">
              <th className="py-3 px-4 font-bold text-slate-700 text-sm whitespace-nowrap">Part Requested</th>
              <th className="py-3 px-4 font-bold text-slate-700 text-sm">Status</th>
              <th className="py-3 px-4 font-bold text-slate-700 text-sm w-1/3">Notes</th>
              <th className="py-3 px-4 font-bold text-slate-700 text-sm whitespace-nowrap">Request Date</th>
              <th className="py-3 px-4 font-bold text-slate-700 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                  No parts found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredParts.map(part => (
                <tr key={part.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{part.part_type}</p>
                  </td>
                  <td className="py-3 px-4">
                     <select
                        value={part.status}
                        onChange={(e) => onUpdatePartStatus(part.id, e.target.value)}
                        className={`text-xs font-bold px-2 py-1 rounded-full border outline-none cursor-pointer
                            ${part.status === 'Pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                              part.status === 'Ordered' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                              'bg-green-100 text-green-800 border-green-200'}`}
                     >
                       <option value="Pending">Pending</option>
                       <option value="Ordered">Ordered</option>
                       <option value="Received">Received</option>
                     </select>
                  </td>
                  <td className="py-3 px-4">
                     <p className="text-sm text-slate-600 line-clamp-2">{part.notes || '-'}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-500">{new Date(part.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button 
                      onClick={() => {
                        if (confirm(`Delete part request for: ${part.part_type}?`)) {
                          onDeletePart(part.id);
                        }
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete part request"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">Add Part to Order</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Part Requested *</label>
                  <input 
                    type="text" 
                    value={newPartType}
                    onChange={(e) => setNewPartType(e.target.value)}
                    required
                    placeholder="e.g. iPhone 13 Pro Screen Replacement"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Additional Notes</label>
                  <textarea 
                    value={newPartNotes}
                    onChange={(e) => setNewPartNotes(e.target.value)}
                    placeholder="Supplier, tracking info, customer name etc."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none h-24"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                  >
                    Save Part
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartsDashboard;
