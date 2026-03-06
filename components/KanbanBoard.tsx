import React, { useState } from 'react';
import type { FullRepairTicket } from '../types';

interface KanbanBoardProps {
    tickets: FullRepairTicket[];
    onTicketStatusChange: (ticketId: string, newStatus: string) => Promise<void>;
    onTicketClick: (ticket: FullRepairTicket) => void;
    onTogglePaid: (ticketId: string, isPaid: boolean) => Promise<void>;
}

const STATUSES = ['In Queue', 'Diagnosing', 'Waiting on Parts', 'Repairing', 'Ready for Pickup', 'Completed'];

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tickets, onTicketStatusChange, onTicketClick, onTogglePaid }) => {
    const [draggedTicket, setDraggedTicket] = useState<string | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

    const getTicketsByStatus = (status: string) => {
        return tickets.filter(t => (t.status || 'In Queue') === status);
    };

    const handleDragStart = (e: React.DragEvent, ticketId: string) => {
        e.dataTransfer.setData('text/plain', ticketId);
        setDraggedTicket(ticketId);
    };

    const handleDragOver = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        if (draggedTicket) {
            setDragOverStatus(status);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverStatus(null);
    };

    const handleDrop = async (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const ticketId = e.dataTransfer.getData('text/plain');
        setDraggedTicket(null);
        setDragOverStatus(null);

        if (ticketId) {
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket && (ticket.status || 'In Queue') !== status) {
                await onTicketStatusChange(ticketId, status);
            }
        }
    };

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-4 px-4 custom-scrollbar min-h-[500px]">
            {STATUSES.map(status => (
                <div
                    key={status}
                    className={`flex-shrink-0 w-80 bg-slate-100/50 rounded-2xl flex flex-col p-3 border-2 transition-colors ${dragOverStatus === status ? 'border-sky-400 bg-sky-50' : 'border-transparent'
                        }`}
                    onDragOver={(e) => handleDragOver(e, status)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, status)}
                >
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="font-bold text-slate-700">{status}</h3>
                        <span className="bg-white text-slate-500 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                            {getTicketsByStatus(status).length}
                        </span>
                    </div>

                    <div className="flex-1 space-y-3 min-h-[100px]">
                        {getTicketsByStatus(status).map(ticket => (
                            <div
                                key={ticket.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, ticket.id)}
                                onDragEnd={() => { setDraggedTicket(null); setDragOverStatus(null); }}
                                onClick={() => onTicketClick(ticket)}
                                className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${draggedTicket === ticket.id ? 'opacity-50' : 'opacity-100'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2 group">
                                    <p className="font-bold text-slate-800 text-sm truncate pr-2">{ticket.device}</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // prevent opening the ticket modal
                                            onTogglePaid(ticket.id, !ticket.is_paid);
                                        }}
                                        className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded border-2 transition-all ${ticket.is_paid
                                                ? 'bg-green-500 border-green-500'
                                                : 'bg-white border-slate-300 hover:border-green-400'
                                            }`}
                                        title={ticket.is_paid ? 'Mark Unpaid' : 'Mark Paid'}
                                    >
                                        {ticket.is_paid && (
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mb-3 truncate">{ticket.customer.name}</p>
                                <div className="flex justify-between items-center text-xs text-slate-400">
                                    <span>#{ticket.id.substring(0, 6)}</span>
                                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                        {getTicketsByStatus(status).length === 0 && (
                            <div className="h-full border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-sm py-8 bg-white/50">
                                Drop tickets here
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default KanbanBoard;
