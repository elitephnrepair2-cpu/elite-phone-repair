import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Customer, RepairTicket, MarketingCampaign } from '../types';
import { sendSmsViaEdgeFunction } from '../services/smsService';

interface CampaignsViewProps {
  customers: Customer[];
  tickets: RepairTicket[];
  onBack: () => void;
}

const CampaignsView: React.FC<CampaignsViewProps> = ({ customers, tickets, onBack }) => {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Creator Form State
  const [campaignName, setCampaignName] = useState('');
  const [targetLocation, setTargetLocation] = useState('Beaumont');
  const [messageContent, setMessageContent] = useState('');

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

  useEffect(() => {
    fetchCampaignsHistory();
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
      alert("Please enter a campaign name.");
      return;
    }
    if (!messageContent.trim()) {
      alert("Please enter message content.");
      return;
    }
    if (consentedRecipients.length === 0) {
      alert(`There are no eligible consented recipients at the ${targetLocation} location.`);
      return;
    }

    const confirmLaunch = window.confirm(
      `Are you sure you want to launch "${campaignName}"?\nThis will send SMS messages to ${consentedRecipients.length} customers at ${targetLocation}.`
    );

    if (!confirmLaunch) return;

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
        alert("Database connection failed. Campaign aborted.");
        setIsSending(false);
        return;
      }
      campaignId = data.id;
    } catch (e) {
      console.error(e);
      alert("Error starting campaign. Aborted.");
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
          // @ts-ignore - campaign_id support added in service function
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
    fetchCampaignsHistory();
    setIsSending(false);
    alert(`Campaign complete!\nSuccessful sends: ${successCount}\nFailed sends: ${failCount}`);
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
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 flex flex-col justify-center">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 mb-0.5">Targeting Info</span>
                <span className="text-xs text-slate-600 leading-relaxed">
                  Only customers registered at this location will be evaluated.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Message Content
              </label>
              <textarea
                rows={5}
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
            Launch Campaign
          </button>
        </div>

        {/* Campaign History panel */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-4 flex flex-col h-full lg:max-h-[calc(100vh-12rem)]">
          <h3 className="text-xl font-bold text-slate-800 pb-2 border-b">Campaign History</h3>

          <div className="flex-grow overflow-y-auto space-y-4 custom-scrollbar">
            {isLoadingHistory ? (
              <p className="text-center text-slate-400 italic py-6">Loading past campaigns...</p>
            ) : campaigns.length > 0 ? (
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
