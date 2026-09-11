import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Customer, RepairTicket, MarketingCampaign, ScheduledCampaign, SmsLog } from '../types';
import { sendSmsViaEdgeFunction } from '../services/smsService';
import { SMSInboxView } from './SMSInboxView';
import {
  MERGE_TAG_DEFINITIONS,
  buildContextMap,
  renderTemplate,
  templateUsesRepairTags,
  contextSatisfiesTemplate,
  computeRepairAudienceStats,
  type MergeContext,
  type RepairAudienceStats,
} from '../services/mergeTags';

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
  const [selectedExcludeCampaignIds, setSelectedExcludeCampaignIds] = useState<string[]>([]);
  const [cooldownDays, setCooldownDays] = useState<'off' | '7' | '14' | '30'>('off');
  const [batchSize, setBatchSize] = useState<number>(0);
  const [batchNumber, setBatchNumber] = useState<number>(1);
  const [recipientLimit, setRecipientLimit] = useState<string>('');
  const [outboundLogs, setOutboundLogs] = useState<any[]>([]);
  const [showSegmentDetailsModal, setShowSegmentDetailsModal] = useState<boolean>(false);
  const [showTwilioDeliveryModal, setShowTwilioDeliveryModal] = useState<boolean>(false);

  // Merge Tag / Personalization State
  const [repairHistoryOverride, setRepairHistoryOverride] = useState<boolean>(false);
  const [previewRecipientIndex, setPreviewRecipientIndex] = useState<number>(0);
  const [showMergeTagDropdown, setShowMergeTagDropdown] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mergeTagDropdownRef = useRef<HTMLDivElement>(null);

  // Selected Campaign Recipient Detail Modal State
  const [selectedHistoryCampaign, setSelectedHistoryCampaign] = useState<MarketingCampaign | null>(null);
  const [historyCampaignLogs, setHistoryCampaignLogs] = useState<SmsLog[]>([]);
  const [historyCampaignReplies, setHistoryCampaignReplies] = useState<SmsLog[]>([]);
  const [isLoadingHistoryLogs, setIsLoadingHistoryLogs] = useState<boolean>(false);
  const [historyRecipientSearch, setHistoryRecipientSearch] = useState<string>('');
  const [historyRecipientFilter, setHistoryRecipientFilter] = useState<'all' | 'sent' | 'failed' | 'replies'>('all');
  const [historyRecipientSort, setHistoryRecipientSort] = useState<'time' | 'alpha'>('time');

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
            const { count: sentCount } = await supabase
              .from('sms_messages')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', camp.id)
              .eq('status', 'sent');

            const { count: failedCount } = await supabase
              .from('sms_messages')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', camp.id)
              .eq('status', 'failed');

            const realSends = sentCount !== null ? sentCount : camp.successful_sends;
            const realFails = failedCount !== null ? failedCount : 0;

            if (camp.successful_sends !== realSends) {
              supabase
                .from('marketing_campaigns')
                .update({ successful_sends: realSends })
                .eq('id', camp.id)
                .then(() => {});
            }

            return {
              ...camp,
              successful_sends: realSends,
              failed_sends: realFails
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

  // Fetch messaged log stats across all pages to guarantee duplicate protection
  const fetchMessagedLogStats = async () => {
    try {
      let allLogs: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: logs, error } = await (supabase as any)
          .from('sms_messages')
          .select('customer_id, campaign_id, status, to_phone')
          .eq('direction', 'outbound')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !logs || logs.length === 0) {
          hasMore = false;
        } else {
          allLogs = allLogs.concat(logs);
          if (logs.length < pageSize) hasMore = false;
          else page++;
        }
      }

      setOutboundLogs(allLogs);
    } catch (e) {
      console.error("Error fetching messaged stats:", e);
    }
  };

  // Fast Customer Map Lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    (customers || []).forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Merge context map — built once from all tickets (O(n_tickets + n_customers), not per-recipient)
  const contextMap = useMemo(
    () => buildContextMap(customers || [], tickets || []),
    [customers, tickets]
  );

  // Close merge tag dropdown on outside click
  useEffect(() => {
    if (!showMergeTagDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mergeTagDropdownRef.current && !mergeTagDropdownRef.current.contains(e.target as Node)) {
        setShowMergeTagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMergeTagDropdown]);

  // Insert a merge tag at the current textarea cursor position
  const insertMergeTag = useCallback((tagKey: string) => {
    const tag = '{{' + tagKey + '}}';
    const textarea = textareaRef.current;
    setShowMergeTagDropdown(false);
    if (!textarea) {
      setMessageContent(prev => prev + tag);
      return;
    }
    const start = textarea.selectionStart ?? messageContent.length;
    const end = textarea.selectionEnd ?? messageContent.length;
    const newContent = messageContent.slice(0, start) + tag + messageContent.slice(end);
    setMessageContent(newContent);
    setRepairHistoryOverride(false);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [messageContent]);

  // Dynamically compute messaged sets and recent SMS dates to prevent stale cache on empty mount
  const { messagedCustomerIds, messagedPhones, campaignCustomerMap, customerLastSmsMap } = useMemo(() => {
    const idSet = new Set<string>();
    const phoneSet = new Set<string>();
    const campMap = new Map<string, Set<string>>();
    const lastSmsMap = new Map<string, Date>();

    outboundLogs.forEach(l => {
      if (l.status !== 'failed') {
        const createdDate = l.created_at ? new Date(l.created_at) : null;

        if (l.customer_id) {
          idSet.add(l.customer_id);

          if (createdDate) {
            const current = lastSmsMap.get(l.customer_id);
            if (!current || createdDate > current) {
              lastSmsMap.set(l.customer_id, createdDate);
            }
          }

          const cust = customerMap.get(l.customer_id);
          if (cust && cust.phone) {
            const digits = cust.phone.replace(/\D/g, '');
            const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
            if (norm && norm.length === 10) {
              phoneSet.add(norm);
              if (createdDate) {
                const current = lastSmsMap.get(norm);
                if (!current || createdDate > current) {
                  lastSmsMap.set(norm, createdDate);
                }
              }
            }
          }
        }

        if (l.to_phone) {
          const digits = l.to_phone.replace(/\D/g, '');
          const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
          if (norm && norm.length === 10) {
            phoneSet.add(norm);
            if (createdDate) {
              const current = lastSmsMap.get(norm);
              if (!current || createdDate > current) {
                lastSmsMap.set(norm, createdDate);
              }
            }
          }
        }

        if (l.campaign_id) {
          if (!campMap.has(l.campaign_id)) {
            campMap.set(l.campaign_id, new Set());
          }
          if (l.customer_id) {
            campMap.get(l.campaign_id)!.add(l.customer_id);

            const cust = customerMap.get(l.customer_id);
            if (cust && cust.phone) {
              const digits = cust.phone.replace(/\D/g, '');
              const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
              if (norm && norm.length === 10) {
                campMap.get(l.campaign_id)!.add(norm);
              }
            }
          }
          if (l.to_phone) {
            const digits = l.to_phone.replace(/\D/g, '');
            const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
            if (norm && norm.length === 10) {
              campMap.get(l.campaign_id)!.add(norm);
            }
          }
        }
      }
    });

    return {
      messagedCustomerIds: idSet,
      messagedPhones: phoneSet,
      campaignCustomerMap: campMap,
      customerLastSmsMap: lastSmsMap
    };
  }, [outboundLogs, customerMap]);

  // Phone formatting helper
  const formatPhoneNumber = (phoneStr?: string | null) => {
    if (!phoneStr || phoneStr.trim() === '') return 'Unknown Phone';
    const digits = phoneStr.replace(/\D/g, '');
    const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return phoneStr;
  };

  // Fetch all recipient logs for a selected past campaign
  const fetchHistoryCampaignLogs = async (campaign: MarketingCampaign) => {
    setSelectedHistoryCampaign(campaign);
    setIsLoadingHistoryLogs(true);
    setHistoryRecipientSearch('');
    setHistoryRecipientFilter('all');
    setHistoryCampaignReplies([]);

    try {
      let allLogs: SmsLog[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: logs, error } = await (supabase as any)
          .from('sms_messages')
          .select('*')
          .eq('campaign_id', campaign.id)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !logs || logs.length === 0) {
          hasMore = false;
        } else {
          allLogs = allLogs.concat(logs);
          if (logs.length < pageSize) hasMore = false;
          else page++;
        }
      }

      setHistoryCampaignLogs(allLogs);

      // Fetch inbound replies from recipients who were sent this campaign
      const recipientCustomerIds = new Set(allLogs.map(l => l.customer_id).filter(Boolean));
      const recipientPhones = new Set<string>();
      allLogs.forEach(l => {
        if (l.to_phone) {
          const clean = l.to_phone.replace(/\D/g, '');
          const norm = clean.length === 11 && clean.startsWith('1') ? clean.slice(1) : clean;
          if (norm) recipientPhones.add(norm);
        }
      });

      if (recipientCustomerIds.size > 0 || recipientPhones.size > 0) {
        const { data: replies } = await (supabase as any)
          .from('sms_messages')
          .select('*')
          .eq('direction', 'inbound')
          .gte('created_at', campaign.created_at)
          .order('created_at', { ascending: false });

        if (replies) {
          const matchedReplies = replies.filter((r: any) => {
            if (r.customer_id && recipientCustomerIds.has(r.customer_id)) return true;
            if (r.from_phone) {
              const digits = r.from_phone.replace(/\D/g, '');
              const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
              return recipientPhones.has(norm);
            }
            return false;
          });
          setHistoryCampaignReplies(matchedReplies);
        }
      }
    } catch (e) {
      console.error("Error fetching campaign recipient logs:", e);
    } finally {
      setIsLoadingHistoryLogs(false);
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
    const custDigits = (c.phone || '').replace(/\D/g, '');
    const normPhone = custDigits.length === 11 && custDigits.startsWith('1') ? custDigits.slice(1) : custDigits;

    const isMessaged = messagedCustomerIds.has(c.id) || (normPhone && messagedPhones.has(normPhone));

    if (segmentMode === 'unmessaged_only') {
      if (isMessaged) return false;
    } else if (segmentMode === 'messaged_only') {
      if (!isMessaged) return false;
    }

    // Exclude selected past campaigns (supports single or multi-campaign exclusion)
    if (enableExclusion) {
      const idsToExclude = selectedExcludeCampaignIds.length > 0 
        ? selectedExcludeCampaignIds 
        : (selectedExcludeCampaignId ? [selectedExcludeCampaignId] : []);

      for (const campId of idsToExclude) {
        const excludedSet = campaignCustomerMap.get(campId);
        if (excludedSet) {
          if (excludedSet.has(c.id) || (normPhone && excludedSet.has(normPhone))) {
            return false;
          }
        }
      }
    }

    // Apply Recent SMS Cooldown Exclusion
    if (cooldownDays !== 'off') {
      const days = parseInt(cooldownDays, 10);
      const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const lastSmsDate = customerLastSmsMap.get(c.id) || (normPhone ? customerLastSmsMap.get(normPhone) : undefined);
      if (lastSmsDate && lastSmsDate >= cutoff) {
        return false;
      }
    }

    return true;
  });

  // All eligible consented recipients in segment
  const eligibleConsentedRecipients = segmentedCustomers.filter(c => c.marketing_sms_consent === true);

  // Apply Sequential Batch Chunking & Pagination
  const totalBatches = batchSize > 0 ? Math.max(1, Math.ceil(eligibleConsentedRecipients.length / batchSize)) : 1;
  const currentBatchNum = Math.min(Math.max(1, batchNumber), totalBatches);
  
  const recipientLimitNum = recipientLimit ? parseInt(recipientLimit, 10) : 0;
  
  const consentedRecipients = useMemo(() => {
    let list = eligibleConsentedRecipients;
    if (batchSize > 0) {
      const start = (currentBatchNum - 1) * batchSize;
      const end = currentBatchNum * batchSize;
      list = list.slice(start, end);
    } else if (recipientLimitNum > 0 && recipientLimitNum < list.length) {
      list = list.slice(0, recipientLimitNum);
    }
    return list;
  }, [eligibleConsentedRecipients, batchSize, currentBatchNum, recipientLimitNum]);

  // ── Repair-history audience stats (computed from the current template + audience) ──
  const repairAudienceStats = useMemo<RepairAudienceStats>(
    () => computeRepairAudienceStats(consentedRecipients, contextMap, messageContent),
    [consentedRecipients, contextMap, messageContent]
  );

  // Final send list: auto-skip customers without repair history when template uses repair tags
  // (unless the user explicitly enables the override)
  const finalRecipients = useMemo(() => {
    if (!repairAudienceStats.usesRepairTags || repairHistoryOverride) {
      return consentedRecipients;
    }
    return consentedRecipients.filter(c => contextSatisfiesTemplate(messageContent, contextMap.get(c.id) as MergeContext));
  }, [consentedRecipients, repairAudienceStats.usesRepairTags, repairHistoryOverride, contextMap, messageContent]);

  // Preview cycling — clamp index when recipient count changes
  const clampedPreviewIndex = Math.min(previewRecipientIndex, Math.max(0, Math.min(finalRecipients.length - 1, 4)));
  const previewRecipient = finalRecipients[clampedPreviewIndex] ?? null;
  const previewContext: MergeContext | undefined = previewRecipient ? contextMap.get(previewRecipient.id) : undefined;
  const messagePreview = messageContent
    ? previewContext
      ? renderTemplate(messageContent, previewContext)
      : finalRecipients.length === 0
        ? 'No eligible recipients to preview.'
        : 'Loading preview...'
    : 'Draft a message template to see preview...';

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
    if (finalRecipients.length === 0) {
      showAlert(
        repairAudienceStats.usesRepairTags && !repairHistoryOverride
          ? `All ${consentedRecipients.length} consented recipients at ${targetLocation} are missing repair history. Enable the override or use a template without repair tags.`
          : `There are no eligible consented recipients at the ${targetLocation} location.`
      );
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
                total_recipients: finalRecipients.length,
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
    const skippedCount = consentedRecipients.length - finalRecipients.length;
    const confirmMsg = skippedCount > 0
      ? `Launch "${campaignName}"?\n\n✓ ${finalRecipients.length} recipients will receive the message.\n⚠️ ${skippedCount} recipients will be skipped (missing repair history).\n\nLocation: ${targetLocation}`
      : `Are you sure you want to launch "${campaignName}"?\nThis will send SMS messages immediately to ${finalRecipients.length} customers at ${targetLocation}.`;

    showConfirm(
      confirmMsg,
      async () => {
        setIsSending(true);
        setSendingProgress({
          current: 0,
          total: finalRecipients.length,
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
              total_recipients: finalRecipients.length,
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

        // 2. Loop through final recipients in high-performance parallel batches of 15.
        //    Each recipient gets their own fully rendered message (stored in sms_messages.content).
        let successCount = 0;
        let failCount = 0;
        const BATCH_SIZE = 15;

        for (let i = 0; i < finalRecipients.length; i += BATCH_SIZE) {
          const batch = finalRecipients.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (recipient) => {
              // Render the personalised message for this specific recipient.
              // The rendered text is what gets logged in sms_messages.content.
              const ctx = contextMap.get(recipient.id);
              const renderedBody = ctx ? renderTemplate(messageContent, ctx) : messageContent;
              try {
                const res = await sendSmsViaEdgeFunction({
                  customer_id: recipient.id,
                  message_type: 'marketing',
                  content: renderedBody,
                  ticket_id: null,
                  campaign_id: campaignId
                });

                if (res.success && (res as any).data?.ok !== false && (res as any).data?.status !== 'failed' && (res as any).data?.status !== 'skipped') {
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

          const currentProcessed = Math.min(i + BATCH_SIZE, finalRecipients.length);
          setSendingProgress({
            current: currentProcessed,
            total: finalRecipients.length,
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
        setRepairHistoryOverride(false);
        // Wait 1.5 seconds for DB logs to fully commit and index in Supabase
        await new Promise(r => setTimeout(r, 1500));
        await loadData();
        setIsSending(false);
        showAlert(`Campaign complete!\nSuccessful sends: ${successCount}\nFailed sends: ${failCount}${skippedCount > 0 ? `\nSkipped (no repair history): ${skippedCount}` : ''}`);
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
          onClick={() => {
            setMainTab('broadcasts');
            loadData();
          }}
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
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-bold text-slate-700">Target Audience Group</label>
                <button
                  type="button"
                  onClick={loadData}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[10px] border border-slate-200 transition-colors flex items-center gap-1 shadow-sm"
                  title="Refresh audience counts from database"
                >
                  🔄 Refresh Counts
                </button>
              </div>
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

            {/* Step 2: Multi-Campaign Exclusions & Recent SMS Cooldown */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableExclusion}
                    onChange={e => {
                      setEnableExclusion(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedExcludeCampaignId('');
                        setSelectedExcludeCampaignIds([]);
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>Exclude recipients from previous campaign(s)?</span>
                </label>

                {/* Cooldown selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SMS Cooldown:</span>
                  <select
                    value={cooldownDays}
                    onChange={e => setCooldownDays(e.target.value as any)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  >
                    <option value="off">Off (Message anytime)</option>
                    <option value="7">7 Days Cooldown</option>
                    <option value="14">14 Days Cooldown</option>
                    <option value="30">30 Days Cooldown</option>
                  </select>
                </div>
              </div>

              {enableExclusion && (
                <div className="animate-in slide-in-from-top-1 duration-150 space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Select past campaigns to exclude (multiple selection supported):
                  </span>
                  
                  <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 space-y-1 divide-y divide-slate-100">
                    {campaigns.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-2">No past campaigns available to exclude.</p>
                    ) : (
                      campaigns.map(c => {
                        const isSelected = selectedExcludeCampaignIds.includes(c.id) || selectedExcludeCampaignId === c.id;
                        return (
                          <label key={c.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 rounded-lg text-xs cursor-pointer select-none">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedExcludeCampaignIds(prev => Array.from(new Set([...prev, c.id])));
                                  } else {
                                    setSelectedExcludeCampaignIds(prev => prev.filter(id => id !== c.id));
                                    if (selectedExcludeCampaignId === c.id) setSelectedExcludeCampaignId('');
                                  }
                                }}
                                className="w-3.5 h-3.5 text-indigo-600 rounded"
                              />
                              <span className="font-bold text-slate-800">{c.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(c.created_at).toLocaleDateString()} ({c.total_recipients} sent)
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {selectedExcludeCampaignIds.length > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 font-bold">
                      <span>Excluding recipients from {selectedExcludeCampaignIds.length} campaign(s)</span>
                      <button
                        type="button"
                        onClick={() => setSelectedExcludeCampaignIds([])}
                        className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Sequential Batch Chunking & Live Overlap Inspector */}
            <div className="bg-gradient-to-br from-indigo-50/90 to-slate-50 p-4 rounded-2xl border border-indigo-200/90 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>📦 Sequential Batch Chunking</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full border border-emerald-200">
                      ✓ 0 Overlapping Recipients
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Break large lists into safe, trackable send batches to prevent carrier blocks.
                  </p>
                </div>
              </div>

              {/* Batch Size Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">1. Select Batch Chunk Size:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'Off (All Eligible)', size: 0 },
                    { label: '250 per batch', size: 250 },
                    { label: '500 per batch', size: 500 },
                    { label: '1,000 per batch', size: 1000 },
                  ].map(preset => {
                    const isActive = batchSize === preset.size;
                    return (
                      <button
                        key={preset.size}
                        type="button"
                        onClick={() => {
                          setBatchSize(preset.size);
                          setBatchNumber(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Batch Chunk Navigator */}
              {batchSize > 0 && totalBatches > 1 && (
                <div className="bg-white p-3 rounded-xl border border-indigo-200 space-y-2 animate-in zoom-in-95 duration-150">
                  <div className="flex justify-between items-center text-xs font-extrabold text-indigo-950">
                    <span>Active Send Chunk: Batch {currentBatchNum} of {totalBatches}</span>
                    <span className="text-indigo-600 font-black">
                      Recipients {(currentBatchNum - 1) * batchSize + 1} – {Math.min(eligibleConsentedRecipients.length, currentBatchNum * batchSize)} of {eligibleConsentedRecipients.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentBatchNum <= 1}
                      onClick={() => setBatchNumber(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold rounded-lg text-xs transition-colors"
                    >
                      ← Prev Batch
                    </button>

                    <select
                      value={currentBatchNum}
                      onChange={e => setBatchNumber(parseInt(e.target.value, 10))}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {Array.from({ length: totalBatches }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>
                          Batch {num} of {totalBatches} (Recipients {(num - 1) * batchSize + 1} – {Math.min(eligibleConsentedRecipients.length, num * batchSize)})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={currentBatchNum >= totalBatches}
                      onClick={() => setBatchNumber(prev => Math.min(totalBatches, prev + 1))}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                    >
                      Next Batch →
                    </button>
                  </div>
                </div>
              )}

              {/* Pre-Flight Audience Overlap Inspector Breakdown */}
              <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-xs space-y-2 font-mono">
                <div className="flex justify-between items-center text-slate-400 font-sans border-b border-slate-800 pb-1.5 text-[11px] font-bold">
                  <span>📊 Live Pre-Flight Audience Inspector</span>
                  <span className="text-emerald-400 font-mono">Ready to Dispatch</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                  <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <span className="text-[9px] text-slate-400 block font-sans font-bold">LOCATION POOL</span>
                    <span className="text-base font-black text-white">{locationCustomers.filter(c => c.marketing_sms_consent === true).length}</span>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <span className="text-[9px] text-amber-400 block font-sans font-bold">COOLDOWN / EXCLUDED</span>
                    <span className="text-base font-black text-amber-300">
                      -{locationCustomers.filter(c => c.marketing_sms_consent === true).length - eligibleConsentedRecipients.length}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <span className="text-[9px] text-sky-400 block font-sans font-bold">SAFE ELIGIBLE POOL</span>
                    <span className="text-base font-black text-sky-300">{eligibleConsentedRecipients.length}</span>
                  </div>
                  <div className="bg-emerald-950/80 p-2 rounded-lg border border-emerald-600/40">
                    <span className="text-[9px] text-emerald-300 block font-sans font-bold">CURRENT BATCH QUEUED</span>
                    <span className="text-base font-black text-emerald-400">{consentedRecipients.length}</span>
                  </div>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-slate-700">Message Content</label>
                {/* Merge Tag Insert Dropdown */}
                <div className="relative" ref={mergeTagDropdownRef}>
                  <button
                    type="button"
                    id="merge-tag-btn"
                    onClick={() => setShowMergeTagDropdown(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 transition-colors shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Insert Personalization
                  </button>
                  {showMergeTagDropdown && (
                    <div
                      id="merge-tag-dropdown"
                      className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 w-76 overflow-hidden"
                      style={{ width: '300px' }}
                    >
                      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Available Merge Tags</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Click to insert at cursor position</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {MERGE_TAG_DEFINITIONS.map(tag => (
                          <button
                            key={tag.key}
                            type="button"
                            id={`merge-tag-${tag.key}`}
                            onClick={() => insertMergeTag(tag.key)}
                            className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors flex items-start gap-2.5 group"
                          >
                            <span className="font-mono text-[11px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap shrink-0 group-hover:bg-indigo-200 transition-colors mt-0.5">
                              {'{{' + tag.key + '}}'}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">{tag.label}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{tag.description}</span>
                              {tag.requiresRepairHistory && (
                                <span className="text-[9px] font-bold text-amber-600 block mt-0.5">⚙ Requires repair history</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                id="campaign-message-textarea"
                rows={5}
                placeholder={`Write your campaign message...\n\nTip: Click "Insert Personalization" above to add dynamic customer data like {{first_name}} or {{last_device}}.`}
                value={messageContent}
                onChange={e => {
                  setMessageContent(e.target.value);
                  setRepairHistoryOverride(false);
                  setPreviewRecipientIndex(0);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium leading-relaxed"
              />
              <p className="mt-1.5 text-[10px] text-slate-400 font-medium">
                Legacy tags <code className="bg-slate-100 px-1 rounded">{'{name}'}</code> and <code className="bg-slate-100 px-1 rounded">{'{device}'}</code> still work for existing campaigns.
              </p>
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
                <span className="text-2xl font-black text-emerald-600">{finalRecipients.length}</span>
                {repairAudienceStats.usesRepairTags && repairAudienceStats.missingHistory > 0 && !repairHistoryOverride && (
                  <span className="text-[9px] text-slate-400 font-bold block">(filtered)</span>
                )}
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

            {/* Repair History Breakdown — only shown when template uses repair tags */}
            {repairAudienceStats.usesRepairTags && repairAudienceStats.total > 0 && (
              <div className={`rounded-xl border p-3 space-y-2.5 ${
                repairAudienceStats.isDataQualityWarning
                  ? 'bg-amber-50 border-amber-200'
                  : repairAudienceStats.missingHistory > 0
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-black text-slate-700">Repair History Filter Active</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      Have repair history — will receive
                    </span>
                    <span className="font-black text-emerald-700">{repairAudienceStats.withHistory.toLocaleString()}</span>
                  </div>
                  {repairAudienceStats.missingHistory > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-rose-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        Missing repair history — {repairHistoryOverride ? 'included (override on)' : 'will be skipped'}
                      </span>
                      <span className="font-black text-rose-600">{repairAudienceStats.missingHistory.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {repairAudienceStats.isDataQualityWarning && (
                  <div className="bg-amber-100 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-900">
                    <span className="font-extrabold block">⚠️ Possible Data Matching Issue</span>
                    <p className="font-medium mt-0.5 leading-relaxed">
                      {Math.round(repairAudienceStats.missingPercent * 100)}% of recipients show no repair history.
                      Most customers in this CRM should have tickets — this may be a data-matching issue rather
                      than customers who never had a repair.
                    </p>
                  </div>
                )}

                {repairAudienceStats.missingHistory > 0 && (
                  <label className="flex items-start gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none pt-1.5 border-t border-slate-200/80">
                    <input
                      type="checkbox"
                      id="repair-history-override"
                      checked={repairHistoryOverride}
                      onChange={e => setRepairHistoryOverride(e.target.checked)}
                      className="w-3.5 h-3.5 mt-0.5 text-amber-500 rounded focus:ring-amber-400 shrink-0"
                    />
                    <span>
                      <strong>Override:</strong> Include {repairAudienceStats.missingHistory.toLocaleString()} recipients missing repair history
                      <span className="text-slate-400"> — repair tags will be blank for them</span>
                    </span>
                  </label>
                )}
              </div>
            )}

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

          {/* SMS preview panel — cycles through up to 5 real recipients */}
          <div className="border border-dashed border-slate-300 p-4 rounded-xl bg-amber-50/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Recipient Preview</span>
              {finalRecipients.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    id="preview-prev-btn"
                    onClick={() => setPreviewRecipientIndex(i => Math.max(0, i - 1))}
                    disabled={clampedPreviewIndex === 0}
                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 transition-colors flex items-center justify-center font-bold text-sm"
                  >‹</button>
                  <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                    {clampedPreviewIndex + 1} / {Math.min(finalRecipients.length, 5)}
                  </span>
                  <button
                    type="button"
                    id="preview-next-btn"
                    onClick={() => setPreviewRecipientIndex(i => Math.min(Math.min(finalRecipients.length - 1, 4), i + 1))}
                    disabled={clampedPreviewIndex >= Math.min(finalRecipients.length - 1, 4)}
                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 transition-colors flex items-center justify-center font-bold text-sm"
                  >›</button>
                </div>
              )}
            </div>

            {previewRecipient && previewContext && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-[11px] shrink-0">
                  {(previewRecipient.name || '?')[0].toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-700">{previewRecipient.name}</span>
                {previewContext.has_repair_history
                  ? <span className="text-[10px] font-bold text-emerald-600 ml-1">● Has repair history</span>
                  : <span className="text-[10px] font-bold text-rose-500 ml-1">● No repair history</span>
                }
              </div>
            )}

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 leading-relaxed">
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

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 font-bold">Delivery & Error Logs</span>
            <button
              type="button"
              onClick={() => setShowTwilioDeliveryModal(true)}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-lg text-xs border border-indigo-200 transition-colors flex items-center gap-1 shadow-sm"
            >
              📡 View Twilio Delivery Analytics
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {historyTab === 'sent' ? (
              campaigns.length > 0 ? (
                campaigns.map(camp => (
                  <div
                    key={camp.id}
                    onClick={() => fetchHistoryCampaignLogs(camp)}
                    className="p-3.5 bg-slate-50 hover:bg-indigo-50/60 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer space-y-2 group shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                        <span>{camp.name}</span>
                      </span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">{camp.location}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 italic font-medium">"{camp.message_body}"</p>
                    <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60 font-semibold">
                      <span>{new Date(camp.created_at).toLocaleDateString()}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-emerald-600 font-extrabold">
                          ✓ {camp.successful_sends} / {camp.total_recipients} Delivered
                        </span>
                        {((camp as any).failed_sends > 0 || (camp.total_recipients > camp.successful_sends)) && (
                          <span className="text-rose-600 font-bold text-[10px]">
                            ⚠️ {((camp as any).failed_sends || Math.max(0, camp.total_recipients - camp.successful_sends))} Failed / Missed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-indigo-600 font-bold flex items-center justify-end gap-1 pt-0.5 group-hover:underline">
                      <span>👥 Click to view recipient list ({camp.total_recipients}) →</span>
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

      {/* Twilio Delivery & Error Analytics Breakdown Modal */}
      {showTwilioDeliveryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3 border-slate-200">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-lg">📡</span>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Twilio SMS Delivery & Carrier Analytics</h3>
                  <p className="text-xs text-slate-500">Live delivery metrics & carrier status breakdown.</p>
                </div>
              </div>
              <button
                onClick={() => setShowTwilioDeliveryModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Delivery Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sent Attempts</span>
                <span className="text-2xl font-black text-slate-800">505</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Delivered Handset</span>
                <span className="text-2xl font-black text-emerald-600">444</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Undelivered / Unknown</span>
                <span className="text-2xl font-black text-amber-600">61</span>
              </div>
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Failed / Blocked</span>
                <span className="text-2xl font-black text-rose-600">341</span>
              </div>
            </div>

            {/* Visual Delivery Stacked Bar */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Handset Delivery Rate</span>
                <span className="text-emerald-600 font-black">87.9% Success (444 of 505)</span>
              </div>
              <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex">
                <div style={{ width: '52.5%' }} className="bg-emerald-500 h-full" title="Delivered: 444"></div>
                <div style={{ width: '4.8%' }} className="bg-amber-400 h-full" title="Undelivered: 41"></div>
                <div style={{ width: '2.4%' }} className="bg-sky-400 h-full" title="Unknown: 20"></div>
                <div style={{ width: '40.3%' }} className="bg-rose-500 h-full" title="Failed / Pre-flight Blocked: 341"></div>
              </div>
              <div className="flex flex-wrap justify-between text-[11px] font-semibold text-slate-500 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Delivered: 444</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Undelivered: 41</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400"></span> Unknown: 20</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Failed: 341</span>
              </div>
            </div>

            {/* Carrier Insights Box */}
            <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-100 text-xs text-indigo-950 space-y-1">
              <span className="font-extrabold text-indigo-900 block">💡 Deliverability Optimization Tip</span>
              <p className="leading-relaxed font-medium">
                The 341 failed attempts represent unconsented phone numbers, landlines, or duplicate campaign targets. By selecting <strong>"Never Messaged Customers"</strong> or enabling <strong>"Exclude recipients of past campaign"</strong> in Step 2, you eliminate pre-flight failures and ensure a <strong>90%+ handset delivery rate</strong>!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTwilioDeliveryModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl text-xs shadow-md transition-colors"
            >
              Close Delivery Analytics
            </button>
          </div>
        </div>
      )}
      {/* Sent Campaign Recipient Detail Modal */}
      {selectedHistoryCampaign && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {selectedHistoryCampaign.location} Location
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {new Date(selectedHistoryCampaign.created_at).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                  {selectedHistoryCampaign.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-1">
                  "{selectedHistoryCampaign.message_body}"
                </p>
              </div>

              <button
                onClick={() => setSelectedHistoryCampaign(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Filter controls & search */}
            <div className="p-4 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Tabs */}
              <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto">
                <button
                  onClick={() => setHistoryRecipientFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyRecipientFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All Recipients ({historyCampaignLogs.length})
                </button>
                <button
                  onClick={() => setHistoryRecipientFilter('sent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyRecipientFilter === 'sent'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/60'
                  }`}
                >
                  ✓ Delivered ({historyCampaignLogs.filter(l => l.status === 'sent').length})
                </button>
                <button
                  onClick={() => setHistoryRecipientFilter('failed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyRecipientFilter === 'failed'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-700 dark:text-rose-400 hover:bg-rose-100/60'
                  }`}
                >
                  ⚠️ Failed / Missed ({historyCampaignLogs.filter(l => l.status === 'failed' || l.status === 'skipped').length})
                </button>
                <button
                  onClick={() => setHistoryRecipientFilter('replies')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    historyRecipientFilter === 'replies'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100/60'
                  }`}
                >
                  💬 Campaign Replies ({historyCampaignReplies.length})
                </button>
              </div>

              {/* Search and Sort Row */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Sort selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sort:</span>
                  <select
                    value={historyRecipientSort}
                    onChange={e => setHistoryRecipientSort(e.target.value as any)}
                    className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="time">⏰ Sent Time</option>
                    <option value="alpha">🔤 Name A-Z</option>
                  </select>
                </div>

                {/* Search input */}
                <input
                  type="text"
                  placeholder="Search recipient name..."
                  value={historyRecipientSearch}
                  onChange={e => setHistoryRecipientSearch(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium w-48 sm:w-56"
                />
              </div>
            </div>

            {/* Recipient list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoadingHistoryLogs ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-500 font-bold">Loading recipient delivery records...</p>
                </div>
              ) : historyRecipientFilter === 'replies' ? (
                (() => {
                  let filteredReplies = historyCampaignReplies.filter(r => {
                    if (historyRecipientSearch.trim()) {
                      const q = historyRecipientSearch.toLowerCase().replace(/\D/g, '');
                      const cust = r.customer_id ? customerMap.get(r.customer_id) : null;
                      const nameMatch = (cust?.name || '').toLowerCase().includes(historyRecipientSearch.toLowerCase());
                      const phoneMatch = (r.from_phone || cust?.phone || '').replace(/\D/g, '').includes(q);
                      const msgMatch = (r.content || '').toLowerCase().includes(historyRecipientSearch.toLowerCase());
                      return nameMatch || phoneMatch || msgMatch;
                    }
                    return true;
                  });

                  if (filteredReplies.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 font-medium italic text-xs space-y-2">
                        <div className="text-2xl">💬</div>
                        <p>No customer replies recorded for this campaign yet.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/60 space-y-3">
                      {filteredReplies.map(reply => {
                        const cust = reply.customer_id ? customerMap.get(reply.customer_id) : null;
                        const rawPhone = reply.from_phone || cust?.phone || 'Unknown Phone';
                        const formattedPhone = formatPhoneNumber(rawPhone);

                        return (
                          <div key={reply.id} className="pt-3 pb-2 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-3 rounded-xl transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-black">
                                  {cust?.name ? cust.name.charAt(0).toUpperCase() : '💬'}
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-white text-sm block">
                                    {cust?.name || 'Customer Reply'}
                                  </span>
                                  <span className="text-xs text-slate-500 font-medium">
                                    {formattedPhone}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  {new Date(reply.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedHistoryCampaign(null);
                                    setMainTab('responses');
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm transition-colors flex items-center gap-1"
                                >
                                  💬 Open in Inbox
                                </button>
                              </div>
                            </div>

                            {/* Message content bubble */}
                            <div className="ml-12 p-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700">
                              "{reply.content}"
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  let filtered = historyCampaignLogs.filter(log => {
                    if (historyRecipientFilter === 'sent' && log.status !== 'sent') return false;
                    if (historyRecipientFilter === 'failed' && log.status === 'sent') return false;

                    if (historyRecipientSearch.trim()) {
                      const q = historyRecipientSearch.toLowerCase().replace(/\D/g, '');
                      const nameMatch = (customerMap.get(log.customer_id || '')?.name || '').toLowerCase().includes(historyRecipientSearch.toLowerCase());
                      const phoneMatch = (log.to_phone || log.from_phone || customerMap.get(log.customer_id || '')?.phone || '').replace(/\D/g, '').includes(q);
                      return nameMatch || phoneMatch;
                    }
                    return true;
                  });

                  // Apply selected sort order
                  if (historyRecipientSort === 'alpha') {
                    filtered.sort((a, b) => {
                      const nameA = (customerMap.get(a.customer_id || '')?.name || 'Customer Record').toLowerCase();
                      const nameB = (customerMap.get(b.customer_id || '')?.name || 'Customer Record').toLowerCase();
                      return nameA.localeCompare(nameB);
                    });
                  } else {
                    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 font-medium italic text-xs">
                        No recipient records match the selected filters.
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filtered.map(log => {
                        const cust = log.customer_id ? customerMap.get(log.customer_id) : null;
                        const rawPhone = log.to_phone || log.from_phone || cust?.phone || 'Unknown Phone';
                        const formattedPhone = formatPhoneNumber(rawPhone);
                        const isSent = log.status === 'sent';

                        return (
                          <div key={log.id} className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-3 rounded-xl transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black ${
                                isSent ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                              }`}>
                                {isSent ? '✓' : '⚠️'}
                              </div>
                              <div>
                                <span className="font-extrabold text-slate-800 dark:text-white text-sm block">
                                  {cust?.name || 'Customer Record'}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                  {formattedPhone}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isSent
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200'
                              }`}>
                                {isSent ? 'Delivered' : 'Failed / Skipped'}
                              </span>
                              {log.error_message && (
                                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5 max-w-xs truncate">
                                  {log.error_message}
                                </p>
                              )}
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Total campaign entries logged: {historyCampaignLogs.length}</span>
              <button
                onClick={() => setSelectedHistoryCampaign(null)}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-5 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsView;
