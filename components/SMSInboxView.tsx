import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, RepairTicket, SmsLog } from '../types';
import { supabase } from '../supabaseClient';
import { sendSmsIfAllowed } from '../services/smsService';

interface SMSInboxViewProps {
  customers: Customer[];
  tickets: RepairTicket[];
  currentLocation: string;
  onViewCustomer?: (customerId: string) => void;
  onViewTicket?: (ticketId: string) => void;
  showAlert: (message: string) => void;
}

export const SMSInboxView: React.FC<SMSInboxViewProps> = ({
  customers = [],
  tickets = [],
  currentLocation,
  onViewCustomer,
  onViewTicket,
  showAlert
}) => {
  const [messages, setMessages] = useState<SmsLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'inbound_only' | 'opted_out'>('all');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<'all' | 'Beaumont' | 'Houston'>('all');
  const [replyText, setReplyText] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  // Fetch all SMS logs from Supabase without 1000 row truncation limit
  const fetchMessages = async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      let allLogs: SmsLog[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await (supabase as any)
          .from('sms_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allLogs = allLogs.concat(data);
          if (data.length < pageSize) hasMore = false;
          else page++;
        }
      }

      // Re-sort ascending for conversation thread timeline ordering
      allLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(allLogs);
    } catch (err) {
      console.error("Error fetching SMS logs:", err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(true);

    // Subscribe to realtime changes on sms_messages table
    const smsChannel = supabase
      .channel('sms-inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_messages' }, () => {
        fetchMessages(false);
      })
      .subscribe();

    // Fallback polling interval every 5 seconds to ensure instant delivery
    const pollInterval = setInterval(() => {
      fetchMessages(false);
    }, 5000);

    return () => {
      supabase.removeChannel(smsChannel);
      clearInterval(pollInterval);
    };
  }, []);

  // Helper to format phone number nicely
  const formatPhoneNumber = (phoneStr?: string | null) => {
    if (!phoneStr || phoneStr.trim() === '') return 'Unknown Phone';
    const digits = phoneStr.replace(/\D/g, '');
    const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return phoneStr;
  };

  // Customer Map for fast lookup by ID and phone number
  const { customerMap, custPhoneMap } = useMemo(() => {
    const byId = new Map<string, Customer>();
    const byPhone = new Map<string, Customer>();
    (customers || []).forEach(c => {
      byId.set(c.id, c);
      if (c.phone) {
        const clean = c.phone.replace(/\D/g, '');
        const norm = clean.length === 11 && clean.startsWith('1') ? clean.slice(1) : clean;
        if (norm) byPhone.set(norm, c);
      }
      if (c.alt_phone) {
        const cleanAlt = c.alt_phone.replace(/\D/g, '');
        const normAlt = cleanAlt.length === 11 && cleanAlt.startsWith('1') ? cleanAlt.slice(1) : cleanAlt;
        if (normAlt) byPhone.set(normAlt, c);
      }
    });
    return { customerMap: byId, custPhoneMap: byPhone };
  }, [customers]);

  // Group messages by customer_id OR by phone number
  const allConversations = useMemo(() => {
    const groups = new Map<string, { key: string; customerId: string | null; phone: string | null; msgs: SmsLog[] }>();

    messages.forEach(msg => {
      let customerId = msg.customer_id || null;
      let fromPhone = msg.from_phone || msg.to_phone || null;

      // Try matching phone against customer list if customer_id is null
      if (!customerId && fromPhone) {
        const clean = fromPhone.replace(/\D/g, '');
        const norm = clean.length === 11 && clean.startsWith('1') ? clean.slice(1) : clean;
        const matched = custPhoneMap.get(norm);
        if (matched) {
          customerId = matched.id;
        }
      }

      // Determine unique conversation key
      let key = 'unknown';
      if (customerId) {
        key = `cust_${customerId}`;
      } else if (fromPhone && fromPhone.replace(/\D/g, '').length >= 7) {
        key = `phone_${fromPhone.replace(/\D/g, '')}`;
      } else {
        key = `msg_${msg.id}`;
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          customerId,
          phone: fromPhone,
          msgs: []
        });
      } else {
        const existing = groups.get(key)!;
        if (!existing.customerId && customerId) existing.customerId = customerId;
        if (!existing.phone && fromPhone) existing.phone = fromPhone;
      }
      groups.get(key)!.msgs.push(msg);
    });

    const list: {
      conversationKey: string;
      customerId: string | null;
      customer: Customer | null;
      displayPhone: string;
      messages: SmsLog[];
      lastMessage: SmsLog;
      hasInbound: boolean;
    }[] = [];

    groups.forEach((group) => {
      const cust = group.customerId ? customerMap.get(group.customerId) || null : null;
      const sorted = [...group.msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const last = sorted[sorted.length - 1];
      const hasInbound = sorted.some(m => m.direction === 'inbound');

      // Filter by location filter selection
      if (selectedLocationFilter !== 'all') {
        if (cust && cust.location && cust.location !== selectedLocationFilter) {
          return;
        }
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const custName = cust?.name.toLowerCase() || '';
        const custPhone = (cust?.phone || group.phone || '').toLowerCase();
        const msgContent = last.content.toLowerCase();
        if (!custName.includes(q) && !custPhone.includes(q) && !msgContent.includes(q)) {
          return;
        }
      }

      const displayPhone = cust ? formatPhoneNumber(cust.phone) : formatPhoneNumber(group.phone);

      list.push({
        conversationKey: group.key,
        customerId: group.customerId,
        customer: cust,
        displayPhone,
        messages: sorted,
        lastMessage: last,
        hasInbound
      });
    });

    // Sort conversations by latest message timestamp descending
    return list.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
  }, [messages, customerMap, custPhoneMap, selectedLocationFilter, searchQuery]);

  // Filtered view based on filterMode (all vs inbound_only vs opted_out)
  const conversations = useMemo(() => {
    if (filterMode === 'inbound_only') {
      return allConversations.filter(c => c.hasInbound);
    }
    if (filterMode === 'opted_out') {
      return allConversations.filter(c => c.customer?.marketing_sms_consent === false || c.lastMessage.content.trim().toLowerCase() === 'stop');
    }
    return allConversations;
  }, [allConversations, filterMode]);

  // Total counts for top tab badges
  const inboundCount = useMemo(() => {
    return allConversations.filter(c => c.hasInbound).length;
  }, [allConversations]);

  const optedOutCount = useMemo(() => {
    return allConversations.filter(c => c.customer?.marketing_sms_consent === false || c.lastMessage.content.trim().toLowerCase() === 'stop').length;
  }, [allConversations]);

  // Auto select first conversation if none selected or if selected is filtered out
  useEffect(() => {
    if (conversations.length > 0) {
      const exists = conversations.some(c => c.conversationKey === selectedCustomerId);
      if (!exists || !selectedCustomerId) {
        setSelectedCustomerId(conversations[0].conversationKey);
      }
    } else {
      setSelectedCustomerId(null);
    }
  }, [conversations, selectedCustomerId]);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.conversationKey === selectedCustomerId) || null;
  }, [conversations, selectedCustomerId]);

  const [showSaveCustomerModal, setShowSaveCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustLocation, setNewCustLocation] = useState<'Beaumont' | 'Houston'>('Beaumont');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Send Reply
  const handleSendReply = async () => {
    if (!activeConversation) {
      showAlert("Please select a conversation to reply.");
      return;
    }
    if (!replyText.trim()) {
      showAlert("Please enter a reply message.");
      return;
    }

    setIsSendingReply(true);
    try {
      const targetCustomerId = activeConversation.customer?.id || null;
      const targetPhone = activeConversation.displayPhone;

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          customer_id: targetCustomerId,
          to_phone: targetPhone,
          message_type: 'transactional',
          content: replyText.trim()
        }
      });

      if (error || (data && !data.ok)) {
        showAlert(`Failed to send SMS reply: ${error?.message || data?.reason || 'Unknown error'}`);
      } else {
        setReplyText('');
        fetchMessages();
      }
    } catch (err: any) {
      console.error("Reply error:", err);
      showAlert(`Failed to send reply: ${err.message || 'Please try again.'}`);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!activeConversation || !newCustName.trim()) {
      showAlert("Please enter a customer name.");
      return;
    }
    setIsSavingCustomer(true);
    try {
      const cleanPhone = activeConversation.displayPhone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.length === 10
        ? `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
        : activeConversation.displayPhone;

      let { data, error } = await (supabase as any)
        .from('customers')
        .insert({
          name: newCustName.trim(),
          phone: formattedPhone,
          location: newCustLocation,
          transactional_sms_consent: true,
          marketing_sms_consent: true,
          sms_consent_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error && (error.code === '23505' || error.message?.includes('idx_customers_phone_location'))) {
        const { data: existingList } = await (supabase as any)
          .from('customers')
          .select('*')
          .eq('location', newCustLocation);
        const matched = existingList?.find((c: any) => c.phone && c.phone.replace(/\D/g, '') === cleanPhone);
        if (matched) {
          const res = await (supabase as any)
            .from('customers')
            .update({ name: newCustName.trim(), transactional_sms_consent: true, marketing_sms_consent: true })
            .eq('id', matched.id)
            .select()
            .single();
          data = res.data;
          error = res.error;
        }
      }

      if (error) {
        showAlert(`Error saving customer: ${error.message}`);
      } else if (data) {
        // Update past messages from this phone to associate customer_id
        await (supabase as any)
          .from('sms_messages')
          .update({ customer_id: data.id })
          .or(`from_phone.eq.${cleanPhone},from_phone.eq.${formattedPhone}`);

        setShowSaveCustomerModal(false);
        setNewCustName('');
        showAlert(`Saved ${data.name} as a customer!`);
        fetchMessages();
      }
    } catch (e: any) {
      showAlert(`Save failed: ${e.message}`);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const parseReaction = (text: string) => {
    if (!text) return null;
    const trimmed = text.trim();

    // 1. Android Tapback format: "Reacted 👍 to..."
    const androidMatch = trimmed.match(/^Reacted\s+([\u{1F300}-\u{1F9FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|👍|❤️|😂|😮|😢|😡|🙏|‼️|❓|👎])\s+to/u);
    if (androidMatch) {
      const emoji = androidMatch[1];
      return { emoji, label: `Reacted ${emoji} to campaign message` };
    }

    // 2. iOS Tapback formats
    if (/^Loved\s+[“"'\s]?/i.test(trimmed)) {
      return { emoji: '❤️', label: 'Loved your campaign message' };
    }
    if (/^Liked\s+[“"'\s]?/i.test(trimmed)) {
      return { emoji: '👍', label: 'Liked your campaign message' };
    }
    if (/^Emphasized\s+[“"'\s]?/i.test(trimmed)) {
      return { emoji: '‼️', label: 'Emphasized your campaign message' };
    }
    if (/^Laughed at\s+[“"'\s]?/i.test(trimmed)) {
      return { emoji: '😂', label: 'Laughed at your campaign message' };
    }
    if (/^Disliked\s+[“"'\s]?/i.test(trimmed)) {
      return { emoji: '👎', label: 'Disliked your campaign message' };
    }
    if (/^Questioned\s+[“"'\s]?/i.test(trimmed)) {
      return { emoji: '❓', label: 'Questioned your campaign message' };
    }
    if (/^Removed\s+a\s+like\s+from|^Removed\s+a\s+reaction\s+to/i.test(trimmed)) {
      return { emoji: '↩️', label: 'Removed reaction' };
    }

    return null;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Customer Message Responses
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            View incoming SMS replies, campaign responses, and two-way conversations ({currentLocation} Location)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMessages}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Main Inbox Container */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row h-[700px]">
        {/* Left Panel: Conversation List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-800/50">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none dark:text-white"
            />

            <div className="flex gap-2">
              <select
                value={selectedLocationFilter}
                onChange={e => setSelectedLocationFilter(e.target.value as any)}
                className="px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md dark:text-white"
              >
                <option value="all">All Locations</option>
                <option value="Beaumont">Beaumont</option>
                <option value="Houston">Houston</option>
              </select>

              <button
                onClick={() => setFilterMode('all')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${filterMode === 'all' ? 'bg-slate-800 text-white dark:bg-red-600' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}
              >
                All ({allConversations.length})
              </button>
              <button
                onClick={() => setFilterMode('inbound_only')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${filterMode === 'inbound_only' ? 'bg-slate-800 text-white dark:bg-red-600' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}
              >
                Replies ({inboundCount})
              </button>
              <button
                onClick={() => setFilterMode('opted_out')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${filterMode === 'opted_out' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'}`}
              >
                🚫 STOP ({optedOutCount})
              </button>
            </div>
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
            {isLoading ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">Loading SMS conversations...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No SMS message responses found.</div>
            ) : (
              conversations.map(item => {
                const isSelected = selectedCustomerId === item.conversationKey;
                const reaction = parseReaction(item.lastMessage.content);
                return (
                  <button
                    key={item.conversationKey}
                    onClick={() => setSelectedCustomerId(item.conversationKey)}
                    className={`w-full p-3 text-left transition-colors flex flex-col gap-1 ${isSelected ? 'bg-white dark:bg-slate-700 shadow-sm border-l-4 border-red-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-white text-sm truncate">
                        {item.customer ? item.customer.name : item.displayPhone}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                      {item.displayPhone} {item.customer?.location ? `• ${item.customer.location}` : ''}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                      {item.lastMessage.direction === 'inbound' && <strong className="text-emerald-600 dark:text-emerald-400">Reply: </strong>}
                      {reaction ? `${reaction.emoji} ${reaction.label}` : item.lastMessage.content}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {item.hasInbound && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Customer Replied
                        </span>
                      )}
                      {item.customer?.marketing_sms_consent === false && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                          🚫 STOP
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Chat Feed & Reply */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
          {activeConversation ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-white text-base">
                    {activeConversation.customer ? activeConversation.customer.name : activeConversation.displayPhone}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>{activeConversation.displayPhone}</span>
                    {activeConversation.customer?.location && <span>• {activeConversation.customer.location} Location</span>}
                    {activeConversation.customer?.marketing_sms_consent === false && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                        🚫 STOP
                      </span>
                    )}
                  </p>
                </div>

                {activeConversation.customer && onViewCustomer ? (
                  <button
                    onClick={() => onViewCustomer(activeConversation.customer!.id)}
                    className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded text-xs font-semibold transition-colors"
                  >
                    View Customer Profile
                  </button>
                ) : !activeConversation.customer ? (
                  <button
                    onClick={() => {
                      setNewCustName('');
                      setShowSaveCustomerModal(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    + Save as Customer
                  </button>
                ) : null}
              </div>

              {/* Chat Thread Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50 dark:bg-slate-900/50">
                {activeConversation.messages.map(msg => {
                  const isInbound = msg.direction === 'inbound';
                  const reaction = isInbound ? parseReaction(msg.content) : null;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                    >
                      {reaction ? (
                        <div className="flex items-center gap-2 bg-pink-100 dark:bg-pink-950/60 text-pink-800 dark:text-pink-200 px-3 py-1.5 rounded-xl border border-pink-200 dark:border-pink-800 font-bold text-xs shadow-sm">
                          <span className="text-base">{reaction.emoji}</span>
                          <span>{reaction.label}</span>
                        </div>
                      ) : (
                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-sm shadow-sm ${
                            isInbound
                              ? 'bg-emerald-600 text-white rounded-tl-none'
                              : 'bg-slate-800 dark:bg-slate-700 text-white rounded-tr-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            isInbound
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : msg.status === 'sent'
                              ? 'text-slate-400'
                              : 'text-rose-500'
                          }`}
                        >
                          {isInbound ? 'Customer Response' : msg.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Reply Box */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-start gap-2">
                  <div className="flex-1 flex flex-col">
                    <textarea
                      rows={2}
                      placeholder="Type a reply message... (Press Enter for new line to stack text)"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      disabled={isSendingReply}
                      className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-sm border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none dark:text-white resize-none leading-relaxed"
                    />
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between px-1 font-medium">
                      <span>Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-[9px] font-mono">Enter</kbd> for new line / stack text</span>
                      <span><kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-[9px] font-mono">Shift + Enter</kbd> or Send button to dispatch</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText.trim()}
                    className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 self-start"
                  >
                    {isSendingReply ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-3 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="font-semibold text-base">Select a conversation from the left to view customer SMS responses</p>
            </div>
          )}
        </div>
      </div>

      {/* Save Customer Modal */}
      {showSaveCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Save New Customer Profile
            </h3>
            
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Link phone number <strong className="font-mono text-slate-800 dark:text-slate-200">{activeConversation?.displayPhone}</strong> to a new customer record.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Primary Location</label>
                <select
                  value={newCustLocation}
                  onChange={e => setNewCustLocation(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white"
                >
                  <option value="Beaumont">Beaumont</option>
                  <option value="Houston">Houston</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSaveCustomerModal(false)}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomer}
                disabled={isSavingCustomer || !newCustName.trim()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shadow-md"
              >
                {isSavingCustomer ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
