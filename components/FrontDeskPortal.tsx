import React, { useState, useMemo, useDeferredValue } from 'react';
import type { Customer, RepairTicket, FullRepairTicket } from '../types';

interface FrontDeskPortalProps {
  customers: Customer[];
  tickets: RepairTicket[];
  currentLocation: string;
  selectedCustomerId: string | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onSaveCustomer: (customerData: Partial<Omit<Customer, 'id' | 'created_at'>>) => void;
  onStartNewTicket: (customer: Customer) => void;
  onViewTicket: (ticket: FullRepairTicket) => void;
  onUpdateTicketStatus: (ticketId: string, status: string) => void;
  onMarkAsPaid: (ticketId: string, isPaid: boolean) => void;
  onOpenSMSInbox: () => void;
  onOpenKanban: () => void;
  onOpenTodayList: () => void;
  onOpenAnalytics?: () => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onDeleteTicket?: (id: string) => void;
}

export const FrontDeskPortal: React.FC<FrontDeskPortalProps> = ({
  customers,
  tickets,
  currentLocation,
  selectedCustomerId,
  onSelectCustomer,
  onSaveCustomer,
  onStartNewTicket,
  onViewTicket,
  onUpdateTicketStatus,
  onMarkAsPaid,
  onOpenSMSInbox,
  onOpenKanban,
  onOpenTodayList,
  onOpenAnalytics,
  onEditCustomer,
  onDeleteCustomer,
  onDeleteTicket
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'active_tickets'>('all');
  const [displayLimit, setDisplayLimit] = useState(35);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // Quick Customer Intake Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustLocation, setNewCustLocation] = useState<string>(currentLocation || 'Beaumont');
  const [newCustConsent, setNewCustConsent] = useState(true);
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);

  // Active Customer Object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Tickets for selected customer
  const customerTickets = useMemo(() => {
    if (!selectedCustomer) return [];
    return tickets.filter(t => t.customer_id === selectedCustomer.id);
  }, [tickets, selectedCustomer]);

  // Today's tickets count
  const todayTickets = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return tickets.filter(t => t.created_at && t.created_at.startsWith(todayStr));
  }, [tickets]);

  // Active tickets in shop count
  const activeTicketsCount = useMemo(() => {
    return tickets.filter(t => (t.status || 'In Queue') !== 'Completed' && (t.status || '') !== 'Delivered').length;
  }, [tickets]);

  // Filtered customer list for search and directory
  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (deferredQuery.trim()) {
      const q = deferredQuery.trim().toLowerCase();
      const qDigits = deferredQuery.replace(/\D/g, '');

      list = list.filter(c => {
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const phoneDigits = (c.phone || '').replace(/\D/g, '');
        const phoneMatch = qDigits ? phoneDigits.includes(qDigits) : false;
        const emailMatch = (c.email || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || emailMatch;
      });
    }

    if (filterMode === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      list = list.filter(c => c.created_at && c.created_at.startsWith(todayStr));
    } else if (filterMode === 'active_tickets') {
      const customerIdsWithActiveTickets = new Set(
        tickets.filter(t => (t.status || 'In Queue') !== 'Completed').map(t => t.customer_id)
      );
      list = list.filter(c => customerIdsWithActiveTickets.has(c.id));
    }

    return list;
  }, [customers, tickets, deferredQuery, filterMode]);

  const visibleCustomers = useMemo(() => {
    return filteredCustomers.slice(0, displayLimit);
  }, [filteredCustomers, displayLimit]);

  // Handle Quick Intake Form Submit
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      alert("Please enter both Name and Phone Number.");
      return;
    }

    setIsSubmittingCust(true);
    try {
      await onSaveCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim() || undefined,
        location: newCustLocation as any,
        marketing_sms_consent: newCustConsent,
        transactional_sms_consent: true,
        consent_source: 'manual',
        consent_method: 'checkbox'
      });

      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setShowQuickAddModal(false);
    } catch (err: any) {
      alert(`Error saving customer: ${err.message || 'Please try again'}`);
    } finally {
      setIsSubmittingCust(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Front Desk Header & Stats Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 rounded-3xl p-6 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="px-3 py-1 bg-red-600/80 backdrop-blur-md text-white font-black text-xs uppercase tracking-wider rounded-full shadow-sm">
                Front Desk Reception
              </span>
              <span className="text-slate-400 text-xs font-semibold">
                {currentLocation} Location Workstation
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Customer Intake & Lookup Portal</h1>
            <p className="text-slate-300 text-sm mt-1">
              Search existing customers, register new walk-ins, and draft repair tickets instantly.
            </p>
          </div>

          {/* Quick Action Metrics */}
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Today's Intake</span>
              <span className="text-xl font-black text-white">{todayTickets.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Active Queue</span>
              <span className="text-xl font-black text-emerald-400">{activeTicketsCount}</span>
            </div>
            
            <div className="flex flex-col gap-1.5 border-l border-white/20 pl-3 ml-1">
              <button
                onClick={onOpenSMSInbox}
                className="px-3 py-1 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all text-left flex items-center gap-1.5 shadow-sm"
              >
                📢 Campaigns & Messaging
              </button>
              <button
                onClick={onOpenKanban}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all text-left flex items-center gap-1.5"
              >
                📊 Kanban View
              </button>
              <button
                onClick={onOpenTodayList}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all text-left flex items-center gap-1.5"
              >
                📋 Today List
              </button>
              {onOpenAnalytics && (
                <button
                  onClick={onOpenAnalytics}
                  className="px-3 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all text-left flex items-center gap-1.5 shadow-sm"
                >
                  📈 Analytics
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hero Customer Search Bar */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="🔍 Search customer by Name, Phone Number, or Email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white/95 text-slate-900 placeholder-slate-400 rounded-2xl font-bold text-base shadow-inner focus:outline-none focus:ring-4 focus:ring-red-500/50"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-700 font-bold text-sm bg-slate-200 hover:bg-slate-300 w-6 h-6 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => setShowQuickAddModal(true)}
            className="px-6 py-3.5 bg-gradient-to-r from-red-600 to-emerald-600 hover:from-red-700 hover:to-emerald-700 text-white font-extrabold rounded-2xl shadow-lg hover:shadow-xl transition-all text-base flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            + New Customer Intake
          </button>
        </div>
      </div>

      {/* Main Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Customer Directory & Search Results */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col h-[calc(100vh-16rem)]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Customer Directory</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{filteredCustomers.length} customer records found</p>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${filterMode === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('active_tickets')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${filterMode === 'active_tickets' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
              >
                In Shop
              </button>
            </div>
          </div>

          {/* Customer Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 mt-2 pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">No customers matched your search.</p>
                <button
                  onClick={() => {
                    setNewCustName(searchQuery);
                    setShowQuickAddModal(true);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  + Add "{searchQuery}" as New Customer
                </button>
              </div>
            ) : (
              <>
                {visibleCustomers.map(customer => {
                  const isSelected = selectedCustomerId === customer.id;
                  const custActiveTickets = tickets.filter(t => t.customer_id === customer.id && (t.status || 'In Queue') !== 'Completed');

                  return (
                    <button
                      key={customer.id}
                      onClick={() => onSelectCustomer(customer)}
                      className={`w-full p-3.5 text-left rounded-2xl transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-red-50 dark:bg-slate-700 border-2 border-red-500 shadow-sm'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                            {customer.name}
                          </span>
                          {customer.location && (
                            <span className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                              {customer.location}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          <span>{customer.phone}</span>
                          {customer.email && <span className="truncate">• {customer.email}</span>}
                        </div>

                        {custActiveTickets.length > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold rounded-md flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              {custActiveTickets.length} Active Device in Shop ({custActiveTickets[0].device})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                          ➔
                        </span>
                      </div>
                    </button>
                  );
                })}

                {filteredCustomers.length > visibleCustomers.length && (
                  <div className="p-3 text-center">
                    <button
                      onClick={() => setDisplayLimit(prev => prev + 50)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
                    >
                      Show More Customers ({filteredCustomers.length - visibleCustomers.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Customer Workstation Command Center */}
        <div className="lg:col-span-7 space-y-6">
          {selectedCustomer ? (
            /* Selected Customer Command Card */
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 space-y-6 animate-in fade-in-50 duration-200">
              
              {/* Customer Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedCustomer.name}</h2>
                    {selectedCustomer.location && (
                      <span className="px-2.5 py-1 bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 rounded-full text-xs font-black">
                        {selectedCustomer.location} Location
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <span className="font-mono">📞 {selectedCustomer.phone}</span>
                    {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                  </div>
                </div>

                {/* Primary Intake Button for selected customer */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onStartNewTicket(selectedCustomer)}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg hover:shadow-xl transition-all text-sm flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    + Create Repair Ticket
                  </button>

                  <button
                    onClick={() => onEditCustomer(selectedCustomer)}
                    className="px-3.5 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors text-sm"
                    title="Edit Customer Details"
                  >
                    ✏️ Edit
                  </button>

                  {onDeleteCustomer && (
                    <button
                      onClick={() => onDeleteCustomer(selectedCustomer.id)}
                      className="px-3.5 py-3 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 font-bold rounded-2xl transition-colors text-sm flex items-center gap-1"
                      title="Delete Customer"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Customer's Repair Tickets & History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    Customer Repair Tickets ({customerTickets.length})
                  </h4>
                  <button
                    onClick={() => onStartNewTicket(selectedCustomer)}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    + Add Device Repair
                  </button>
                </div>

                {customerTickets.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-2xl text-center border border-dashed border-slate-300 dark:border-slate-600 space-y-2">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No repair tickets created for this customer yet.</p>
                    <button
                      onClick={() => onStartNewTicket(selectedCustomer)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                    >
                      + Create First Ticket Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerTickets.map(ticket => {
                      const isCompleted = ticket.status === 'Completed' || ticket.status === 'Delivered';
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => onViewTicket(ticket as any)}
                          className="p-4 bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl border border-slate-200 dark:border-slate-600 transition-all cursor-pointer flex items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white text-base">
                                {ticket.device}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                                isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {ticket.status || 'In Queue'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1">
                              Issue: {ticket.issue_description || 'General Repair'}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                              <span>Ticket #{ticket.ticket_number || ticket.id.slice(0, 8)}</span>
                              <span>Date: {new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="font-black text-slate-900 dark:text-white text-lg">
                              ${ticket.total_price || '0.00'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                ticket.is_paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {ticket.is_paid ? 'Paid' : 'Unpaid'}
                              </span>
                              {onDeleteTicket && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTicket(ticket.id);
                                  }}
                                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 px-2 py-0.5 rounded-md transition-colors"
                                  title="Delete Ticket"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Default Welcome Workstation Card (Fast Intake Form) */
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Quick Front-Desk Customer Intake</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Register walk-in customers instantly to generate new repair tickets.</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-full text-xs font-black">
                  Walk-In Express
                </span>
              </div>

              <form onSubmit={handleQuickAddSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Marcus Johnson"
                      value={newCustName}
                      onChange={e => setNewCustName(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="(409) 555-0199"
                      value={newCustPhone}
                      onChange={e => setNewCustPhone(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="customer@email.com"
                      value={newCustEmail}
                      onChange={e => setNewCustEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Store Location</label>
                    <select
                      value={newCustLocation}
                      onChange={e => setNewCustLocation(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                    >
                      <option value="Beaumont">Beaumont</option>
                      <option value="Houston">Houston</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCustConsent}
                      onChange={e => setNewCustConsent(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span>Opt-In customer for SMS Repair updates & offers</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingCust}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg hover:shadow-xl transition-all text-sm flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Save & Select Customer
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Register New Customer</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add walk-in customer details to start a repair ticket.</p>
              </div>
              <button
                onClick={() => setShowQuickAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Johnson"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="(409) 555-0199"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={newCustEmail}
                  onChange={e => setNewCustEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Store Location</label>
                <select
                  value={newCustLocation}
                  onChange={e => setNewCustLocation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                >
                  <option value="Beaumont">Beaumont</option>
                  <option value="Houston">Houston</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCust}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all text-xs"
                >
                  Save & Select Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
