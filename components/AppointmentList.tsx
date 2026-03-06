
import React, { useState, useMemo, useRef } from 'react';
import type { Appointment } from '../types';
import AppointmentDetail from './AppointmentDetail';

interface AppointmentListProps {
  // FIX: Changed 'appointments' to 'Appointment[]' to correctly type the array of appointments.
  appointments: Appointment[];
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onConvertToTicket: (appointment: Appointment) => Promise<void>;
  onUpdateAppointment: (appointment: Appointment) => Promise<void>;
  onDeleteAppointment: (id: string) => Promise<void>;
}

type FilterType = 'all' | 'today' | 'tomorrow' | 'week' | 'custom';

const AppointmentList: React.FC<AppointmentListProps> = ({ appointments, onUpdateStatus, onConvertToTicket, onUpdateAppointment, onDeleteAppointment }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const filteredAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    let filtered = appointments;

    if (filter === 'today') {
        filtered = appointments.filter(a => {
            const d = new Date(a.date);
            return d.toISOString().split('T')[0] === today.toISOString().split('T')[0];
        });
    } else if (filter === 'tomorrow') {
        filtered = appointments.filter(a => {
            const d = new Date(a.date);
            return d.toISOString().split('T')[0] === tomorrow.toISOString().split('T')[0];
        });
    } else if (filter === 'week') {
        filtered = appointments.filter(a => {
            const d = new Date(a.date);
            return d >= today && d <= nextWeek;
        });
    } else if (filter === 'custom' && customDate) {
        filtered = appointments.filter(a => {
            return a.date === customDate;
        });
    }

    return filtered.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.time_window.localeCompare(b.time_window);
    });

  }, [appointments, filter, customDate]);

  const handleDateTrigger = () => {
    if (dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch (e) {
        dateInputRef.current.click();
      }
    }
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
          case 'checked_in': return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'completed': return 'bg-slate-100 text-slate-800 border-slate-200';
          case 'no_show': return 'bg-red-100 text-red-800 border-red-200';
          default: return 'bg-amber-100 text-amber-800 border-amber-200'; 
      }
  };

  return (
    <div className="h-full flex flex-col">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-slate-800">Appointments</h2>
            
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-white rounded-lg shadow-sm p-1 border border-slate-200">
                    {(['all', 'today', 'tomorrow', 'week'] as FilterType[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => { setFilter(f); setCustomDate(''); }}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                                (filter === f && f !== 'custom')
                                ? 'bg-red-600 text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {f === 'week' ? 'This Week' : f}
                        </button>
                    ))}
                </div>

                <div 
                  onClick={handleDateTrigger}
                  className={`flex items-center gap-2 bg-white rounded-lg shadow-sm px-4 py-2 border transition-all cursor-pointer relative hover:bg-slate-50 ${
                      filter === 'custom' ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'
                  }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${filter === 'custom' ? 'text-red-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className={`text-sm font-bold ${filter === 'custom' ? 'text-slate-900' : 'text-slate-500'}`}>
                        {customDate ? new Date(customDate + 'T00:00:00').toLocaleDateString() : 'Pick Day'}
                    </span>
                    <input
                        ref={dateInputRef}
                        type="date"
                        value={customDate}
                        onChange={(e) => {
                          setCustomDate(e.target.value);
                          setFilter('custom');
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {customDate && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomDate('');
                          setFilter('all');
                        }}
                        className="ml-2 p-1 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-4 custom-scrollbar">
            {filteredAppointments.length > 0 ? (
                filteredAppointments.map(appt => (
                    <div 
                        key={appt.id}
                        onClick={() => setSelectedAppointment(appt)}
                        className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 cursor-pointer flex flex-col justify-between group"
                    >
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(appt.status)}`}>
                                    {appt.status.replace('_', ' ')}
                                </span>
                                <span className="text-xs font-semibold text-slate-400">
                                    {new Date(appt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}
                                </span>
                            </div>
                            
                            <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-red-600 transition-colors">{appt.customer_name}</h3>
                            <p className="text-sm text-slate-500 mb-3">{appt.phone}</p>
                            
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
                                <p className="text-sm font-medium text-slate-700">{appt.brand} {appt.model}</p>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{appt.issue}</p>
                            </div>
                        </div>

                        <div className="flex items-center text-sm text-slate-600 font-medium pt-2 border-t border-slate-100">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                             </svg>
                             {appt.time_window}
                        </div>
                    </div>
                ))
            ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-400">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium">No appointments found.</p>
                    <button 
                      onClick={() => {setFilter('all'); setCustomDate('');}} 
                      className="mt-2 text-red-600 font-bold hover:underline"
                    >
                      View all appointments
                    </button>
                </div>
            )}
        </div>

        {selectedAppointment && (
            <AppointmentDetail 
                appointment={selectedAppointment}
                onClose={() => setSelectedAppointment(null)}
                onUpdateStatus={onUpdateStatus}
                onConvertToTicket={onConvertToTicket}
                onUpdateAppointment={onUpdateAppointment}
                onDeleteAppointment={onDeleteAppointment}
            />
        )}
    </div>
  );
};

export default AppointmentList;
