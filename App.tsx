
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Customer, RepairTicket, View, FullRepairTicket, Quote, Appointment, ShopSettings } from './types';
import { supabase } from './supabaseClient';
import CustomerList from './components/CustomerList';
import CustomerForm from './components/CustomerForm';
import TicketForm from './components/TicketForm';
import TicketView from './components/TicketView';
import KanbanBoard from './components/KanbanBoard';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import KioskView from './components/KioskView';
import KioskLogin from './components/KioskLogin';
import AppointmentList from './components/AppointmentList';
import SettingsView from './components/SettingsView';
import CustomersTableView from './components/CustomersTableView';
import TodayTicketsList from './components/TodayTicketsList';
import { useLocalStorage } from './hooks/useLocalStorage';
import { REPAIR_PRICES } from './constants/prices';

const DEFAULT_SETTINGS: ShopSettings = {
  businessName: 'Elite Phone Repair',
  address: '2215 Calder Ave STE 201, Beaumont, TX 77701',
  phone: '(409) 123-4567',
  warrantyTerms: 'Thank you for your business! Please keep this ticket for your records. A technician will contact you shortly with an update.',
  kioskPassword: '1271'
};

const App: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [activeTicket, setActiveTicket] = useState<FullRepairTicket | null>(null);

  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'kiosk') return 'kiosk';
      if (params.get('view') === 'settings' || params.get('state') === 'settings') return 'settings';
      const saved = window.localStorage.getItem('elite_kiosk_active');
      if (saved === 'true') return 'kiosk';
    }
    return 'dashboard';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (view === 'kiosk') {
        window.localStorage.setItem('elite_kiosk_active', 'true');
      } else {
        window.localStorage.removeItem('elite_kiosk_active');
      }
    }
  }, [view]);

  const [edgeSmsStatus, setEdgeSmsStatus] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useLocalStorage<string>('elite_location', 'Beaumont');
  const [settings, setSettings] = useLocalStorage<ShopSettings>('elite_shop_settings', DEFAULT_SETTINGS);

  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>('elite_dark_mode', false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const selectedCustomer = useMemo(() =>
    customers.find(c => c.id === selectedCustomerId) || null
    , [customers, selectedCustomerId]);

  const fetchData = useCallback(async () => {
    try {
      let allCustomers: Customer[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('location', currentLocation)
          .order('created_at', { ascending: false })
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data) break;
        allCustomers = [...allCustomers, ...data];
        if (data.length < 1000) hasMore = false;
        page++;
      }
      setCustomers(allCustomers);

      let allTickets: RepairTicket[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, customer:customers(*)')
          .eq('location', currentLocation)
          .order('created_at', { ascending: false })
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data) break;
        allTickets = [...allTickets, ...data as any];
        if (data.length < 1000) hasMore = false;
        page++;
      }
      setTickets(allTickets as any);

      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('*')
        .eq('location', currentLocation)
        .order('date', { ascending: true });
      if (appointmentData) setAppointments(appointmentData);
    } catch (e) {
      console.error("Data fetch error:", e);
    }
  }, [currentLocation]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('db-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleSaveCustomer = async (customerData: Partial<Omit<Customer, 'id' | 'created_at'>>) => {
    const now = new Date().toISOString();
    const payload: any = { ...customerData, location: currentLocation };

    // Ensure timestamps are set if consent is granted
    if (customerData.marketing_sms_consent) {
      payload.marketing_sms_consent_at = now;
    }
    if (customerData.transactional_sms_consent) {
      payload.transactional_sms_consent_at = now;
    }

    let result;
    if (customerToEdit) {
      result = await supabase.from('customers').update(payload).eq('id', customerToEdit.id).select().single();
    } else {
      result = await supabase.from('customers').insert([payload]).select().single();
    }

    if (result.error) {
      alert(result.error.message);
    } else {
      fetchData();
      setView('dashboard');
      setCustomerToEdit(null);
    }
  };

  const handleCreateTicket = async (ticketData: Omit<RepairTicket, 'id' | 'customer_id' | 'created_at' | 'location'>) => {
    if (!selectedCustomer) return;
    const payload = {
      ...ticketData,
      customer_id: selectedCustomer.id,
      location: currentLocation
    };

    const { data, error } = await supabase.from('tickets').insert([payload]).select('*, customer:customers(*)').single();

    if (error) {
      alert(error.message);
    } else if (data) {
      fetchData();
      setActiveTicket(data as any);
      setView('view_ticket');
    }
  };

  const handleUpdateTicket = async (ticketData: Partial<RepairTicket>) => {
    if (!activeTicket) return;

    // Safety: remove relational fields before update
    const { customer, id, created_at, location, ...updateFields } = ticketData as any;

    const { data, error } = await supabase
      .from('tickets')
      .update(updateFields)
      .eq('id', activeTicket.id)
      .select('*, customer:customers(*)')
      .single();

    if (error) {
      alert(error.message);
    } else if (data) {
      fetchData();
      setActiveTicket(data as any);
      setView('view_ticket');
    }
  };

  const handleMarkAsPaid = async (ticketId: string, isPaid: boolean) => {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .update({ is_paid: isPaid })
      .eq('id', ticketId)
      .select('*, customer:customers(*)')
      .single();

    if (error) {
      alert(error.message);
    } else if (ticket) {
      fetchData();
      if (activeTicket?.id === ticketId) {
        setActiveTicket(ticket as any);
      }
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', ticketId);

    if (error) {
      alert(error.message);
    } else {
      fetchData();
    }
  };

  const handleKioskCheckIn = async (data: any) => {
    try {
      let customerId: string;
      const normalizedPhone = data.phone.replace(/\\D/g, ""); // Strip non-numeric for robust matching

      // Find by phone (handling duplicates safely bypassing 1000 row limit using ilike)
      const likePattern = `%${normalizedPhone.split('').join('%')}%`;
      const { data: existing } = await supabase
        .from('customers')
        .select('id, phone')
        .eq('location', currentLocation)
        .ilike('phone', likePattern)
        .then(res => {
          if (res.data) {
            // Find one where the digits match exactly from candidates
            const match = res.data.find(c => c.phone && c.phone.replace(/\\D/g, "") === normalizedPhone);
            return { data: match || null };
          }
          return res;
        });

      if (existing) {
        // 'existing' could be an array if maybeSingle didn't limit it to 1 initially, but our promise strictly returns a single object
        customerId = (existing as any).id;
        const now = new Date().toISOString();
        const updatePayload: any = {
          name: data.name,
          email: data.email || null,
          alt_phone: data.callBackNumber || null,
          marketing_sms_consent: data.promotionalConsent,
          transactional_sms_consent: data.transactionalConsent,
          consent_source: 'iPad',
          consent_method: 'checkbox',
          consent_ip: data.consent_ip,
          consent_form_version: data.consent_form_version
        };

        if (data.promotionalConsent) {
          updatePayload.marketing_sms_consent_at = now;
        }
        if (data.transactionalConsent) {
          updatePayload.transactional_sms_consent_at = now;
        }

        try {
          await supabase.from('customers').update(updatePayload).eq('id', customerId);
        } catch (updateError) {
          console.error("Non-fatal Customer update error (proceeding to ticket creation):", updateError);
        }
      } else {
        const now = new Date().toISOString();
        const insertData: any = {
          name: data.name,
          phone: data.phone, // Store original format inputted
          email: data.email || null,
          alt_phone: data.callBackNumber || null,
          location: currentLocation,
          marketing_sms_consent: data.promotionalConsent,
          transactional_sms_consent: data.transactionalConsent,
          consent_source: 'iPad',
          consent_method: 'checkbox',
          consent_ip: data.consent_ip,
          consent_form_version: data.consent_form_version
        };

        if (data.promotionalConsent) {
          insertData.marketing_sms_consent_at = now;
        }
        if (data.transactionalConsent) {
          insertData.transactional_sms_consent_at = now;
        }

        const { data: created, error } = await supabase.from('customers').insert([insertData]).select().single();

        if (error || !created) {
          console.error("Customer creation error:", error);
          return false;
        }
        customerId = created.id;
      }

      // Calculate automated price quote
      const estimatedCost = (data.deviceBrand && data.deviceModel && data.repairCategory)
        ? REPAIR_PRICES[data.deviceBrand]?.[data.deviceModel]?.[data.repairCategory] || null
        : null;

      const { error: ticketError } = await supabase.from('tickets').insert([{
        customer_id: customerId,
        device: data.device,
        problem_description: data.problemDescription,
        heard_from: data.heardFrom,
        location: currentLocation,
        repair_type: data.repairCategory || null,
        estimated_cost: estimatedCost
      }]);

      if (ticketError) {
        console.error("Ticket creation error:", ticketError);
        return false;
      }

      fetchData();
      return true;
    } catch (e) {
      console.error("Kiosk check-in exception:", e);
      return false;
    }
  };

  const handleTestEdgeSms = async () => {
    setEdgeSmsStatus('Sending...');
    // @ts-ignore - accessing internal property for logging as requested
    const supabaseUrl = supabase.supabaseUrl || (supabase as any).auth?.url?.replace('/auth/v1', '') || 'https://tbcvbxvqicowjtbggkfa.supabase.co';
    console.log('SUPABASE_URL', supabaseUrl);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          customer_id: selectedCustomer?.id || '00000000-0000-0000-0000-000000000000',
          message_type: 'transactional',
          content: 'Twilio Edge function test from CRM UI',
          ticket_id: null
        }
      });

      console.log("send-sms data:", data);
      console.log("send-sms error:", error);
      console.log("send-sms error context:", (error as any)?.context);

      if (error && (error as any).context) {
        const res = (error as any).context as Response;
        // Read body safely (Response can only be read once)
        const bodyText = await res.clone().text();
        console.log("send-sms status:", res.status);
        console.log("send-sms response body:", bodyText);
      }

      if (error) {
        setEdgeSmsStatus('Error');
      } else {
        setEdgeSmsStatus('Success');
      }
    } catch (err) {
      console.error('EDGE FUNCTION EXCEPTION:', err);
      setEdgeSmsStatus('Error');
    }

    setTimeout(() => setEdgeSmsStatus(null), 3000);
  };

  const renderContent = () => {
    // Kiosk views are full-screen and don't show the standard header/footer layout
    if (view === 'kiosk') {
      return <KioskView
        onCheckIn={handleKioskCheckIn}
        onExitKiosk={() => setView('dashboard')}
        kioskPassword={settings.kioskPassword}
      />;
    }
    if (view === 'kiosk_login') {
      return <KioskLogin
        onLogin={() => setView('kiosk')}
        correctPassword={settings.kioskPassword}
      />;
    }
    if (view === 'customers_dashboard') {
      return <CustomersTableView
        customers={customers}
        onSelectCustomer={(id) => {
          setSelectedCustomerId(id);
          setView('dashboard');
        }}
        onAddNew={() => {
          setCustomerToEdit(null);
          setView('add_customer');
        }}
      />;
    }

    switch (view) {
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <CustomerList
                customers={customers}
                selectedCustomerId={selectedCustomerId || undefined}
                onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
                onAddNew={() => {
                  setCustomerToEdit(null);
                  setView('add_customer');
                }}
                onImportData={() => { }}
                onExportData={() => { }}
                onDeleteCustomer={async (id) => {
                  if (confirm("Delete this customer?")) {
                    await supabase.from('customers').delete().eq('id', id);
                    fetchData();
                  }
                }}
              />
            </div>
            <div className="lg:col-span-2 space-y-6">
              {selectedCustomer ? (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800">{selectedCustomer.name}</h2>
                      <p className="text-slate-500">{selectedCustomer.phone}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={handleTestEdgeSms}
                          className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-200 border border-amber-200"
                        >
                          Test Edge SMS
                        </button>
                        {edgeSmsStatus && (
                          <span className={`text-[10px] font-bold uppercase ${edgeSmsStatus === 'Sending...' ? 'text-slate-500' :
                            edgeSmsStatus === 'Success' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {edgeSmsStatus}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setCustomerToEdit(selectedCustomer);
                          setView('edit_customer');
                        }}
                        className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200"
                      >
                        Edit Profile
                      </button>
                      <button
                        onClick={() => setView('new_ticket')}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 shadow-md"
                      >
                        New Ticket
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Repair History
                  </h3>
                  <div className="space-y-3">
                    {tickets.filter(t => t.customer_id === selectedCustomer.id).map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => {
                          setActiveTicket(ticket as any);
                          setView('view_ticket');
                        }}
                        className="flex justify-between items-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{ticket.device}</p>
                          <p className="text-sm text-slate-500">{new Date(ticket.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold mr-2 border border-slate-200`}>
                            {ticket.status || 'In Queue'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${ticket.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {ticket.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                    {tickets.filter(t => t.customer_id === selectedCustomer.id).length === 0 && (
                      <p className="text-slate-400 italic py-4">No repair history found.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Shop Dashboard</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setView('dashboard')}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold shadow-sm"
                      >
                        Kanban View
                      </button>
                      <button
                        onClick={() => setView('dashboard_list')}
                        className="px-4 py-2 bg-slate-50 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-100"
                      >
                        Today's List
                      </button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold text-sm">Total Active: {tickets.filter(t => (t.status || 'In Queue') !== 'Completed').length}</span>
                  </div>
                  <KanbanBoard
                    tickets={tickets as any}
                    onTicketStatusChange={handleUpdateTicketStatus}
                    onTicketClick={(ticket) => {
                      setActiveTicket(ticket);
                      setView('view_ticket');
                    }}
                    onTogglePaid={handleMarkAsPaid}
                  />
                </div>
              )}
            </div>
          </div>
        );
      case 'dashboard_list':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <CustomerList
                customers={customers}
                selectedCustomerId={selectedCustomerId || undefined}
                onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
                onAddNew={() => {
                  setCustomerToEdit(null);
                  setView('add_customer');
                }}
                onImportData={() => { }}
                onExportData={() => { }}
                onDeleteCustomer={async (id) => {
                  if (confirm("Delete this customer?")) {
                    await supabase.from('customers').delete().eq('id', id);
                    fetchData();
                  }
                }}
              />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">Shop Dashboard</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setView('dashboard')}
                      className="px-4 py-2 bg-slate-50 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-100"
                    >
                      Kanban View
                    </button>
                    <button
                      onClick={() => setView('dashboard_list')}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold shadow-sm"
                    >
                      Today's List
                    </button>
                  </div>
                </div>
                <TodayTicketsList
                  tickets={tickets as any}
                  onTicketClick={(ticket) => {
                    setActiveTicket(ticket);
                    setView('view_ticket');
                  }}
                  onTogglePaid={handleMarkAsPaid}
                  onTicketStatusChange={handleUpdateTicketStatus}
                />
              </div>
            </div>
          </div>
        );
      case 'add_customer':
      case 'edit_customer':
        return <CustomerForm
          onSave={handleSaveCustomer}
          onCancel={() => setView('dashboard')}
          initialData={customerToEdit || undefined}
        />;
      case 'new_ticket':
        return selectedCustomer ? <TicketForm
          customer={selectedCustomer}
          onSubmit={handleCreateTicket}
          onCancel={() => setView('dashboard')}
        /> : null;
      case 'edit_ticket':
        return activeTicket ? <TicketForm
          customer={activeTicket.customer}
          onSubmit={handleUpdateTicket}
          onCancel={() => setView('view_ticket')}
          initialData={activeTicket}
        /> : null;
      case 'view_ticket':
        return activeTicket ? <TicketView
          ticket={activeTicket}
          shopSettings={settings}
          onClose={() => setView('dashboard')}
          onEdit={() => setView('edit_ticket')}
          onTogglePaid={handleMarkAsPaid}
        /> : null;
      case 'appointments_dashboard':
        return <AppointmentList
          appointments={appointments}
          onUpdateStatus={async (id, status) => { await supabase.from('appointments').update({ status }).eq('id', id); fetchData(); }}
          onConvertToTicket={async () => { alert("Select customer in dashboard."); setView('dashboard'); }}
          onUpdateAppointment={async (appt) => { await supabase.from('appointments').update(appt).eq('id', appt.id); fetchData(); }}
          onDeleteAppointment={async (id) => { await supabase.from('appointments').delete().eq('id', id); fetchData(); }}
        />;
      case 'settings':
        return <SettingsView
          settings={settings}
          currentLocation={currentLocation}
          onSaveSettings={setSettings}
          onBack={() => setView('dashboard')}
        />;
      default:
        return <div className="p-8 text-center text-slate-500">View implementation coming soon...</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900">
      {view !== 'kiosk' && view !== 'kiosk_login' && (
        <Header
          onLogoClick={() => setView('dashboard')}
          onGoToKiosk={() => setView('kiosk_login')}
          onGoToCustomers={() => setView('customers_dashboard')}
          onGoToAppointments={() => setView('appointments_dashboard')}
          onGoToSettings={() => setView('settings')}
          currentLocation={currentLocation}
          onLocationChange={setCurrentLocation}
          businessName={settings.businessName}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
      )}
      <main className={`flex-grow ${view === 'kiosk' || view === 'kiosk_login' ? 'flex items-center justify-center bg-slate-900 min-h-screen' : 'container mx-auto px-4 py-8'}`}>
        {renderContent()}
      </main>
      {view !== 'kiosk' && view !== 'kiosk_login' && <Footer businessName={settings.businessName} />}
    </div>
  );
};

export default App;
