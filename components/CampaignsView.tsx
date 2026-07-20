import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Customer, RepairTicket, MarketingCampaign, ScheduledCampaign } from '../types';
import { sendSmsViaEdgeFunction } from '../services/smsService';
import { SMSInboxView } from './SMSInboxView';

interface CampaignsViewProps {
  customers: Customer[];
  tickets: RepairTicket[];
  onBack: () => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
  onViewCustomer?: (customerId: string) => void;
  onViewTicket?: (ticketId: string) => void;
}

const CampaignsView: React.FC<CampaignsViewProps> = ({ 
  customers, 
  tickets, 
  onBack,
  showAlert,
  showConfirm,
  onViewCustomer,
  onViewTicket
}) => {
  const [mainTab, setMainTab] = useState<'broadcasts' | 'responses'>('broadcasts');
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [scheduledCampaigns, setScheduledCampaigns] = useState<ScheduledCampaign[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyTab, setHistoryTab] = useState<'sent' | 'scheduled'>('sent');

  // Creator Form State
  const [campaignName, setCampaignName] = useState('');
  const [targetLocation, setTargetLocation] = useState('Beaumont');
  const [messageContent, setMessageContent] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'later'>('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [showSkippedModal, setShowSkippedModal] = useState(false);

  // Audience Segment State
  const [segmentMode, setSegmentMode] = useState<'unmessaged_only' | 'messaged_only' | 'all'>('unmessaged_only');
  const [enableExclusion, setEnableExclusion] = useState<boolean>(false);
  const [selectedExcludeCampaignId, setSelectedExcludeCampaignId] = useState<string>('');
  const [messagedCustomerIds, setMessagedCustomerIds] = useState<Set<string>>(new Set());
  const [campaignCustomerMap, setCampaignCustomerMap] = useState<Map<string, Set<string>>>(new Map());
  const [showSegmentDetailsModal, setShowSegmentDetailsModal] = useState<boolean>(false);

  // Sending Process State
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });

  // Trigger scheduled runner Edge Function
  const triggerProcessScheduled = async () => {
    try {
      const { error } = await supabase.functions.invoke('process-scheduled');
      if (!error) {
        setTimeout(() => {
          fetchScheduledCampaigns();
          fetchCampaignsHistory();
        }, 1500);
      }
    } catch (err) {
      console.error("Error triggering process-scheduled:", err);
    }
  };

  // Fetch campaigns history with dynamic auto-sync from sms_messages
  const fetchCampaignsHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data: camps, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching campaign history:", error);
      } else if (camps && camps.length > 0) {
        const updatedCamps = await Promise.all(
          camps.map(async (camp) => {
            const { count } = await supabase
              .from('sms_messages')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', camp.id)
              .eq('status', 'sent');

            const realSends = (count !== null && count > 0) ? count : camp.successful_sends;
            
            if (camp.successful_sends === 0 && realSends > 0) {
              supabase
                .from('marketing_campaigns')
                .update({ successful_sends: realSends })
                .eq('id', camp.id)
                .then(() => {});
            }

            return {
              ...camp,
              successful_sends: realSends
            };
          })
        );
        setCampaigns(updatedCamps);
      } else {
        setCampaigns([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch scheduled campaigns with auto-trigger check
  const fetchScheduledCampaigns = async () => {
    try {
      const { data: scheds, error } = await supabase
        .from('scheduled_campaigns')
        .select('*')
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error("Error fetching scheduled campaigns:", error);
      } else if (scheds && scheds.length > 0) {
        setScheduledCampaigns(scheds);

        // Auto trigger if any run is due or stuck sending
        const nowIso = new Date().toISOString();
        const dueRuns = scheds.filter(s => 
          (s.status === 'pending' || s.status === 'sending') && 
          s.scheduled_for <= nowIso
        );
        if (dueRuns.length > 0) {
          triggerProcessScheduled();
        }
      } else {
        setScheduledCampaigns([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch messaged log stats to enable duplicate protection and audience segmentation
  const fetchMessagedLogStats = async () => {
    try {
      const { data: logs } = await supabase
        .from('sms_messages')
        .select('customer_id, campaign_id')
        .eq('direction', 'outbound');

      if (logs) {
        const set = new Set<string>();
        const campMap = new Map<string, Set<string>>();

        logs.forEach(l => {
          if (l.customer_id) {
            set.add(l.customer_id);

            if (l.campaign_id) {
              if (!campMap.has(l.campaign_id)) {
                campMap.set(l.campaign_id, new Set());
              }
              campMap.get(l.campaign_id)!.add(l.customer_id);
            }
          }
        });

        setMessagedCustomerIds(set);
        setCampaignCustomerMap(campMap);
      }
    } catch (e) {
      console.error("Error fetching messaged stats:", e);
    }
  };

  const loadData = async () => {
    setIsLoadingHistory(true);
    await Promise.all([fetchCampaignsHistory(), fetchScheduledCampaigns(), fetchMessagedLogStats()]);
    setIsLoadingHistory(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter customers based on location
  const locationCustomers = customers.filter(c => targetLocation === 'all' || c.location === targetLocation);

  // Strictly opted-out customers (marketing_sms_consent === false or revoked_reason present)
  const optedOutCustomers = locationCustomers.filter(c => c.marketing_sms_consent === false || c.revoked_reason != null);
  const optedOutCount = optedOutCustomers.length;

  // Apply Audience Segmentation
  const segmentedCustomers = locationCustomers.filter(c => {
    if (segmentMode === 'unmessaged_only') {
      if (messagedCustomerIds.has(c.id)) return false;
    } else if (segmentMode === 'messaged_only') {
      if (!messagedCustomerIds.has(c.id)) return false;
    }

    if (enableExclusion && selectedExcludeCampaignId) {
      const excludedSet = campaignCustomerMap.get(selectedExcludeCampaignId);
      if (excludedSet && excludedSet.has(c.id)) {
        return false;
      }
    }
    return true;
  });

  // Final Consented recipients ready to receive SMS
  const consentedRecipients = segmentedCustomers.filter(c => c.marketing_sms_consent === true);

  // Helper to parse tags
  const parseMessage = (template: string, customer: Customer) => {
    let parsed = template;
    // 1. Parse name
    parsed = parsed.replace(/{name}/g, customer.name);

    // 2. Parse device (find last repaired device)
    const customerTickets = tickets.filter(t => t.customer_id === customer.id);
    const lastDevice = customerTickets[customerTickets.length - 1]?.device || 'your device';
    parsed = parsed.replace(/{device}/g, lastDevice);

    return parsed;
  };

  // Preview message content dynamically using a dummy or first matching customer
  const sampleCustomer = consentedRecipients[0] || { name: 'John Doe', id: 'sample' } as Customer;
  const messagePreview = messageContent ? parseMessage(messageContent, sampleCustomer) : 'Draft a message template to see preview...';

  // Handle Launch Campaign
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      showAlert("Please enter a campaign name.");
      return;
    }
    if (!messageContent.trim()) {
      showAlert("Please enter message content.");
      return;
    }
    if (consentedRecipients.length === 0) {
      showAlert(`There are no eligible consented recipients at the ${targetLocation} location.`);
      return;
    }

    if (sendMode === 'later') {
      if (!scheduledFor) {
        showAlert("Please select a date and time for scheduling.");
        return;
      }
      const schedTime = new Date(scheduledFor).getTime();
      const nowTime = new Date().getTime();
      if (schedTime <= nowTime) {
        showAlert("Scheduled date and time must be in the future.");
        return;
      }

      showConfirm(
        `Confirm scheduling campaign "${campaignName}" for ${new Date(scheduledFor).toLocaleString()}?`,
        async () => {
          try {
            const { error } = await supabase
              .from('scheduled_campaigns')
              .insert([{
                name: campaignName,
                location: targetLocation,
                message_body: messageContent,
                scheduled_for: new Date(scheduledFor).toISOString(),
                status: 'pending',
                total_recipients: consentedRecipients.length,
                successful_sends: 0
              }]);

            if (error) {
              console.error("Failed to schedule campaign:", error);
              showAlert("Scheduling failed: " + error.message);
            } else {
              showAlert(`Campaign "${campaignName}" successfully scheduled!`);
              setCampaignName('');
              setMessageContent('');
              setScheduledFor('');
              setSendMode('now');
              fetchScheduledCampaigns();
              setHistoryTab('scheduled');
            }
          } catch (e) {
            console.error(e);
            showAlert("Error scheduling campaign.");
          }
        }
      );
      return;
    }

    // Direct Instant Sending logic
    showConfirm(
      `Are you sure you want to launch "${campaignName}"?\nThis will send SMS messages immediately to ${consentedRecipients.length} customers at ${targetLocation}.`,
      async () => {
        setIsSending(true);
        setSendingProgress({
          current: 0,
          total: consentedRecipients.length,
          success: 0,
          failed: 0,
        });

        // 1. Create the campaign entry in DB
        let campaignId = '';
        try {
          const { data, error } = await supabase
            .from('marketing_campaigns')
            .insert([{
              name: campaignName,
              location: targetLocation,
              message_body: messageContent,
              total_recipients: consentedRecipients.length,
              successful_sends: 0
            }])
            .select()
            .single();

          if (error) {
            console.error("Failed to log campaign:", error);
            showAlert("Database connection failed. Campaign aborted.");
            setIsSending(false);
            return;
          }
          campaignId = data.id;
        } catch (e) {
          console.error(e);
          showAlert("Error starting campaign. Aborted.");
          setIsSending(false);
          return;
        }

        // 2. Loop through recipients in high-performance parallel batches of 15
        let successCount = 0;
        let failCount = 0;
        const BATCH_SIZE = 15;

        for (let i = 0; i < consentedRecipients.length; i += BATCH_SIZE) {
          const batch = consentedRecipients.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (recipient) => {
              const parsedBody = parseMessage(messageContent, recipient);
              try {
                const res = await sendSmsViaEdgeFunction({
                  customer_id: recipient.id,
                  message_type: 'marketing',
                  content: parsedBody,
                  ticket_id: null,
                  campaign_id: campaignId
                });

                if (res.success) {
                  successCount++;
                } else {
                  failCount++;
                }
              } catch (err) {
                console.error("Failed to send message during campaign:", err);
                failCount++;
              }
            })
          );

          const currentProcessed = Math.min(i + BATCH_SIZE, consentedRecipients.length);
          setSendingProgress({
            current: currentProcessed,
            total: consentedRecipients.length,
            success: successCount,
            failed: failCount
          });

          // Continuously save successful_sends progress in DB so progress is never lost
          try {
            await supabase
              .from('marketing_campaigns')
              .update({ successful_sends: successCount })
              .eq('id', campaignId);
          } catch (dbErr) {
            console.error("Progress update failed:", dbErr);
          }
        }

        // Refresh UI
        setCampaignName('');
        setMessageContent('');
        loadData();
        setIsSending(false);
        showAlert(`Campaign complete!\nSuccessful sends: ${successCount}\nFailed sends: ${failCount}`);
      }
    );
  };

  // Handle Cancel Scheduled
  const handleCancelScheduled = async (id: string) => {
    showConfirm(
      "Are you sure you want to cancel and delete this scheduled campaign?",
      async () => {
        try {
          const { error } = await supabase
            .from('scheduled_campaigns')
            .delete()
            .eq('id', id);

          if (error) {
            showAlert("Failed to cancel scheduled campaign: " + error.message);
          } else {
            showAlert("Campaign cancelled.");
            fetchScheduledCampaigns();
          }
        } catch (e) {
          console.error(e);
        }
      }
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Campaigns & SMS Messaging</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Broadcast marketing campaigns and view incoming customer SMS responses</p>
        </div>
        <button
          onClick={onBack}
          className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-6 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Main Sub-Tabs */}
      <div className="flex bg-slate-200 dark:bg-slate-700/60 p-1.5 rounded-2xl gap-2 shadow-inner border border-slate-300 dark:border-slate-600">
        <button
          onClick={() => setMainTab('broadcasts')}
          className={`flex-1 py-3 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
            mainTab === 'broadcasts'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          Campaign Broadcasts & Scheduling
        </button>

        <button
          onClick={() => setMainTab('responses')}
          className={`flex-1 py-3 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
            mainTab === 'responses'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Customer SMS Responses & Inbox
        </button>
      </div>

      {mainTab === 'responses' ? (
        <div className="mt-4">
          <SMSInboxView
            customers={customers}
            tickets={tickets}
            currentLocation={targetLocation}
            onViewCustomer={onViewCustomer}
            onViewTicket={onViewTicket}
            showAlert={showAlert}
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Creator panel */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
          <h3 className="text-xl font-bold text-slate-800 pb-2 border-b">Create New Campaign</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Campaign Name</label>
              <input
                type="text"
                placeholder="e.g. Beaumont - Houston Opening Invite"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Target Location Group</label>
                <select
                  value={targetLocation}
                  onChange={e => setTargetLocation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                >
                  <option value="Beaumont">Beaumont</option>
                  <option value="Houston">Houston</option>
                  <option value="all">All Locations</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Send Schedule</label>
                <div className="bg-slate-100 p-1 rounded-xl flex border">
                  <button
                    type="button"
                    onClick={() => setSendMode('now')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      sendMode === 'now' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Send Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode('later')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      sendMode === 'later' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </div>

            {/* Step 1: Audience Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex justify-between items-center">
                <span>Target Audience Group</span>
                <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  🛡️ Smart Filter
                </span>
              </label>
              <select
                value={segmentMode}
                onChange={e => setSegmentMode(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-semibold text-slate-800"
              >
                <option value="unmessaged_only">🌟 Never Messaged Customers Only (Fresh Leads)</option>
                <option value="messaged_only">🔁 Previously Messaged Customers (Follow-Up List)</option>
                <option value="all">👥 All Consented Customers in Location</option>
              </select>
            </div>

            {/* Step 2: Optional Campaign Exclusion Checkbox */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableExclusion}
                  onChange={e => {
                    setEnableExclusion(e.target.checked);
                    if (!e.target.checked) setSelectedExcludeCampaignId('');
                  }}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span>Exclude recipients of a specific previous campaign?</span>
              </label>

              {enableExclusion && (
                <div className="animate-in slide-in-from-top-1 duration-150 pt-1">
                  <select
                    value={selectedExcludeCampaignId}
                    onChange={e => setSelectedExcludeCampaignId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium"
                  >
                    <option value="">-- Select Past Campaign to Exclude --</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({new Date(c.created_at).toLocaleDateString()}) - {c.total_recipients} recipients
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Scheduled Date Time input picker */}
            {sendMode === 'later' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={e => setScheduledFor(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Message Content
              </label>
              <textarea
                rows={4}
                placeholder="Write your campaign details..."
                value={messageContent}
                onChange={e => setMessageContent(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium leading-relaxed"
              />
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span>Insert Tags:</span>
                <button 
                  onClick={() => setMessageContent(prev => prev + '{name}')} 
                  className="px-2 py-1 bg-slate-100 rounded-md text-red-600 hover:bg-slate-200"
                >
                  {`{name}`} (Customer Name)
                </button>
                <button 
                  onClick={() => setMessageContent(prev => prev + '{device}')} 
                  className="px-2 py-1 bg-slate-100 rounded-md text-red-600 hover:bg-slate-200"
                >
                  {`{device}`} (Last Device)
                </button>
              </div>
            </div>
          </div>

          {/* Pre-flight list validation info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center items-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] text-slate-500 font-bold block mb-0.5 uppercase tracking-wider">Group Total</span>
                <span className="text-xl font-black text-slate-800">{locationCustomers.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-sm">
                <span className="text-[10px] text-emerald-600 font-bold block mb-0.5 uppercase tracking-wider">Will Receive</span>
                <span className="text-2xl font-black text-emerald-600">{consentedRecipients.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSkippedModal(true)}
                className="bg-rose-50 hover:bg-rose-100 p-2.5 rounded-xl border border-rose-200 transition-all cursor-pointer shadow-sm text-center"
                title="Click to view Opted-Out customers"
              >
                <span className="text-[10px] text-rose-700 font-extrabold block mb-0.5 uppercase tracking-wider underline">Opted Out 🔍</span>
                <span className="text-2xl font-black text-rose-600">{optedOutCount}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSegmentDetailsModal(true)}
                className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 border border-indigo-200 shadow-sm"
              >
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Inspect Target Audience ({consentedRecipients.length})
              </button>
            </div>
          </div>

          {/* SMS preview panel */}
          <div className="border border-dashed border-slate-300 p-4 rounded-xl bg-amber-50/20">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Recipient Preview Example</span>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 leading-relaxed max-w-md">
              {messagePreview}
            </div>
          </div>

          <button
            onClick={handleLaunchCampaign}
            disabled={isSending}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md text-base"
          >
            {sendMode === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
          </button>
        </div>

        {/* Campaigns History and Scheduled list */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-4 flex flex-col h-full lg:max-h-[calc(100vh-12rem)]">
          {/* Panel Toggle Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setHistoryTab('sent')}
              className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 ${
                historyTab === 'sent' ? 'border-red-600 text-red-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sent History ({campaigns.length})
            </button>
            <button
              onClick={() => setHistoryTab('scheduled')}
              className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                historyTab === 'scheduled' ? 'border-red-600 text-red-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Scheduled Runs ({scheduledCampaigns.length})
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {historyTab === 'sent' ? (
              campaigns.length > 0 ? (
                campaigns.map(camp => (
                  <div key={camp.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-slate-800 text-sm">{camp.name}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">{camp.location}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 italic font-medium">"{camp.message_body}"</p>
                    <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-semibold">
                      <span>{new Date(camp.created_at).toLocaleDateString()}</span>
                      <span className="text-green-600 font-bold">
                        {camp.successful_sends} / {camp.total_recipients} Delivered
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 italic py-6">No past campaign history.</p>
              )
            ) : (
              scheduledCampaigns.length > 0 ? (
                scheduledCampaigns.map(sched => (
                  <div key={sched.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-slate-800 text-sm">{sched.name}</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        sched.status === 'completed' ? 'bg-green-100 text-green-800' :
                        sched.status === 'sending' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                        sched.status === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {sched.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 italic">"{sched.message_body}"</p>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200 font-semibold text-slate-500">
                      <span>Scheduled: {new Date(sched.scheduled_for).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {sched.status === 'pending' && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => triggerProcessScheduled()}
                            className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center"
                          >
                            ▶ Run Now
                          </button>
                          <button
                            onClick={() => handleCancelScheduled(sched.id)}
                            className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {(sched.status === 'completed' || sched.status === 'sending') && (
                        <span className="text-green-600">
                          {sched.successful_sends} / {sched.total_recipients}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 italic py-6">No scheduled campaign runs.</p>
              )
            )}
          </div>
        </div>
      </div>
      )}

      {/* Sending overlay */}
      {isSending && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900">Campaign Dispatch Active</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-600">
                <span>Progress</span>
                <span>{sendingProgress.current} / {sendingProgress.total}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 shadow-inner">
                <div 
                  className="bg-red-600 h-full transition-all duration-300"
                  style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <span className="text-xs text-green-700 font-bold block uppercase tracking-wider mb-0.5">Successful</span>
                <span className="text-2xl font-black text-green-600">{sendingProgress.success}</span>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <span className="text-xs text-red-700 font-bold block uppercase tracking-wider mb-0.5">Failed</span>
                <span className="text-2xl font-black text-red-600">{sendingProgress.failed}</span>
              </div>
            </div>

            <p className="text-sm text-slate-500 italic">
              Sending messages... Please keep this page open until campaign is completed.
            </p>
          </div>
        </div>
      )}

      {/* Excluded / Skipped Customers Modal */}
      {showSkippedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">Opted-Out Customers (STOP) ({optedOutCount})</h3>
                <p className="text-xs text-slate-500">These customers replied STOP or opted out and are automatically excluded from broadcasts.</p>
              </div>
              <button
                onClick={() => setShowSkippedModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 pr-1">
              {optedOutCustomers.map(c => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{c.name}</span>
                    <span className="text-slate-500 font-mono">{c.phone}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                    {c.revoked_reason || 'Opted Out / STOP'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowSkippedModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Close List
            </button>
          </div>
        </div>
      )}

      {/* Target Audience Inspector Modal */}
      {showSegmentDetailsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">Target Audience List ({consentedRecipients.length})</h3>
                <p className="text-xs text-slate-500">
                  {segmentMode === 'unmessaged_only' && 'Fresh leads who have never received a campaign broadcast.'}
                  {segmentMode === 'exclude_campaign' && 'Recipients excluding selected past campaign.'}
                  {segmentMode === 'messaged_only' && 'Previously messaged follow-up list.'}
                  {segmentMode === 'all' && 'All consented recipients for target location.'}
                </p>
              </div>
              <button
                onClick={() => setShowSegmentDetailsModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 pr-1">
              {consentedRecipients.map(c => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{c.name}</span>
                    <span className="text-slate-500 font-mono">{c.phone}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-bold text-[10px]">
                      Ready ({c.location})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowSegmentDetailsModal(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              Close Audience Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsView;
