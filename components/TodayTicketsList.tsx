import React, { useMemo } from 'react';
import type { FullRepairTicket } from '../types';

interface TodayTicketsListProps {
    tickets: FullRepairTicket[];
    onTicketClick: (ticket: FullRepairTicket) => void;
    onTogglePaid: (ticketId: string, isPaid: boolean) => Promise<void>;
    onTicketStatusChange: (ticketId: string, newStatus: string) => Promise<void>;
}

const TodayTicketsList: React.FC<TodayTicketsListProps> = ({ tickets, onTicketClick, onTogglePaid, onTicketStatusChange }) => {
    const todaysTickets = useMemo(() => {
        // Get completely local current day string (ignoring timezones)
        const todayStr = new Date().toLocaleDateString('en-CA'); // format: YYYY-MM-DD

        return tickets.filter(t => {
            if (!t.created_at) return false;
            // created_at usually looks like 2026-03-05T...
            return t.created_at.startsWith(todayStr) || new Date(t.created_at).toLocaleDateString('en-CA') === todayStr;
        });
    }, [tickets]);

    return (
        <div className="bg-white rounded-2xl animate-in fade-in slide-in-from-bottom-4">
            {todaysTickets.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-sm uppercase tracking-wider font-bold">
                                <th className="p-4">Customer</th>
                                <th className="p-4">Device / Issue</th>
                                <th className="p-4 hidden sm:table-cell">Status</th>
                                <th className="p-4 hidden md:table-cell text-right">Quote</th>
                                <th className="p-4 text-center">Paid</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {todaysTickets.map(ticket => (
                                <tr
                                    key={ticket.id}
                                    className="hover:bg-slate-50 transition-colors group"
                                >
                                    <td className="p-4 cursor-pointer" onClick={() => onTicketClick(ticket)}>
                                        <p className="font-bold text-slate-800">{ticket.customer.name}</p>
                                        <p className="text-xs text-slate-500">{new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </td>
                                    <td className="p-4 cursor-pointer" onClick={() => onTicketClick(ticket)}>
                                        <p className="font-bold text-slate-700">{ticket.device}</p>
                                        <p className="text-sm text-slate-500 truncate max-w-[200px] lg:max-w-xs" title={ticket.problem_description}>{ticket.problem_description}</p>
                                    </td>
                                    <td className="p-4 hidden sm:table-cell">
                                        <select
                                            className="bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2"
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
                                    <td className="p-4 hidden md:table-cell text-right text-slate-700 font-medium cursor-pointer" onClick={() => onTicketClick(ticket)}>
                                        {ticket.estimated_cost || 'TBD'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => onTogglePaid(ticket.id, !ticket.is_paid)}
                                            className={`inline-flex items-center justify-center w-8 h-8 rounded border-2 transition-all ${ticket.is_paid
                                                ? 'bg-green-500 border-green-500'
                                                : 'bg-white border-slate-300 hover:border-green-400'
                                                }`}
                                            title={ticket.is_paid ? 'Mark Unpaid' : 'Mark Paid'}
                                        >
                                            {ticket.is_paid && (
                                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-12 bg-slate-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <p className="text-xl font-bold text-slate-500">No Tickets Yet Today</p>
                    <p className="text-sm mt-2">New check-ins will appear here.</p>
                </div>
            )}
        </div>
    );
};
export default TodayTicketsList;
