import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Customer, FacebookConversation, FacebookMessage } from '../types';
import { supabase } from '../supabaseClient';

interface FacebookMessengerInboxViewProps {
  customers: Customer[];
  onViewCustomer?: (customerId: string) => void;
  showAlert: (message: string) => void;
}

export const FacebookMessengerInboxView: React.FC<FacebookMessengerInboxViewProps> = ({
  customers = [],
  onViewCustomer,
  showAlert
}) => {
  const [conversations, setConversations] = useState<FacebookConversation[]>([]);
  const [messages, setMessages] = useState<FacebookMessage[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Customer Linking Modal State
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Map customers by ID for fast lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    (customers || []).forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Fetch Conversations from Supabase
  const fetchConversations = async (isInitial = false) => {
    if (isInitial) setIsLoadingConversations(true);
    try {
      const { data, error } = await (supabase as any)
        .from('facebook_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching Facebook conversations:', error);
      } else {
        setConversations(data || []);
      }
    } catch (err) {
      console.error('Error fetching Facebook conversations:', err);
    } finally {
      if (isInitial) setIsLoadingConversations(false);
    }
  };

  // Fetch Messages for Selected Conversation
  const fetchMessagesForConversation = async (convId: string, isInitial = false) => {
    if (isInitial) setIsLoadingMessages(true);
    try {
      const { data, error } = await (supabase as any)
        .from('facebook_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching Facebook messages:', error);
      } else {
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Error fetching Facebook messages:', err);
    } finally {
      if (isInitial) setIsLoadingMessages(false);
    }
  };

  // Initial load and Realtime setup
  useEffect(() => {
    fetchConversations(true);

    const convChannel = supabase
      .channel('fb-conv-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facebook_conversations' }, () => {
        fetchConversations(false);
      })
      .subscribe();

    const msgChannel = supabase
      .channel('fb-msg-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facebook_messages' }, (payload: any) => {
        fetchConversations(false);
        if (selectedConvId && payload.new?.conversation_id === selectedConvId) {
          fetchMessagesForConversation(selectedConvId, false);
        }
      })
      .subscribe();

    const pollInterval = setInterval(() => {
      fetchConversations(false);
      if (selectedConvId) {
        fetchMessagesForConversation(selectedConvId, false);
      }
    }, 5000);

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
      clearInterval(pollInterval);
    };
  }, [selectedConvId]);

  // When selected conversation changes
  useEffect(() => {
    if (selectedConvId) {
      fetchMessagesForConversation(selectedConvId, true);

      // Reset unread count on selection
      const conv = conversations.find(c => c.id === selectedConvId);
      if (conv && conv.unread_count > 0) {
        (supabase as any)
          .from('facebook_conversations')
          .update({ unread_count: 0 })
          .eq('id', selectedConvId)
          .then(() => {
            setConversations(prev => prev.map(c => c.id === selectedConvId ? { ...c, unread_count: 0 } : c));
          });
      }
    } else {
      setMessages([]);
    }
  }, [selectedConvId]);

  // Scroll to bottom of message thread on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Currently active conversation object
  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  // Linked Customer for Active Conversation
  const activeLinkedCustomer = useMemo(() => {
    if (!activeConversation?.customer_id) return null;
    return customerMap.get(activeConversation.customer_id) || null;
  }, [activeConversation, customerMap]);

  // Check 24-Hour Policy Window
  const isMessagingWindowActive = useMemo(() => {
    if (!activeConversation?.last_customer_activity_at) return false;
    const lastActivity = new Date(activeConversation.last_customer_activity_at).getTime();
    const now = Date.now();
    return (now - lastActivity) <= 24 * 60 * 60 * 1000;
  }, [activeConversation]);

  // Filtered Conversations for Search Bar
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => {
      const linkedCust = c.customer_id ? customerMap.get(c.customer_id) : null;
      const name = (c.customer_name || linkedCust?.name || '').toLowerCase();
      const psid = c.psid.toLowerCase();
      const lastMsg = (c.last_message_text || '').toLowerCase();
      return name.includes(q) || psid.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchQuery, customerMap]);

  // Handle Staff Reply Send
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !replyText.trim() || isSending) return;

    if (!isMessagingWindowActive) {
      showAlert("Meta 24-Hour Policy Restriction: You cannot reply to this conversation because more than 24 hours have elapsed since the customer's last message.");
      return;
    }

    setIsSending(true);
    const textToSend = replyText.trim();
    setReplyText('');

    try {
      const { data, error } = await supabase.functions.invoke('send-facebook-messenger', {
        body: {
          conversation_id: selectedConvId,
          message_text: textToSend
        }
      });

      if (error || !data?.success) {
        const errorMsg = error?.message || data?.error || 'Failed to send message via Facebook Messenger';
        console.error('Error invoking send-facebook-messenger function:', error || data);
        showAlert(`Send Failed: ${errorMsg}`);
        // Restore reply text so user doesn't lose work
        setReplyText(textToSend);
      } else {
        // Message sent successfully, refresh messages
        await fetchMessagesForConversation(selectedConvId, false);
        await fetchConversations(false);
      }
    } catch (err: any) {
      console.error('Send reply exception:', err);
      showAlert(`Error sending reply: ${err?.message || 'Unknown error'}`);
      setReplyText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Link Customer Action
  const handleLinkCustomer = async (targetCustomerId: string | null) => {
    if (!selectedConvId || isLinking) return;
    setIsLinking(true);

    try {
      const { error } = await (supabase as any)
        .from('facebook_conversations')
        .update({ customer_id: targetCustomerId, updated_at: new Date().toISOString() })
        .eq('id', selectedConvId);

      if (error) {
        console.error('Error linking CRM customer:', error);
        showAlert('Failed to link CRM customer.');
      } else {
        setConversations(prev => prev.map(c => c.id === selectedConvId ? { ...c, customer_id: targetCustomerId || undefined } : c));
        setShowLinkModal(false);
        showAlert(targetCustomerId ? 'CRM Customer linked successfully!' : 'CRM Customer unlinked.');
      }
    } catch (err) {
      console.error('Link customer exception:', err);
      showAlert('An unexpected error occurred while linking customer.');
    } finally {
      setIsLinking(false);
    }
  };

  // Filtered Customers for Linking Modal
  const filteredCustomersForModal = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 20);
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q) || 
      (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [customers, customerSearchQuery]);

  // Format Helper for timestamps
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.51 3.733 7.188-.195.973-.772 2.617-.893 3.013-.083.272.183.518.441.389 1.135-.568 2.67-1.393 3.712-1.922.955.26 1.97.4 3.007.4 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.293 12.707l-2.793-2.978-5.45 2.978 5.992-6.36 2.825 2.978 5.418-2.978-5.992 6.36z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Facebook Messenger Inbox
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-700">
                Meta Graph API v21.0
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage incoming customer messages and send manual replies for connected Facebook Pages
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchConversations(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Conversations List */}
        <div className={`w-full md:w-80 lg:w-96 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search PSID, customer name, message..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Conversation Cards List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
            {isLoadingConversations ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Loading Facebook conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <p className="font-semibold mb-1">No Messenger Conversations</p>
                <p className="text-[11px] text-slate-400">Incoming messages sent to your Facebook Page will automatically appear here.</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = conv.id === selectedConvId;
                const linkedCust = conv.customer_id ? customerMap.get(conv.customer_id) : null;
                const displayName = conv.customer_name || linkedCust?.name || `Facebook Contact (PSID: ${conv.psid.slice(-6)})`;

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setMobileView('chat');
                    }}
                    className={`p-3.5 cursor-pointer transition-colors flex items-start gap-3 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-600 dark:border-blue-400'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {conv.customer_profile_pic ? (
                        <img
                          src={conv.customer_profile_pic}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                          {displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs truncate ${conv.unread_count > 0 ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>
                          {displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>

                      <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {conv.last_message_text || 'No message content'}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        {linkedCust ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                            CRM Customer: {linkedCust.name}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                            Unlinked Contact
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Chat Thread View */}
        <div className={`flex-1 bg-slate-100 dark:bg-slate-900 flex flex-col min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation ? (
            <>
              {/* Thread Header */}
              <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileView('list')}
                    className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {(activeConversation.customer_name || activeLinkedCustomer?.name || 'FB').slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      {activeConversation.customer_name || activeLinkedCustomer?.name || 'Facebook User'}
                      <span className="text-[11px] font-normal text-slate-400">
                        (PSID: {activeConversation.psid})
                      </span>
                    </h2>

                    <div className="flex items-center gap-2 mt-0.5">
                      {/* 24-Hour Policy Window Badge */}
                      {isMessagingWindowActive ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-extrabold flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          24h Messaging Window Active
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-extrabold flex items-center gap-1 border border-amber-300 dark:border-amber-800" title="Meta standard messaging policy restricts outbound staff replies 24 hours after the customer's last message.">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          24h Window Expired (Meta Restrictions)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2">
                  {activeLinkedCustomer ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onViewCustomer && onViewCustomer(activeLinkedCustomer.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100"
                      >
                        View CRM Customer ({activeLinkedCustomer.name})
                      </button>
                      <button
                        onClick={() => setShowLinkModal(true)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Change Link
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowLinkModal(true)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Link to CRM Customer
                    </button>
                  )}
                </div>
              </div>

              {/* Message Thread Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoadingMessages ? (
                  <div className="text-center py-12 text-xs text-slate-400 flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading message history...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    No messages recorded yet for this conversation thread.
                  </div>
                ) : (
                  messages.map(msg => {
                    const isInbound = msg.direction === 'inbound';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                      >
                        <div className="max-w-[80%] md:max-w-[70%]">
                          {/* Bubble Container */}
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-xs shadow-xs break-words ${
                              isInbound
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200 dark:border-slate-700'
                                : 'bg-blue-600 text-white rounded-tr-xs'
                            }`}
                          >
                            {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

                            {/* Attachments rendering */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {msg.attachments.map((att, idx) => (
                                  <div key={idx} className="overflow-hidden rounded-lg">
                                    {att.type === 'image' && att.url ? (
                                      <a href={att.url} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={att.url}
                                          alt="Messenger Image Attachment"
                                          className="max-h-48 rounded-lg object-cover hover:opacity-90 transition cursor-pointer"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={att.url || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold underline ${
                                          isInbound
                                            ? 'bg-slate-100 text-blue-600 dark:bg-slate-700 dark:text-blue-400'
                                            : 'bg-blue-700 text-white'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        View Attachment ({att.type || 'File'})
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Timestamp & Status Metadata */}
                          <div className={`flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1 ${isInbound ? 'justify-start' : 'justify-end'}`}>
                            <span>{formatTime(msg.created_at)}</span>
                            {!isInbound && (
                              <span>
                                {msg.status === 'sent' && <span className="text-emerald-500 font-bold">✓ Sent</span>}
                                {msg.status === 'pending' && <span className="text-amber-500">Sending...</span>}
                                {msg.status === 'failed' && <span className="text-rose-500 font-bold">✕ Failed</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer Input Area */}
              <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 shrink-0">
                {!isMessagingWindowActive ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-bold flex items-center gap-1.5 mb-0.5">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Meta 24-Hour Messaging Policy Restriction
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      More than 24 hours have passed since the customer sent their last message. To protect user experience, Meta requires the customer to initiate activity before staff can dispatch standard manual replies.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type staff reply for Facebook Messenger..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply(e);
                        }
                      }}
                      disabled={isSending}
                      className="flex-1 p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />

                    <button
                      type="submit"
                      disabled={isSending || !replyText.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 self-end h-10 transition-colors"
                    >
                      {isSending ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-3">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.51 3.733 7.188-.195.973-.772 2.617-.893 3.013-.083.272.183.518.441.389 1.135-.568 2.67-1.393 3.712-1.922.955.26 1.97.4 3.007.4 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.293 12.707l-2.793-2.978-5.45 2.978 5.992-6.36 2.825 2.978 5.418-2.978-5.992 6.36z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">
                Select a Messenger Conversation
              </h3>
              <p className="text-xs max-w-sm">
                Choose a conversation from the left sidebar to view messages, link customer records, and dispatch manual replies.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Linking Modal */}
      {showLinkModal && activeConversation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Link Facebook Conversation to CRM Customer
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  PSID: {activeConversation.psid}
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <input
                type="text"
                value={customerSearchQuery}
                onChange={e => setCustomerSearchQuery(e.target.value)}
                placeholder="Search CRM customers by name, phone, email..."
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50 mb-3 border border-slate-200 dark:border-slate-700 rounded-xl">
              {activeConversation.customer_id && (
                <div
                  onClick={() => handleLinkCustomer(null)}
                  className="p-3 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center justify-between"
                >
                  <span>Unlink Current Customer</span>
                  <span>✕ Unlink</span>
                </div>
              )}

              {filteredCustomersForModal.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No matching CRM customers found.
                </div>
              ) : (
                filteredCustomersForModal.map(cust => (
                  <div
                    key={cust.id}
                    onClick={() => handleLinkCustomer(cust.id)}
                    className={`p-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between ${
                      cust.id === activeConversation.customer_id ? 'bg-blue-50 dark:bg-blue-900/40 font-bold' : ''
                    }`}
                  >
                    <div>
                      <p className="text-xs text-slate-800 dark:text-slate-100 font-semibold">{cust.name}</p>
                      <p className="text-[10px] text-slate-400">{cust.phone} {cust.email ? `• ${cust.email}` : ''}</p>
                    </div>
                    <button
                      disabled={isLinking}
                      className="px-2.5 py-1 text-[10px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {cust.id === activeConversation.customer_id ? 'Linked' : 'Select'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
