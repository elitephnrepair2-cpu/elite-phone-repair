import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Customer, RepairTicket, MarketingCampaign, ScheduledCampaign } from '../types';
import { sendSmsViaEdgeFunction } from '../services/smsService';

interface CampaignsViewProps {
  customers: Customer[];
  tickets: RepairTicket[];
  onBack: () => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}

const CampaignsView: React.FC<CampaignsViewProps> = ({ 
  customers, 
  tickets, 
  onBack,
  showAlert,
  showConfirm
}) => {
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

  // Sending Process State
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });

  // Fetch campaigns history
  const fetchCampaignsHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching campaign history:", error);
      } else {
        setCampaigns(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch scheduled campaigns
  const fetchScheduledCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_campaigns')
        .select('*')
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error("Error fetching scheduled campaigns:", error);
      } else {
        setScheduledCampaigns(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setIsLoadingHistory(true);
    await Promise.all([fetchCampaignsHistory(), fetchScheduledCampaigns()]);
    setIsLoadingHistory(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter customers based on location and consent
  const locationCustomers = customers.filter(c => c.location === targetLocation);
  const consentedRecipients = locationCustomers.filter(c => c.marketing_sms_consent === true);
  const skippedCount = locationCustomers.length - consentedRecipients.length;

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

        // 2. Loop through recipients and execute send
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < consentedRecipients.length; i++) {
          const recipient = consentedRecipients[i];
          const parsedBody = parseMessage(messageContent, recipient);

          setSendingProgress(prev => ({ ...prev, current: i + 1 }));

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

          setSendingProgress(prev => ({
            ...prev,
            success: successCount,
            failed: failCount
          }));

          // Delay to respect API limits (1 second pause)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 3. Update campaign counts
        try {
          await supabase
            .from('marketing_campaigns')
            .update({ successful_sends: successCount })
            .eq('id', campaignId);
        } catch (dbErr) {
          console.error("Failed to update final campaign metrics:", dbErr);
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Marketing Campaigns</h2>
        <button
          onClick={onBack}
          className="bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl hover:bg-slate-300 transition-colors shadow-sm"
        >
          Back to Dashboard
        </button>
      </div>

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
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-xs text-slate-500 font-bold block mb-1 uppercase tracking-wider">Group Total</span>
              <span className="text-2xl font-black text-slate-800">{locationCustomers.length}</span>
            </div>
            <div>
              <span className="text-xs text-green-600 font-bold block mb-1 uppercase tracking-wider">Consented</span>
              <span className="text-2xl font-black text-green-600">{consentedRecipients.length}</span>
            </div>
            <div>
              <span className="text-xs text-amber-600 font-bold block mb-1 uppercase tracking-wider">Skipped</span>
              <span className="text-2xl font-black text-amber-600">{skippedCount}</span>
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
          <div className="flex border-b pb-2">
            <button
              onClick={() => setHistoryTab('sent')}
              className={`flex-1 pb-2 text-center text-sm font-bold border-b-2 transition-all ${
                historyTab === 'sent' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sent History ({campaigns.length})
            </button>
            <button
              onClick={() => setHistoryTab('scheduled')}
              className={`flex-1 pb-2 text-center text-sm font-bold border-b-2 transition-all ${
                historyTab === 'scheduled' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Scheduled Runs ({scheduledCampaigns.length})
            </button>
          </div>

          <div className="flex-grow overflow-y-auto space-y-4 custom-scrollbar">
            {isLoadingHistory ? (
              <p className="text-center text-slate-400 italic py-6">Loading campaigns...</p>
            ) : historyTab === 'sent' ? (
              campaigns.length > 0 ? (
                campaigns.map(camp => (
                  <div key={camp.id} className="p-4 bg-slate-50 border rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800">{camp.name}</h4>
                        <p className="text-xs text-slate-500">{new Date(camp.created_at).toLocaleString()}</p>
                      </div>
                      <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {camp.location}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 italic leading-relaxed whitespace-pre-wrap">{camp.message_body}</p>
                    <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-200/50">
                      <span className="text-slate-500">Recipients: {camp.total_recipients}</span>
                      <span className="text-green-600">Success Rate: {camp.total_recipients > 0 ? Math.round((camp.successful_sends / camp.total_recipients) * 100) : 0}% ({camp.successful_sends} sends)</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 italic py-6">No campaigns launched yet.</p>
              )
            ) : (
              // Scheduled Runs Tab list
              scheduledCampaigns.length > 0 ? (
                scheduledCampaigns.map(sched => (
                  <div key={sched.id} className="p-4 bg-slate-50 border rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800">{sched.name}</h4>
                        <div className="text-xs font-bold text-red-600 mt-0.5 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Run: {new Date(sched.scheduled_for).toLocaleString()}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sched.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        sched.status === 'sending' ? 'bg-indigo-100 text-indigo-800 animate-pulse' :
                        sched.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {sched.status}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-600 italic leading-relaxed whitespace-pre-wrap">{sched.message_body}</p>
                    
                    <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-200/50">
                      <span className="text-slate-500">Recipients: {sched.total_recipients}</span>
                      {sched.status === 'pending' && (
                        <button
                          onClick={() => handleCancelScheduled(sched.id)}
                          className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center"
                        >
                          Cancel Run
                        </button>
                      )}
                      {sched.status === 'completed' && (
                        <span className="text-green-600">Sent: {sched.successful_sends}</span>
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
    </div>
  );
};

export default CampaignsView;
