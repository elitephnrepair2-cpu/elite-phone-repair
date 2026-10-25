
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import type { Customer, RepairTicket, View, FullRepairTicket, Quote, Appointment, ShopSettings, PartsOrder } from './types';
import { supabase } from './supabaseClient';
const CustomerList = lazy(() => import('./components/CustomerList'));
const CustomerForm = lazy(() => import('./components/CustomerForm'));
const TicketForm = lazy(() => import('./components/TicketForm'));
const TicketView = lazy(() => import('./components/TicketView'));
const KanbanBoard = lazy(() => import('./components/KanbanBoard'));
import { Header } from './components/Header';
import { Footer } from './components/Footer';
const KioskView = lazy(() => import('./components/KioskView'));
const KioskLogin = lazy(() => import('./components/KioskLogin'));
const AppointmentList = lazy(() => import('./components/AppointmentList'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const CustomersTableView = lazy(() => import('./components/CustomersTableView'));
const TodayTicketsList = lazy(() => import('./components/TodayTicketsList'));
const PartsDashboard = lazy(() => import('./components/PartsDashboard'));
const InstantQuoteWidget = lazy(() => import('./components/InstantQuoteWidget'));
const CampaignsView = lazy(() => import('./components/CampaignsView'));
import { FrontDeskPortal } from './components/FrontDeskPortal';
const AnalyticsView = lazy(() => import('./components/AnalyticsView').then(module => ({default:module.AnalyticsView})));
const SMSInboxView = lazy(() => import('./components/SMSInboxView').then(module => ({default:module.SMSInboxView})));
const FacebookMessengerInboxView = lazy(() => import('./components/FacebookMessengerInboxView').then(module => ({default:module.FacebookMessengerInboxView})));
const QuoteList = lazy(() => import('./components/QuoteList'));
const QuoteForm = lazy(() => import('./components/QuoteForm'));
import { useLocalStorage } from './hooks/useLocalStorage';
import { REPAIR_PRICES } from './constants/prices';
import { sendSmsIfAllowed } from './services/smsService';
import { scheduleAppointmentSmsSequence, cancelAppointmentSmsJobs, scheduleMissedAppointmentSms } from './services/appointmentSmsService';
import { StaffUser, signOutStaff } from './services/authService';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { ScreenBoundary } from './components/ScreenBoundary';

const DEFAULT_SETTINGS: ShopSettings = {
  businessName: 'Elite Phone Repair',
  address: '2215 Calder Ave STE 201, Beaumont, TX 77701',
  address_houston: 'Houston Store Address',
  phone: '(409) 123-4567',
  warrantyTerms: 'Thank you for your business! Please keep this ticket for your records. A technician will contact you shortly with an update.',
  kioskPassword: '1271',
  analyticsPassword: 'TILEE'
};

const StaffWorkspace: React.FC<{ activeStaff: StaffUser; onSignOut: () => void }> = ({ activeStaff, onSignOut }) => {
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [activeTicket, setActiveTicket] = useState<FullRepairTicket | null>(null);

  // Analytics Protection State
  const [isAnalyticsUnlocked, setIsAnalyticsUnlocked] = useState<boolean>(false);
  const [showAnalyticsAuthModal, setShowAnalyticsAuthModal] = useState<boolean>(false);
  const [analyticsInputPass, setAnalyticsInputPass] = useState<string>('');
  const [analyticsAuthError, setAnalyticsAuthError] = useState<boolean>(false);

  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'kiosk') return 'kiosk';
      if (params.get('view') === 'settings' || params.get('state') === 'settings') return 'settings';
      if (params.get('view') === 'quote_widget') return 'quote_widget';
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
  const [modal, setModal] = useState<{
    type: 'alert' | 'confirm';
    message: string;
    onConfirm?: () => void;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useLocalStorage<string>('elite_location', 'Beaumont');
  const { customers,tickets,appointments,parts_orders:partsOrders,quotes,refreshData:fetchData,loading:dataLoading,error:dataError } = useWorkspaceData(currentLocation,onSignOut);
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

  const showAlert = (message: string) => {
    setModal({ type: 'alert', message });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModal({ type: 'confirm', message, onConfirm });
  };

  const handleOpenAnalytics = () => {
    if (isAnalyticsUnlocked) {
      setView('analytics');
    } else {
      setAnalyticsInputPass('');
      setAnalyticsAuthError(false);
      setShowAnalyticsAuthModal(true);
    }
  };

  const handleUnlockAnalytics = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPass = (settings.analyticsPassword || 'TILEE').trim().toUpperCase();
    if (analyticsInputPass.trim().toUpperCase() === targetPass) {
      setIsAnalyticsUnlocked(true);
      setShowAnalyticsAuthModal(false);
      setAnalyticsAuthError(false);
      setView('analytics');
    } else {
      setAnalyticsAuthError(true);
    }
  };

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
      // Check if a customer with matching phone digits already exists at current location
      const inputDigits = (customerData.phone || '').replace(/\D/g, '');
      let existingCustomer: any = null;

      if (inputDigits.length >= 7) {
        const { data: customersAtLoc } = await supabase
          .from('customers')
          .select('*')
          .eq('location', currentLocation);

        if (customersAtLoc) {
          existingCustomer = customersAtLoc.find(
            (c) => c.phone && c.phone.replace(/\D/g, '') === inputDigits
          );
        }
      }

      if (existingCustomer) {
        // Update existing customer record instead of attempting duplicate insert
        result = await supabase
          .from('customers')
          .update(payload)
          .eq('id', existingCustomer.id)
          .select()
          .single();
        alert(`A customer with phone number ${customerData.phone} already existed. Updated record for ${existingCustomer.name || 'existing customer'}.`);
      } else {
        result = await supabase.from('customers').insert([payload]).select().single();

        // Fallback for duplicate key constraint error "idx_customers_phone_location"
        if (result.error && (result.error.code === '23505' || result.error.message?.includes('idx_customers_phone_location'))) {
          const { data: allCust } = await supabase.from('customers').select('*').eq('location', currentLocation);
          const matched = allCust?.find(c => c.phone && c.phone.replace(/\D/g, '') === inputDigits);
          if (matched) {
            result = await supabase.from('customers').update(payload).eq('id', matched.id).select().single();
            alert(`Updated existing customer record (${matched.name || 'existing customer'}).`);
          }
        }
      }
    }

    if (result.error) {
      alert("Error saving customer: " + result.error.message);
      return null;
    } else {
      fetchData(['customers']);
      setView('dashboard');
      setCustomerToEdit(null);
      return result.data;
    }
  };

  const handleDeleteCustomer = (id: string) => {
    showConfirm("Are you sure you want to delete this customer and all their associated repair tickets?", async () => {
      await supabase.from('sms_consent_events').delete().eq('customer_id', id);
      await supabase.from('tickets').delete().eq('customer_id', id);
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) {
        showAlert("Error deleting customer: " + error.message);
      } else {
        showAlert("Customer deleted successfully.");
        if (selectedCustomerId === id) setSelectedCustomerId(null);
        fetchData(['customers','tickets']);
      }
    });
  };

  const handleDeleteTicket = (id: string) => {
    showConfirm("Are you sure you want to delete this repair ticket?", async () => {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) {
        showAlert("Error deleting ticket: " + error.message);
      } else {
        showAlert("Repair ticket deleted successfully.");
        if (activeTicket?.id === id) {
          setActiveTicket(null);
          setView('dashboard');
        }
        fetchData(['tickets']);
      }
    });
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
      fetchData(['tickets']);
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
      fetchData(['tickets']);
      setActiveTicket(data as any);
      setView('view_ticket');
    }
  };

  const handleMarkAsPaid = async (ticketId: string, isPaid: boolean) => {
    const updatePayload: any = { is_paid: isPaid };
    if (isPaid) {
      updatePayload.status = 'Completed';
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticketId)
      .select('*, customer:customers(*)')
      .single();

    if (error) {
      alert(error.message);
    } else if (ticket) {
      fetchData(['tickets']);
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
      fetchData(['tickets']);
    }
  };

  const handleNotifyCustomer = async (ticket: FullRepairTicket) => {
    const { data: updatedTicket, error } = await supabase
      .from('tickets')
      .update({ status: 'Ready for Pickup' })
      .eq('id', ticket.id)
      .select('*, customer:customers(*)')
      .single();

    if (error) {
      showAlert("Error updating status: " + error.message);
    } else if (updatedTicket) {
      fetchData(['tickets']);
      if (activeTicket?.id === ticket.id) {
        setActiveTicket(updatedTicket as any);
      }

      const smsContent = `Hi ${updatedTicket.customer.name}, your ${updatedTicket.device} is ready for pickup! Total: $${updatedTicket.price || 0}. - ${settings.businessName}`;
      const res = await sendSmsIfAllowed(updatedTicket.customer, 'transactional', smsContent, [updatedTicket]);
      if (res.success) {
        showAlert("Customer notified successfully via SMS!");
      } else {
        showAlert("Status updated, but SMS notification skipped/failed: " + (res.reason || "Unknown reason"));
      }
    }
  };

  const handleKioskCheckIn = async (data: any) => {
    try {
      let customerId: string | undefined;
      const normalizedPhone = data.phone.replace(/\D/g, ""); // Strip non-numeric for robust matching

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
            const match = res.data.find(c => c.phone && c.phone.replace(/\D/g, "") === normalizedPhone);
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

        let { data: created, error } = await supabase.from('customers').insert([insertData]).select().single();

        if (error && (error.code === '23505' || error.message?.includes('idx_customers_phone_location'))) {
          const { data: allCust } = await supabase.from('customers').select('*').eq('location', currentLocation);
          const matched = allCust?.find(c => c.phone && c.phone.replace(/\D/g, '') === normalizedPhone);
          if (matched) {
            await supabase.from('customers').update(insertData).eq('id', matched.id);
            customerId = matched.id;
            error = null;
          }
        } else if (created) {
          customerId = created.id;
        }

        if (error || !customerId) {
          console.error("Customer creation error:", error);
          return false;
        }
      }

      // Calculate automated price quote
      const estimatedCost = (data.deviceBrand && data.deviceModel && data.repairCategory)
        ? REPAIR_PRICES[data.deviceBrand]?.[data.deviceModel]?.[data.repairCategory] || null
        : null;

      const { data: ticket, error: ticketError } = await supabase.from('tickets').insert([{
        customer_id: customerId,
        device: data.device,
        problem_description: data.problemDescription,
        heard_from: data.heardFrom,
        location: currentLocation,
        repair_type: data.repairCategory || null,
        estimated_cost: estimatedCost
      }]).select().single();

      if (ticketError || !ticket) {
        console.error("Ticket creation error:", ticketError);
        return false;
      }

      fetchData(['customers','tickets']);
      return true;
    } catch (e) {
      console.error("Kiosk check-in exception:", e);
      return false;
    }
  };

  const handleTestEdgeSms = async () => {
    if (!selectedCustomer) {
      alert("Please select a customer first.");
      return;
    }
    setEdgeSmsStatus('Sending...');

    try {
      const customerTickets = tickets.filter(t => t.customer_id === selectedCustomer.id);
      const res = await sendSmsIfAllowed(
        selectedCustomer,
        'transactional',
        'Twilio Edge function test from CRM UI',
        customerTickets
      );

      console.log("handleTestEdgeSms routing/send result:", res);

      if (res.success) {
        setEdgeSmsStatus('Success');
      } else {
        console.error("Test SMS skipped/failed:", res.reason);
        setEdgeSmsStatus(res.reason ? 'Blocked' : 'Error');
        alert(res.reason || "SMS failed to send. Check browser console logs.");
      }
    } catch (err) {
      console.error('EDGE FUNCTION EXCEPTION:', err);
      setEdgeSmsStatus('Error');
    }

    setTimeout(() => setEdgeSmsStatus(null), 5000);
  };

  const handleCreateAppointment = async (data: {
    customer_name: string;
    phone: string;
    brand: string;
    model: string;
    issue: string;
    date: string;
    time_window: string;
    location: string;
    status: string;
    sms_reminders_enabled: boolean;
  }) => {
    let customerId: string | null = null;
    const cleanPhone = data.phone.replace(/\D/g, '');

    if (cleanPhone.length >= 10) {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .or(`phone.eq.${cleanPhone},phone.eq.${data.phone}`)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert({
            name: data.customer_name,
            phone: data.phone,
            location: data.location || currentLocation,
            transactional_sms_consent: true,
            consent_source: 'Appointment Scheduling'
          })
          .select('id')
          .maybeSingle();
        if (newCust) customerId = newCust.id;
      }
    }

    const locationAddress = data.location === 'Houston'
      ? (settings.address_houston || 'Houston Location')
      : (settings.address || '2215 Calder Ave STE 201, Beaumont, TX 77701');

    const { data: insertedAppt, error } = await supabase
      .from('appointments')
      .insert({
        ...data,
        location_address: locationAddress,
        version: 1
      })
      .select()
      .single();

    if (error || !insertedAppt) {
      throw new Error(error?.message || "Failed to create appointment.");
    }

    if (data.sms_reminders_enabled) {
      await scheduleAppointmentSmsSequence(insertedAppt, customerId, false);
    }

    await fetchData(['appointments','customers']);
  };

  const handleUpdateAppointmentStatus = async (id: string, newStatus: string) => {
    const now = new Date().toISOString();
    const updatePayload: any = { status: newStatus };
    if (newStatus === 'checked_in' || newStatus === 'arrived') updatePayload.arrived_at = now;
    if (newStatus === 'cancelled') updatePayload.cancelled_at = now;
    if (newStatus === 'no_show') updatePayload.no_show_at = now;

    await supabase.from('appointments').update(updatePayload).eq('id', id);
    const updatedAppt = appointments.find(a => a.id === id);

    if (updatedAppt) {
      const targetAppt = { ...updatedAppt, status: newStatus };
      if (['checked_in', 'completed', 'arrived', 'cancelled'].includes(newStatus)) {
        await cancelAppointmentSmsJobs(id, `Appointment status changed to ${newStatus}`);
      } else if (newStatus === 'no_show') {
        await scheduleMissedAppointmentSms(targetAppt);
      }
    }
    fetchData(['appointments']);
  };

  const handleUpdateAppointment = async (updatedAppt: Appointment) => {
    const { error } = await supabase
      .from('appointments')
      .update(updatedAppt)
      .eq('id', updatedAppt.id);

    if (error) {
      alert("Error updating appointment: " + error.message);
      return;
    }

    if (updatedAppt.sms_reminders_enabled !== false) {
      await scheduleAppointmentSmsSequence(updatedAppt, null, true);
    }
    fetchData(['appointments']);
  };

  const handleToggleSmsReminders = async (appointmentId: string, enabled: boolean) => {
    await supabase
      .from('appointments')
      .update({ sms_reminders_enabled: enabled })
      .eq('id', appointmentId);

    const appt = appointments.find(a => a.id === appointmentId);
    if (appt) {
      const updated = { ...appt, sms_reminders_enabled: enabled };
      if (!enabled) {
        await cancelAppointmentSmsJobs(appointmentId, 'SMS reminders paused by staff');
      } else {
        await scheduleAppointmentSmsSequence(updated, null, false);
      }
    }
    fetchData(['appointments']);
  };

  const renderContent = () => {
    // Ticket screens need their linked contact before exposing edit/send actions.
    // The normalized ticket fetch can finish before the customer directory does.
    if (['dashboard','kanban','dashboard_list','view_ticket','edit_ticket','analytics','campaigns','messages'].includes(view)
      && tickets.some(ticket => !ticket.customer)) {
      return <p role="status" className="p-6 text-slate-500">Loading linked customer records…</p>;
    }

    // Kiosk views and public widgets are accessible without staff login
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
    if (view === 'quote_widget') {
      return <InstantQuoteWidget isInternal={activeStaff !== null} />;
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
        onDeleteCustomer={handleDeleteCustomer}
      />;
    }

    switch (view) {
      case 'dashboard':
        return (
          <FrontDeskPortal
            customers={customers}
            tickets={tickets}
            currentLocation={currentLocation}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={(cust) => setSelectedCustomerId(cust ? cust.id : null)}
            onSaveCustomer={async (custData) => {
              const created = await handleSaveCustomer(custData);
              if (created && created.id) {
                setSelectedCustomerId(created.id);
              }
            }}
            onStartNewTicket={(cust) => {
              setSelectedCustomerId(cust.id);
              setView('new_ticket');
            }}
            onViewTicket={(ticket) => {
              setActiveTicket(ticket);
              setView('view_ticket');
            }}
            onUpdateTicketStatus={handleUpdateTicketStatus}
            onMarkAsPaid={handleMarkAsPaid}
            onOpenSMSInbox={() => setView('campaigns')}
            onOpenKanban={() => setView('kanban')}
            onOpenTodayList={() => setView('dashboard_list')}
            onOpenAnalytics={handleOpenAnalytics}
            onEditCustomer={(cust) => {
              setCustomerToEdit(cust);
              setView('edit_customer');
            }}
            onDeleteCustomer={handleDeleteCustomer}
            onDeleteTicket={handleDeleteTicket}
          />
        );
      case 'kanban':
        return (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Shop Ticket Kanban Board</h2>
                <p className="text-xs text-slate-500">Drag and drop tickets across status columns</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('dashboard')}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-red-700 transition-colors"
                >
                  ← Back to Front Desk Portal
                </button>
                <button
                  onClick={() => setView('dashboard_list')}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1"
                >
                  📅 Intakes by Date
                </button>
              </div>
            </div>
            <KanbanBoard
              tickets={tickets as any}
              onTicketStatusChange={handleUpdateTicketStatus}
              onTicketClick={(ticket) => {
                setActiveTicket(ticket);
                setView('view_ticket');
              }}
              onTogglePaid={handleMarkAsPaid}
              onDeleteTicket={handleDeleteTicket}
            />
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
                onDeleteCustomer={handleDeleteCustomer}
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
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1"
                    >
                      📅 Intakes by Date
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
                  onDeleteTicket={handleDeleteTicket}
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
          onDelete={handleDeleteTicket}
          onTogglePaid={handleMarkAsPaid}
          onTriggerRepairCompleted={handleNotifyCustomer}
        /> : null;

      case 'appointments_dashboard':
        return <AppointmentList
          appointments={appointments}
          currentLocation={currentLocation}
          onUpdateStatus={handleUpdateAppointmentStatus}
          onConvertToTicket={async () => { alert("Select customer in dashboard."); setView('dashboard'); }}
          onUpdateAppointment={handleUpdateAppointment}
          onDeleteAppointment={async (id) => {
            await cancelAppointmentSmsJobs(id, 'Appointment deleted');
            await supabase.from('appointments').delete().eq('id', id);
            fetchData(['appointments']);
          }}
          onToggleSmsReminders={handleToggleSmsReminders}
          onCreateAppointment={handleCreateAppointment}
        />;
      case 'parts_dashboard':
        return <PartsDashboard
          partsOrders={partsOrders}
          onAddPart={async (part) => {
            const payload = { ...part, location: currentLocation };
            const { error } = await supabase.from('parts_orders').insert([payload]);
            if (error) alert("Error saving part: " + error.message);
            fetchData(['parts_orders']);
          }}
          onUpdatePartStatus={async (id, newStatus) => {
            const { error } = await supabase.from('parts_orders').update({ status: newStatus }).eq('id', id);
            if (error) alert("Error updating status: " + error.message);
            fetchData(['parts_orders']);
          }}
          onDeletePart={async (id) => {
            const { error } = await supabase.from('parts_orders').delete().eq('id', id);
            if (error) alert("Error deleting part: " + error.message);
            fetchData(['parts_orders']);
          }}
        />;
      case 'quotes_dashboard':
        return <QuoteList
          quotes={quotes}
          onCreateNew={() => {
            setActiveQuote(null);
            setView('new_quote');
          }}
          onEdit={(quote) => {
            setActiveQuote(quote);
            setView('edit_quote');
          }}
          onDelete={async (id) => {
            const { error } = await supabase.from('quotes').delete().eq('id', id);
            if (error) alert("Error deleting quote: " + error.message);
            fetchData(['quotes']);
          }}
        />;
      case 'new_quote':
      case 'edit_quote':
        return <QuoteForm
          onSaved={() => {
            fetchData(['quotes']);
            setView('quotes_dashboard');
          }}
          onCancel={() => setView('quotes_dashboard')}
          initialData={activeQuote}
          currentLocation={currentLocation}
        />;
      case 'settings':
        if (activeStaff.role !== 'admin') return <p>Only a store manager can change shop settings.</p>;
        return <SettingsView
          settings={settings}
          currentLocation={currentLocation}
          onSaveSettings={setSettings}
          onBack={() => setView('dashboard')}
        />;
      case 'campaigns':
        return <CampaignsView
          customers={customers}
          tickets={tickets}
          onBack={() => setView('dashboard')}
          showAlert={showAlert}
          showConfirm={showConfirm}
          onViewCustomer={(id) => {
            setSelectedCustomerId(id);
            setView('view_customer' as View);
          }}
          onGoToMessenger={() => setView('messenger')}
        />;
      case 'messages':
        return <SMSInboxView
          customers={customers}
          tickets={tickets}
          currentLocation={currentLocation}
          onViewCustomer={(id) => {
            setSelectedCustomerId(id);
            setView('view_customer' as View);
          }}
          showAlert={showAlert}
        />;
      case 'messenger':
        return <FacebookMessengerInboxView
          customers={customers}
          onViewCustomer={(id) => {
            setSelectedCustomerId(id);
            setView('view_customer' as View);
          }}
          showAlert={showAlert}
        />;
      case 'analytics':
        return <AnalyticsView
          customers={customers}
          tickets={tickets}
          currentLocation={currentLocation}
          onBack={() => setView('dashboard')}
          onNavigateToCampaigns={() => setView('campaigns')}
        />;
      default:
        return <div className="p-8 text-center text-slate-500">View implementation coming soon...</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 w-full max-w-full overflow-x-hidden relative">
      {view !== 'kiosk' && view !== 'kiosk_login' && activeStaff && (
        <Header
          currentView={view}
          onLogoClick={() => setView('dashboard')}
          onGoToKiosk={async () => {
            try { await signOutStaff(); }
            finally { window.location.assign(`/?view=kiosk&location=${encodeURIComponent(currentLocation)}`); }
          }}
          onGoToCustomers={() => setView('customers_dashboard')}
          onGoToAppointments={() => setView('appointments_dashboard')}
          onGoToParts={() => setView('parts_dashboard')}
          onGoToQuotes={() => setView('quotes_dashboard')}
          onGoToSettings={() => setView('settings')}
          onGoToCampaigns={() => setView('campaigns')}
          onGoToQuoteWidget={() => setView('quote_widget')}
          onGoToAnalytics={handleOpenAnalytics}
          onGoToMessages={() => setView('messages')}
          onGoToMessenger={() => setView('messenger')}
          currentLocation={currentLocation}
          onLocationChange={setCurrentLocation}
          businessName={settings.businessName}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          activeStaff={activeStaff}
          onSignOut={onSignOut}
        />
      )}
      <main className={`flex-grow w-full max-w-full overflow-x-hidden ${(view === 'kiosk' || view === 'kiosk_login') ? 'flex items-center justify-center bg-slate-900 min-h-screen' : view === 'quote_widget' ? 'min-h-screen bg-[#f4f2ee]' : 'container mx-auto px-4 py-8'}`}>
        {dataError && <div role="alert" className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 flex items-center justify-between gap-3">
          <span>{dataError}</span><button className="font-bold underline" onClick={() => void fetchData()}>Retry</button>
        </div>}
        {dataLoading && <p role="status" className="mb-3 text-sm text-slate-500">Loading shop records…</p>}
        <ScreenBoundary key={view}><Suspense fallback={<p role="status" className="p-6 text-slate-500">Opening screen…</p>}>{renderContent()}</Suspense></ScreenBoundary>
      </main>
      {view !== 'kiosk' && view !== 'kiosk_login' && view !== 'quote_widget' && <Footer businessName={settings.businessName} />}

      {/* Analytics Password Modal */}
      {showAnalyticsAuthModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-lg">🔒</span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Analytics Security</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Password required to view reports.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalyticsAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUnlockAnalytics} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Enter Password
                </label>
                <input
                  type="password"
                  placeholder="Enter Analytics Password..."
                  value={analyticsInputPass}
                  onChange={e => {
                    setAnalyticsInputPass(e.target.value);
                    if (analyticsAuthError) setAnalyticsAuthError(false);
                  }}
                  autoFocus
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold text-base focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white uppercase tracking-wider"
                />
                {analyticsAuthError && (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1">
                    ⚠️ Incorrect Password. Access Denied.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnalyticsAuthModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-colors"
                >
                  Unlock Dashboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {modal.type === 'confirm' ? 'Confirm Action' : 'Message'}
            </h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed whitespace-pre-wrap">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' && (
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  const onConfirm = modal.onConfirm;
                  setModal(null);
                  if (onConfirm) onConfirm();
                }}
                className="px-5 py-2 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-md shadow-red-200 text-sm"
              >
                {modal.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffWorkspace;
