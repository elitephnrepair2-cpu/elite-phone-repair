
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { ShopSettings, AppointmentSmsSettings } from '../types';
import { renderAppointmentTemplate } from '../services/appointmentSmsService';

interface SettingsViewProps {
  settings: ShopSettings;
  currentLocation: string;
  onSaveSettings: (settings: ShopSettings) => void;
  onBack: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ settings, currentLocation, onSaveSettings, onBack }) => {
  const [form, setForm] = useState<ShopSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  // Clover Integration State
  const [isCloverConnected, setIsCloverConnected] = useState(false);
  const [cloverDevices, setCloverDevices] = useState<any[]>([]);
  const [selectedCloverDevice, setSelectedCloverDevice] = useState<string>('');
  const [isLoadingClover, setIsLoadingClover] = useState(true);
  
  // Manual Clover Token State
  const [manualToken, setManualToken] = useState('');
  const [manualMerchantId, setManualMerchantId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [cloverLocation, setCloverLocation] = useState<string>(currentLocation || 'Beaumont');

  // Repair Pricing Manager State
  const [dbPrices, setDbPrices] = useState<any[]>([]);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<'Apple' | 'Samsung'>('Apple');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editPricesForm, setEditPricesForm] = useState<Record<string, { price: string; lcd?: string; oled?: string; oem?: string }>>({});
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  const fetchPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('repair_prices')
        .select('*')
        .order('brand', { ascending: true })
        .order('model', { ascending: true })
        .order('category', { ascending: true });
    } catch (e) {
      console.error("Error fetching repair prices:", e);
    }
  };

  // Appointment SMS Automations State
  const [smsConfig, setSmsConfig] = useState<Partial<AppointmentSmsSettings>>({
    location: currentLocation || 'Beaumont',
    dry_run: true,
    test_phone_number: '',
    quiet_hours_enabled: true,
    quiet_hours_start: '08:00',
    quiet_hours_end: '22:00',
    timezone: 'America/Chicago',
    enable_immediate_confirmation: true,
    enable_reminder_24h: true,
    enable_reminder_2h: true,
    enable_missed_appointment: true,
    template_immediate_confirmation: 'Your appointment with Elite Phone Repair is set for {{appointment_date}} at {{appointment_time}}.\nDevice: {{device}}\nRepair: {{repair_issue}}\nLocation: {{location_address}}\n\nReply YES to confirm your appointment, or reply CANCEL to cancel.',
    template_reminder_24h: 'Reminder: You’re scheduled with Elite Phone Repair tomorrow at {{appointment_time}} for your {{device}}.\nLocation: {{location_address}}\nNeed to reschedule? Reply here and let us know.',
    template_reminder_2h: 'Your appointment with Elite Phone Repair is coming up today at {{appointment_time}}.\nLocation: {{location_address}}\nReply here if you need anything.',
    template_missed_appointment: 'Hey, it’s Elite Phone Repair. We missed you for your {{device}} appointment today. Do you still need it fixed? Reply here and we’ll help you find another time.'
  });
  const [activeTemplateTab, setActiveTemplateTab] = useState<'immediate' | 'reminder_24h' | 'reminder_2h' | 'missed'>('immediate');
  const [isSavingSmsSettings, setIsSavingSmsSettings] = useState(false);

  const fetchSmsSettings = async () => {
    try {
      const loc = currentLocation || 'Beaumont';
      const { data } = await supabase
        .from('appointment_sms_settings')
        .select('*')
        .eq('location', loc)
        .maybeSingle();

      if (data) {
        setSmsConfig(data);
      }
    } catch (e) {
      console.error("Error loading appointment_sms_settings:", e);
    }
  };

  useEffect(() => {
    fetchPrices();
    fetchSmsSettings();
  }, []);

  // Group rows by Brand -> Model -> Category
  const groupedPrices = useMemo(() => {
    const map: Record<string, Record<string, Record<string, any>>> = {};
    dbPrices.forEach(item => {
      if (!map[item.brand]) map[item.brand] = {};
      if (!map[item.brand][item.model]) map[item.brand][item.model] = {};
      map[item.brand][item.model][item.category] = item;
    });
    return map;
  }, [dbPrices]);

  const modelsList = useMemo(() => {
    const modelsOfBrand = Object.keys(groupedPrices[selectedBrandFilter] || {});
    if (!modelSearchQuery.trim()) return modelsOfBrand;
    const q = modelSearchQuery.toLowerCase();
    return modelsOfBrand.filter(m => m.toLowerCase().includes(q));
  }, [groupedPrices, selectedBrandFilter, modelSearchQuery]);

  const startEditingModel = (modelName: string) => {
    setEditingModel(modelName);
    const modelCats = groupedPrices[selectedBrandFilter]?.[modelName] || {};
    const formValues: Record<string, { price: string; lcd?: string; oled?: string; oem?: string }> = {};
    
    const REPAIR_CATEGORIES = [
      "Screen", "Battery", "Charging Port", "Back Glass", "Back Camera Glass",
      "Back Camera", "Front Camera", "Earpiece / Loud Speaker", "Home Button",
      "Power / Volume Buttons", "Back Housing Frame", "Other"
    ];

    REPAIR_CATEGORIES.forEach(cat => {
      const item = modelCats[cat] || {};
      formValues[cat] = {
        price: item.price || '',
        lcd: item.lcd_price || '',
        oled: item.oled_price || '',
        oem: item.oem_price || ''
      };
    });
    setEditPricesForm(formValues);
  };

  const saveModelPrices = async () => {
    setIsSavingPrices(true);
    try {
      const modelCats = groupedPrices[selectedBrandFilter]?.[editingModel!] || {};
      const updates = Object.keys(editPricesForm).map(async (cat) => {
        const existingRow = modelCats[cat];
        const formValues = editPricesForm[cat];
        
        if (existingRow) {
          return supabase
            .from('repair_prices')
            .update({
              price: formValues.price,
              lcd_price: cat === 'Screen' ? formValues.lcd || null : null,
              oled_price: cat === 'Screen' ? formValues.oled || null : null,
              oem_price: cat === 'Screen' ? formValues.oem || null : null
            })
            .eq('id', existingRow.id);
        } else {
          return supabase
            .from('repair_prices')
            .insert({
              brand: selectedBrandFilter,
              model: editingModel!,
              category: cat,
              price: formValues.price,
              lcd_price: cat === 'Screen' ? formValues.lcd || null : null,
              oled_price: cat === 'Screen' ? formValues.oled || null : null,
              oem_price: cat === 'Screen' ? formValues.oem || null : null
            });
        }
      });

      await Promise.all(updates);
      await fetchPrices(); // refresh
      setEditingModel(null);
      alert(`Prices for ${editingModel} saved successfully!`);
    } catch (e) {
      console.error(e);
      alert("Error saving prices to database.");
    } finally {
      setIsSavingPrices(false);
    }
  };

  useEffect(() => {
    fetchCloverStatus();
  }, [cloverLocation]);

  const fetchCloverStatus = async () => {
    setIsLoadingClover(true);
    try {
      const { data } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('provider', `clover_${cloverLocation.toLowerCase()}`)
        .maybeSingle();
      
      if (data && data.is_connected) {
        setIsCloverConnected(true);
        setSelectedCloverDevice(data.selected_device_id || '');
        await fetchCloverDevices();
      } else {
        setIsCloverConnected(false);
        setSelectedCloverDevice('');
        setCloverDevices([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingClover(false);
    }
  };

  const connectManualToken = async () => {
    if (!manualToken.trim() || !manualMerchantId.trim()) {
      alert("Please enter both the API Token and Merchant ID.");
      return;
    }
    
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('clover-api', {
        body: { 
          action: 'save_manual_token', 
          access_token: manualToken.trim(), 
          merchant_id: manualMerchantId.trim(),
          location: cloverLocation.toLowerCase()
        }
      });
      
      if (data?.ok) {
        setIsCloverConnected(true);
        await fetchCloverDevices();
        setManualToken('');
        setManualMerchantId('');
      } else {
        alert("Failed to save and connect Clover credentials: " + (error?.message || data?.error));
      }
    } catch (e) {
      console.error(e);
      alert("Error connecting with manual Clover credentials.");
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchCloverDevices = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('clover-api', {
        body: { action: 'get_devices', location: cloverLocation.toLowerCase() }
      });
      if (data?.ok) {
        setCloverDevices(data.devices || []);
      } else {
         console.log("Failed to load devices", error || data);
      }
    } catch (e) {
      console.error('Failed to fetch devices:', e);
    } finally {
      setIsLoadingClover(false);
    }
  };

  const handleDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedCloverDevice(deviceId);
    
    // Save to DB
    const { error } = await supabase.functions.invoke('clover-api', {
      body: { action: 'save_device', device_id: deviceId, location: cloverLocation.toLowerCase() }
    });
    
    if (error) {
      console.error('Failed to save device selection:', error);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Shared classes for high-visibility inputs
  const inputClasses = "w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-all text-base";

  const handleSaveSmsSettings = async () => {
    setIsSavingSmsSettings(true);
    try {
      const loc = currentLocation || 'Beaumont';
      const { error } = await supabase
        .from('appointment_sms_settings')
        .upsert({
          ...smsConfig,
          location: loc,
          updated_at: new Date().toISOString()
        }, { onConflict: 'location' });

      if (error) {
        console.error("Failed to save SMS settings:", error);
        alert("Failed to save appointment SMS settings.");
      } else {
        alert("Appointment SMS Settings saved successfully!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSmsSettings(false);
    }
  };

  const getActiveTemplateKey = () => {
    switch (activeTemplateTab) {
      case 'immediate': return 'template_immediate_confirmation';
      case 'reminder_24h': return 'template_reminder_24h';
      case 'reminder_2h': return 'template_reminder_2h';
      case 'missed': return 'template_missed_appointment';
    }
  };

  const getActiveTemplateText = () => {
    return (smsConfig as any)[getActiveTemplateKey()] || '';
  };

  const updateActiveTemplateText = (text: string) => {
    const key = getActiveTemplateKey();
    setSmsConfig(prev => ({ ...prev, [key]: text }));
  };

  const insertPlaceholder = (tag: string) => {
    const currentText = getActiveTemplateText();
    updateActiveTemplateText(currentText + ' ' + tag);
  };

  const samplePreviewText = renderAppointmentTemplate(
    getActiveTemplateText(),
    {
      customer_name: 'Jane Doe',
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      issue: 'Screen Replacement',
      date: '2026-09-15',
      time_window: '10:00 AM - 11:00 AM'
    },
    form.address || '123 Main St, Beaumont TX'
  );

  return (
    <div className="max-w-4xl mx-auto h-full pb-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">System Settings</h2>
          <p className="text-slate-500">Manage your business profile, security, and integrations.</p>
        </div>
        <button
          onClick={onBack}
          className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 transition-colors"
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Business Profile */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Business Profile
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">Shop / Business Name</label>
              <input
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                className={inputClasses}
                placeholder="Elite Phone Repair"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Public Phone Number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className={inputClasses}
                placeholder="(409) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Shop Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className={inputClasses}
                placeholder="2215 Calder Ave STE 201..."
              />
            </div>
          </div>
        </div>

        {/* APPOINTMENT SMS AUTOMATIONS SECTION */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Appointment SMS Automations
            </h3>

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase border ${
                smsConfig.dry_run !== false
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-green-100 text-green-800 border-green-300'
              }`}>
                {smsConfig.dry_run !== false ? 'Dry-Run Mode (OFF)' : 'LIVE Mode (ON)'}
              </span>
              <button
                type="button"
                onClick={handleSaveSmsSettings}
                disabled={isSavingSmsSettings}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow transition-all"
              >
                {isSavingSmsSettings ? 'Saving...' : 'Save SMS Templates'}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Safety Mode & Quiet Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div>
                <label className="flex items-center justify-between font-bold text-slate-800 text-sm mb-1">
                  <span>Dry-Run Safety Mode</span>
                  <input
                    type="checkbox"
                    checked={smsConfig.dry_run !== false}
                    onChange={(e) => setSmsConfig(prev => ({ ...prev, dry_run: e.target.checked }))}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                </label>
                <p className="text-xs text-slate-500">
                  When enabled, reminder jobs are logged safely without contacting Twilio or real customers. Uncheck to activate live SMS sending.
                </p>
              </div>

              <div>
                <label className="flex items-center justify-between font-bold text-slate-800 text-sm mb-1">
                  <span>Quiet Hours Window (America/Chicago)</span>
                  <input
                    type="checkbox"
                    checked={smsConfig.quiet_hours_enabled !== false}
                    onChange={(e) => setSmsConfig(prev => ({ ...prev, quiet_hours_enabled: e.target.checked }))}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="time"
                    value={smsConfig.quiet_hours_start || '08:00'}
                    onChange={(e) => setSmsConfig(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                  <span className="text-xs font-bold text-slate-400">to</span>
                  <input
                    type="time"
                    value={smsConfig.quiet_hours_end || '22:00'}
                    onChange={(e) => setSmsConfig(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                  <span className="text-xs text-slate-500 font-medium ml-1">(Default 8am - 10pm)</span>
                </div>
              </div>
            </div>

            {/* Template Selector Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Editable Message Templates</label>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 mb-4 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTemplateTab('immediate')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTemplateTab === 'immediate' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Immediate Confirmation
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTemplateTab('reminder_24h')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTemplateTab === 'reminder_24h' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  24 Hours Before
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTemplateTab('reminder_2h')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTemplateTab === 'reminder_2h' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2 Hours Before
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTemplateTab('missed')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTemplateTab === 'missed' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Missed Appointment
                </button>
              </div>

              {/* Placeholder Helper Buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs font-bold text-slate-400 self-center">Insert Variable:</span>
                {['{{appointment_date}}', '{{appointment_time}}', '{{device}}', '{{repair_issue}}', '{{location_address}}'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertPlaceholder(tag)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold rounded-lg border border-slate-200 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Template Text Area */}
              <textarea
                rows={4}
                value={getActiveTemplateText()}
                onChange={(e) => updateActiveTemplateText(e.target.value)}
                className="w-full p-4 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />

              {/* Real-time Rendered Text Preview */}
              <div className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live SMS Customer Preview</span>
                  <span className="text-[10px] font-mono text-green-400">America/Chicago Timezone</span>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {samplePreviewText}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Repair Terms & Warranty */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Repair Terms & Ticket Footer
            </h3>
          </div>
          <div className="p-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">Warranty Disclaimer (appears on printed tickets)</label>
            <textarea
              name="warrantyTerms"
              value={form.warrantyTerms}
              onChange={handleChange}
              rows={4}
              className={inputClasses}
              placeholder="Ex: 90-day warranty on all screens. No warranty on water damage..."
            />
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Security Passwords
            </h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Kiosk Exit PIN</label>
              <input
                name="kioskPassword"
                type="text"
                value={form.kioskPassword}
                onChange={handleChange}
                className={`${inputClasses} font-mono text-xl`}
                placeholder="1271"
              />
              <p className="text-xs text-slate-500 mt-1">PIN required to exit Customer Check-In Kiosk mode.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Analytics Password</label>
              <input
                name="analyticsPassword"
                type="text"
                value={form.analyticsPassword || 'TILEE'}
                onChange={handleChange}
                className={`${inputClasses} font-mono text-xl uppercase`}
                placeholder="TILEE"
              />
              <p className="text-xs text-slate-500 mt-1">Password required to unlock Shop Analytics & Reports.</p>
            </div>
          </div>
        </div>

        {/* Clover Integration */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Clover Payments Integration
            </h3>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-slate-700">Location:</label>
              <select
                value={cloverLocation}
                onChange={(e) => setCloverLocation(e.target.value)}
                className="px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm font-medium"
              >
                <option value="Beaumont">Beaumont</option>
                <option value="Houston">Houston</option>
              </select>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Connect your physical Clover devices to your CRM to stop double-entry. Clicking "Send to Clover" on a ticket will wake up the physical terminal.
            </p>
            
            {/* Connection Status Panel */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-800">Connection Status</p>
                {isLoadingClover ? (
                  <p className="text-sm text-slate-500">Checking...</p>
                ) : isCloverConnected ? (
                  <p className="text-sm text-green-600 font-bold flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span> Connected
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">Not Connected</p>
                )}
              </div>
              
              {!isLoadingClover && !isCloverConnected && (
                <div className="w-full mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Clover Merchant ID</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 transition-all text-sm font-mono"
                      placeholder="e.g. AB1C2D3E4F5G6"
                      value={manualMerchantId}
                      onChange={(e) => setManualMerchantId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Merchant API Token (REST Pay Display)</label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 transition-all text-sm font-mono"
                      placeholder="e.g. 1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={connectManualToken}
                    disabled={isConnecting}
                    className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? 'Connecting...' : 'Save & Connect'}
                  </button>
                </div>
              )}
            </div>

            {/* Device Selection (Only show if connected) */}
            {isCloverConnected && (
              <div className="bg-white p-4 border border-slate-200 rounded-xl space-y-2 mt-4">
                <label className="block text-sm font-bold text-slate-700">Select Register Terminal</label>
                <p className="text-xs text-slate-500 mb-2">Which physical Clover device should the CRM push transactions to by default?</p>
                <select
                  value={selectedCloverDevice}
                  onChange={handleDeviceChange}
                  className="w-full px-4 py-2 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 transition-all font-medium"
                >
                  <option value="" disabled>-- Select a Clover Terminal --</option>
                  {cloverDevices.length === 0 && <option value="" disabled>No physical devices found yet...</option>}
                  {cloverDevices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.name} {device.model ? `(${device.model})` : ''} - Serial: {device.serial}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Are you sure you want to disconnect Clover for ${cloverLocation}? You will need to re-authorize.`)) {
                      setIsCloverConnected(false);
                      setCloverDevices([]);
                      await supabase.from('integration_settings').update({ is_connected: false, access_token: null, selected_device_id: null }).eq('provider', `clover_${cloverLocation.toLowerCase()}`);
                    }
                  }}
                  className="mt-4 text-xs text-red-500 font-bold hover:underline"
                >
                  Disconnect Clover
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Repair Pricing Manager Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Instant Quote Pricing Manager
            </h3>
            
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => { setSelectedBrandFilter('Apple'); setEditingModel(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedBrandFilter === 'Apple' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Apple
              </button>
              <button
                type="button"
                onClick={() => { setSelectedBrandFilter('Samsung'); setEditingModel(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedBrandFilter === 'Samsung' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Samsung
              </button>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {dbPrices.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500 font-medium">Pricing database is empty or loading...</p>
                <p className="text-xs text-slate-400 mt-1">Please ensure the SQL migration script has been executed in the Supabase Editor.</p>
              </div>
            ) : (
              <>
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`Search ${selectedBrandFilter} models...`}
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Model Listing & Editor Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Models List */}
                  <div className="md:col-span-1 max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50">
                    {modelsList.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-400 font-medium">No models found</div>
                    ) : (
                      modelsList.map(model => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => startEditingModel(model)}
                          className={`w-full text-left px-4 py-3 text-sm font-bold transition-all flex justify-between items-center ${editingModel === model ? 'bg-red-50 text-red-600 border-l-4 border-red-600' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                          <span>{model}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Right Column: Model Category Price Form */}
                  <div className="md:col-span-2 border border-slate-200 rounded-xl p-5 bg-white min-h-[300px] flex flex-col justify-between">
                    {editingModel ? (
                      <div className="space-y-6">
                        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                          <h4 className="font-extrabold text-slate-800 text-base">Editing {editingModel} Prices</h4>
                          <span className="text-xs font-bold text-red-600 uppercase bg-red-50 px-2 py-1 rounded">Active</span>
                        </div>
                        
                        <div className="max-h-[350px] overflow-y-auto pr-2 space-y-4">
                          {Object.keys(editPricesForm).map(cat => (
                            <div key={cat} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                              <span className="block text-xs font-black tracking-wider text-slate-500 uppercase">{cat} Replacement</span>
                              
                              {cat === 'Screen' ? (
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Standard LCD</label>
                                    <input
                                      type="text"
                                      value={editPricesForm[cat].lcd || ''}
                                      onChange={(e) => setEditPricesForm(prev => ({
                                        ...prev,
                                        [cat]: { ...prev[cat], lcd: e.target.value }
                                      }))}
                                      className="w-full px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-red-500 text-sm font-bold"
                                      placeholder="e.g. $140"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Premium OLED</label>
                                    <input
                                      type="text"
                                      value={editPricesForm[cat].oled || ''}
                                      onChange={(e) => setEditPricesForm(prev => ({
                                        ...prev,
                                        [cat]: { ...prev[cat], oled: e.target.value }
                                      }))}
                                      className="w-full px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-red-500 text-sm font-bold"
                                      placeholder="e.g. $240"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Original 1-on-1</label>
                                    <input
                                      type="text"
                                      value={editPricesForm[cat].oem || ''}
                                      onChange={(e) => setEditPricesForm(prev => ({
                                        ...prev,
                                        [cat]: { ...prev[cat], oem: e.target.value }
                                      }))}
                                      className="w-full px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-red-500 text-sm font-bold"
                                      placeholder="e.g. $295"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Price</label>
                                  <input
                                    type="text"
                                    value={editPricesForm[cat].price}
                                    onChange={(e) => setEditPricesForm(prev => ({
                                      ...prev,
                                      [cat]: { ...prev[cat], price: e.target.value }
                                    }))}
                                    className="w-full max-w-[200px] px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-red-500 text-sm font-bold"
                                    placeholder="e.g. $85 or N/A"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex space-x-3 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={saveModelPrices}
                            disabled={isSavingPrices}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
                          >
                            {isSavingPrices ? 'Saving...' : `Save ${editingModel} Prices`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingModel(null)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-lg text-sm transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <p className="font-bold text-sm">Select a device model from the left column to edit its prices.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          type="submit"
          className={`w-full font-bold py-4 px-6 rounded-xl transition-all shadow-lg text-lg ${isSaved ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
        >
          {isSaved ? 'Settings Saved Successfully' : 'Save All Changes'}
        </button>
      </form>
    </div>
  );
};

export default SettingsView;
