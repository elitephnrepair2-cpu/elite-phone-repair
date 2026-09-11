import React, { useState, useMemo } from 'react';
import type { FullRepairTicket } from '../types';

interface TodayTicketsListProps {
    tickets: FullRepairTicket[];
    onTicketClick: (ticket: FullRepairTicket) => void;
    onTogglePaid: (ticketId: string, isPaid: boolean) => Promise<void>;
    onTicketStatusChange: (ticketId: string, newStatus: string) => Promise<void>;
    onDeleteTicket?: (ticketId: string) => void;
}

const TodayTicketsList: React.FC<TodayTicketsListProps> = ({ tickets, onTicketClick, onTogglePaid, onTicketStatusChange, onDeleteTicket }) => {
    // Default to today's date in local YYYY-MM-DD format
    const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
    const [selectedDate, setSelectedDate] = useState<string>(todayStr);

    // Calculate next / previous date strings
    const changeDateByDays = (days: number) => {
        const parts = selectedDate.split('-');
        if (parts.length === 3) {
            const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            dateObj.setDate(dateObj.getDate() + days);
            setSelectedDate(dateObj.toLocaleDateString('en-CA'));
        }
    };

    // Filter tickets for the selected intake date
    const dateTickets = useMemo(() => {
        return tickets.filter(t => {
            if (!t.created_at) return false;
            const ticketDateStr = new Date(t.created_at).toLocaleDateString('en-CA');
            return t.created_at.startsWith(selectedDate) || ticketDateStr === selectedDate;
        });
    }, [tickets, selectedDate]);

    // Calculate metrics for selected date
    const metrics = useMemo(() => {
        const totalIntakes = dateTickets.length;
        const paidTickets = dateTickets.filter(t => t.is_paid);
        const paidCount = paidTickets.length;

        const parseCost = (val?: string | number) => {
            if (!val) return 0;
            const cleaned = String(val).replace(/[^0-9.]/g, '');
            return parseFloat(cleaned) || 0;
        };

        const totalEstValue = dateTickets.reduce((sum, t) => sum + parseCost(t.estimated_cost), 0);
        const totalPaidValue = paidTickets.reduce((sum, t) => sum + parseCost(t.estimated_cost), 0);

        return {
            totalIntakes,
            paidCount,
            totalEstValue,
            totalPaidValue
        };
    }, [dateTickets]);

    // Format display header text
    const formattedDateHeader = useMemo(() => {
        const parts = selectedDate.split('-');
        if (parts.length !== 3) return selectedDate;
        const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dateFormatted = dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        if (selectedDate === todayStr) {
            return `Today (${dateFormatted})`;
        }
        return dateFormatted;
    }, [selectedDate, todayStr]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl animate-in fade-in slide-in-from-bottom-4 space-y-4">
            {/* Date Selector & Navigation Bar */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl font-bold">
                        📅
                    </div>
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            {formattedDateHeader}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Showing intake tickets checked in on this date
                        </p>
                    </div>
                </div>

                {/* Date Controls */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <button
                        onClick={() => changeDateByDays(-1)}
                        className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs shadow-sm transition-colors flex items-center gap-1"
                        title="Previous Day"
                    >
                        ◀ <span className="hidden sm:inline">Prev</span>
                    </button>

                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                            if (e.target.value) setSelectedDate(e.target.value);
                        }}
                        className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-red-500 outline-none shadow-sm cursor-pointer"
                    />

                    <button
                        onClick={() => changeDateByDays(1)}
                        className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs shadow-sm transition-colors flex items-center gap-1"
                        title="Next Day"
                    >
                        <span className="hidden sm:inline">Next</span> ▶
                    </button>

                    {selectedDate !== todayStr && (
                        <button
                            onClick={() => setSelectedDate(todayStr)}
                            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-xs shadow-md transition-colors"
                        >
                            Today
                        </button>
                    )}
                </div>
            </div>

            {/* Daily Intake Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Intakes</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{metrics.totalIntakes} <span className="text-xs font-normal text-slate-500">tickets</span></span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Paid Intakes</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{metrics.paidCount} / {metrics.totalIntakes}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Est. Revenue</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">${metrics.totalEstValue.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Collected</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">${metrics.totalPaidValue.toFixed(2)}</span>
                </div>
            </div>

            {/* Tickets Table */}
            {dateTickets.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider font-extrabold">
                                <th className="p-4">Customer</th>
                                <th className="p-4">Device / Issue</th>
                                <th className="p-4 hidden sm:table-cell">Status</th>
                                <th className="p-4 hidden md:table-cell text-right">Quote</th>
                                <th className="p-4 text-center">Paid</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {dateTickets.map(ticket => (
                                <tr
                                    key={ticket.id}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors group"
                                >
                                    <td className="p-4 cursor-pointer" onClick={() => onTicketClick(ticket)}>
                                        <p className="font-bold text-slate-800 dark:text-white">{ticket.customer?.name || 'Walk-in Customer'}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            🕒 {ticket.created_at ? new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                        </p>
                                    </td>
                                    <td className="p-4 cursor-pointer" onClick={() => onTicketClick(ticket)}>
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{ticket.device}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px] lg:max-w-xs" title={ticket.problem_description}>{ticket.problem_description}</p>
                                    </td>
                                    <td className="p-4 hidden sm:table-cell">
                                        <select
                                            className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2 font-medium"
                                            value={ticket.status || 'In Queue'}
                                            onChange={(e) => onTicketStatusChange(ticket.id, e.target.value)}
                                        >
                                            <option value="In Queue">In Queue</option>
                                            <option value="Diagnosing">Diagnosing</option>
                                            <option value="Waiting on Parts">Waiting on Parts</option>
                                            <option value="Repairing">Repairing</option>
                                            <option value="Ready for Pickup">Ready for Pickup</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </td>
                                    <td className="p-4 hidden md:table-cell text-right text-slate-800 dark:text-slate-200 font-bold cursor-pointer" onClick={() => onTicketClick(ticket)}>
                                        {ticket.estimated_cost || '$0.00'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => onTogglePaid(ticket.id, !ticket.is_paid)}
                                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-all ${ticket.is_paid
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-green-400'
                                                }`}
                                            title={ticket.is_paid ? 'Mark Unpaid' : 'Mark Paid'}
                                        >
                                            {ticket.is_paid && (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        {onDeleteTicket && (
                                            <button
                                                onClick={() => onDeleteTicket(ticket.id)}
                                                className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                                                title="Delete Ticket"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-12 bg-slate-50 dark:bg-slate-900/40">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <p className="text-xl font-bold text-slate-600 dark:text-slate-300">No Intakes On {formattedDateHeader}</p>
                    <p className="text-sm mt-1 text-slate-400">Select another date above or click Today to return to today's check-ins.</p>
                    {selectedDate !== todayStr && (
                        <button
                            onClick={() => setSelectedDate(todayStr)}
                            className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-bold rounded-xl transition-colors"
                        >
                            Return to Today's Intakes
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default TodayTicketsList;
