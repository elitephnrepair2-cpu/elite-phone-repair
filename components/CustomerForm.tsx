

import React, { useState, useEffect } from 'react';
import type { Customer } from '../types';

interface CustomerFormProps {
  // FIX: Updated the type to not require `created_at` and be compatible with both create and update handlers.
  onSave: (customer: Partial<Omit<Customer, 'id' | 'created_at'>>) => void;
  onCancel: () => void;
  initialData?: Customer;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ onSave, onCancel, initialData }) => {
  const isEditMode = !!initialData;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alt_phone, setAltPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sms_subscribed, setSmsSubscribed] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPhone(initialData.phone);
      setAltPhone(initialData.alt_phone || '');
      setEmail(initialData.email || '');
      // Subscribed if either is true (usually they will be synced now)
      setSmsSubscribed(!!initialData.marketing_sms_consent || !!initialData.transactional_sms_consent);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
        alert("Name and Phone are required.");
        return;
    }

    let ip = 'unknown';
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ip = data.ip;
    } catch (err) {
      console.warn("Could not capture IP address:", err);
    }

    onSave({ 
      name, 
      phone, 
      alt_phone, 
      email, 
      marketing_sms_consent: sms_subscribed, 
      transactional_sms_consent: sms_subscribed,
      consent_source: 'manual',
      consent_method: 'checkbox',
      consent_ip: ip,
      consent_form_version: 'v1.0'
    });
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-base font-semibold text-slate-800 mb-2">Full Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-base font-semibold text-slate-800 mb-2">Phone Number *</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            <div>
              <label htmlFor="alt_phone" className="block text-base font-semibold text-slate-800 mb-2">Alternate Phone</label>
              <input
                id="alt_phone"
                type="tel"
                value={alt_phone}
                onChange={(e) => setAltPhone(e.target.value)}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
        </div>
        <div>
          <label htmlFor="email" className="block text-base font-semibold text-slate-800 mb-2">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start gap-3">
            <input
              id="sms_subscribed"
              type="checkbox"
              checked={sms_subscribed}
              onChange={(e) => setSmsSubscribed(e.target.checked)}
              className="mt-1 w-5 h-5 text-red-600 border-slate-400 rounded focus:ring-red-500 cursor-pointer"
            />
            <div className="space-y-1">
              <label htmlFor="sms_subscribed" className="text-sm font-bold text-slate-800 leading-tight cursor-pointer">
                Subscribe to SMS Updates & Marketing
              </label>
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ <strong>Technician Action Required:</strong> Please verbally ask the customer for consent to receive both service updates and promotional texts before checking this box.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors shadow-md"
          >
            {isEditMode ? 'Update Customer' : 'Save Customer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerForm;