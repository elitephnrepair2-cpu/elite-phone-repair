
import React, { useState, useEffect, useRef } from 'react';
import type { Appointment } from '../types';

interface AppointmentDetailProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onConvertToTicket: (appointment: Appointment) => Promise<void>;
  onUpdateAppointment: (appointment: Appointment) => Promise<void>;
  onDeleteAppointment: (id: string) => Promise<void>;
}

const statusOptions = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'no_show'
];

const AppointmentDetail: React.FC<AppointmentDetailProps> = ({ 
  appointment, 
  onClose, 
  onUpdateStatus, 
  onConvertToTicket,
  onUpdateAppointment,
  onDeleteAppointment
}) => {
  const [updating, setUpdating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState<Appointment>(appointment);

  useEffect(() => {
    setEditForm(appointment);
  }, [appointment]);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUpdating(true);
    await onUpdateStatus(appointment.id, e.target.value);
    setUpdating(false);
  };

  const handleConvert = async () => {
    if(window.confirm(`Create a repair ticket for ${appointment.customer_name}?`)) {
        setConverting(true);
        await onConvertToTicket(appointment);
        setConverting(false);
        onClose();
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm("Delete this appointment?")) {
      setDeleting(true);
      onDeleteAppointment(appointment.id).catch(err => {
          console.error("Delete failed:", err);
      });
      onClose();
    }
  };

  const handleSaveEdit = async () => {
    setUpdating(true);
    await onUpdateAppointment(editForm);
    setUpdating(false);
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDateTrigger = () => {
    if (dateInputRef.current) {
        try {
            dateInputRef.current.showPicker();
        } catch (e) {
            dateInputRef.current.click();
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-sm:max-w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Edit Appointment' : 'Appointment Details'}
          </h3>
          <div className="flex gap-2">
            {!isEditing && (
               <>
                <button 
                  type="button"
                  onClick={() => setIsEditing(true)} 
                  disabled={deleting}
                  className="text-slate-500 hover:text-blue-600 transition-colors p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button 
                  type="button"
                  onClick={handleDelete} 
                  disabled={deleting}
                  className="text-slate-500 hover:text-red-600 transition-colors p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
               </>
            )}
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors ml-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {isEditing ? (
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Customer Name</label>
                  <input name="customer_name" value={editForm.customer_name} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="relative">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Pick New Date</label>
                    <div 
                        onClick={handleDateTrigger}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 flex items-center cursor-pointer hover:bg-white transition-colors"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         <span className="font-bold text-slate-800">{new Date(editForm.date + 'T00:00:00').toLocaleDateString()}</span>
                         <input 
                            ref={dateInputRef}
                            name="date" 
                            type="date" 
                            value={editForm.date} 
                            onChange={handleInputChange} 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Time Window</label>
                    <input name="time_window" value={editForm.time_window} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl" />
                 </div>
               </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Customer</label>
                   <p className="text-lg font-semibold text-slate-800">{appointment.customer_name}</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phone</label>
                   <p className="text-lg text-slate-700">{appointment.phone}</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <div className="flex items-center mb-2 font-bold text-blue-900">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {new Date(appointment.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                 </div>
                 <div className="text-blue-800 flex items-center font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {appointment.time_window}
                 </div>
              </div>

              <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Update Status</label>
                 <select value={appointment.status} onChange={handleStatusChange} disabled={updating} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl capitalize font-bold text-slate-800">
                    {statusOptions.map(opt => <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>)}
                 </select>
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
             {isEditing ? (
                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl">Cancel</button>
                  <button type="button" onClick={handleSaveEdit} disabled={updating} className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl">Save Changes</button>
                </div>
             ) : (
                 <button type="button" onClick={handleConvert} disabled={converting || deleting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors flex items-center justify-center">
                    {converting ? 'Converting...' : 'Convert to Repair Ticket'}
                 </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetail;
