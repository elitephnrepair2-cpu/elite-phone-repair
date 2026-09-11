import React, { useState, useEffect, useRef } from 'react';
import type { Appointment, AppointmentSmsJob } from '../types';
import { fetchAppointmentSmsJobs, triggerAppointmentSmsProcessor } from '../services/appointmentSmsService';

interface AppointmentDetailProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onConvertToTicket: (appointment: Appointment) => Promise<void>;
  onUpdateAppointment: (appointment: Appointment) => Promise<void>;
  onDeleteAppointment: (id: string) => Promise<void>;
  onToggleSmsReminders?: (appointmentId: string, enabled: boolean) => Promise<void>;
}

const statusOptions = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'cancelled'
];

const AppointmentDetail: React.FC<AppointmentDetailProps> = ({ 
  appointment, 
  onClose, 
  onUpdateStatus, 
  onConvertToTicket,
  onUpdateAppointment,
  onDeleteAppointment,
  onToggleSmsReminders
}) => {
  const [updating, setUpdating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [smsJobs, setSmsJobs] = useState<AppointmentSmsJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [isProcessingNow, setIsProcessingNow] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState<Appointment>(appointment);

  useEffect(() => {
    setEditForm(appointment);
    loadSmsJobs();
  }, [appointment]);

  const loadSmsJobs = async () => {
    setLoadingJobs(true);
    const jobs = await fetchAppointmentSmsJobs(appointment.id);
    setSmsJobs(jobs);
    setLoadingJobs(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    await onUpdateStatus(appointment.id, newStatus);
    setUpdating(false);
    await loadSmsJobs();
  };

  const handleToggleSms = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    if (onToggleSmsReminders) {
      await onToggleSmsReminders(appointment.id, enabled);
      await loadSmsJobs();
    }
  };

  const handleProcessNow = async () => {
    setIsProcessingNow(true);
    // Reset any failed jobs for this appointment back to pending for retry
    await supabase
      .from('appointment_sms_jobs')
      .update({ status: 'pending', error_message: null, claimed_at: null })
      .eq('appointment_id', appointment.id)
      .eq('status', 'failed');

    await triggerAppointmentSmsProcessor();
    await loadSmsJobs();
    setIsProcessingNow(false);
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
    await onUpdateAppointment({
      ...editForm,
      version: (appointment.version || 1) + 1
    });
    setUpdating(false);
    setIsEditing(false);
    await loadSmsJobs();
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

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'claimed':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'skipped':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'canceled':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'uncertain':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Reschedule / Edit Appointment' : 'Appointment Details'}
          </h3>
          <div className="flex gap-2">
            {!isEditing && (
               <>
                <button 
                  type="button"
                  onClick={() => setIsEditing(true)} 
                  disabled={deleting}
                  title="Reschedule / Edit"
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
                  title="Delete Appointment"
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
        
        {/* Main Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {isEditing ? (
            <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Customer Name</label>
                  <input name="customer_name" value={editForm.customer_name} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Phone</label>
                  <input name="phone" value={editForm.phone} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="relative">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">New Date</label>
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
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Time Slot</label>
                    <input name="time_window" value={editForm.time_window} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl" />
                 </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Device & Repair</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input name="brand" value={editForm.brand} onChange={handleInputChange} placeholder="Brand" className="px-3 py-2 border rounded-xl" />
                    <input name="model" value={editForm.model} onChange={handleInputChange} placeholder="Model" className="px-3 py-2 border rounded-xl" />
                  </div>
               </div>
            </div>
          ) : (
            <>
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Customer</label>
                   <p className="text-lg font-bold text-slate-800">{appointment.customer_name}</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phone</label>
                   <p className="text-lg font-medium text-slate-700">{appointment.phone}</p>
                </div>
              </div>

              {/* Date & Time Window Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                 <div className="flex items-center mb-1 font-bold text-slate-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {new Date(appointment.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                 </div>
                 <div className="text-slate-700 flex items-center font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {appointment.time_window}
                 </div>
                 <div className="text-xs text-slate-500 mt-2 font-medium">
                    Device: <span className="font-bold text-slate-700">{appointment.brand} {appointment.model}</span> ({appointment.issue})
                 </div>
              </div>

              {/* Quick Status Action Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Quick Actions</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange('checked_in')}
                    disabled={updating}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                      appointment.status === 'checked_in'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Mark Arrived</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    disabled={updating}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Reschedule</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={updating}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                      appointment.status === 'cancelled'
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Cancel Appt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('no_show')}
                    disabled={updating}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                      appointment.status === 'no_show'
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Mark No-Show</span>
                  </button>
                </div>
              </div>

              {/* SMS Automation Panel */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="font-bold text-slate-800 text-sm">SMS Reminders Queue</span>
                    <button
                      type="button"
                      onClick={handleProcessNow}
                      disabled={isProcessingNow}
                      title="Process pending due jobs immediately"
                      className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                    >
                      {isProcessingNow ? (
                        <span>Processing...</span>
                      ) : (
                        <span>⚡ Process Queue Now</span>
                      )}
                    </button>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-semibold text-slate-500">
                      {appointment.sms_reminders_enabled !== false ? 'Enabled' : 'Paused'}
                    </span>
                    <input
                      type="checkbox"
                      checked={appointment.sms_reminders_enabled !== false}
                      onChange={handleToggleSms}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {loadingJobs ? (
                  <div className="text-center py-4 text-xs text-slate-400">Loading automation queue...</div>
                ) : smsJobs.length > 0 ? (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                    {smsJobs.map((job) => (
                      <div key={job.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between text-xs gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 capitalize">
                              {job.job_type.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getJobStatusBadge(job.status)}`}>
                              {job.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Scheduled: {new Date(job.scheduled_for).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {(job.skip_reason || job.error_message) && (
                            <div className="mt-0.5">
                              <p className="text-[10px] text-amber-700 italic">
                                Note: {job.skip_reason || job.error_message}
                              </p>
                              {(job.error_message || '').toLowerCase().includes('unsubscribed') && (
                                <p className="text-[10px] text-red-600 font-semibold mt-0.5">
                                  💡 Tip: Have customer text <span className="font-mono bg-red-50 px-1 py-0.5 rounded border border-red-200">START</span> to (844) 741-4579 to unblock.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {job.provider_message_id && (
                          <span className="text-[9px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
                            {job.provider_message_id.startsWith('dry_run') ? 'DRY-RUN' : job.provider_message_id.slice(-6)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    No scheduled SMS messages found for this appointment.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
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
