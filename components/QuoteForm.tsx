

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Quote } from '../types';

interface QuoteFormProps {
  onSaved: (quote: Quote) => void;
  onCancel: () => void;
  initialData?: Quote | null;
  currentLocation?: string;
}

const issueOptions = [
  "Screen Damage",
  "Battery",
  "Charging Port",
  "Back Glass",
  "Camera",
  "Speaker / Mic",
  "Water Damage",
  "Other",
];

const statusOptions = [
  "new",
  "contacted",
  "scheduled",
  "approved",
  "declined",
  "closed"
];

const QuoteForm: React.FC<QuoteFormProps> = ({ onSaved, onCancel, initialData, currentLocation }) => {
  const isEditMode = !!initialData;

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    brand: "",
    model: "",
    issue: "",
    notes: "",
    price: "",
    status: "new"
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setForm({
        customer_name: initialData.customer_name || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        brand: initialData.brand || "",
        model: initialData.model || "",
        issue: initialData.issue || "",
        notes: initialData.notes || "",
        price: initialData.price ? String(initialData.price) : "",
        status: initialData.status || "new",
      });
    }
  }, [initialData]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      customer_name: form.customer_name || null,
      phone: form.phone || null,
      email: form.email || null,
      brand: form.brand || null,
      model: form.model || null,
      issue: form.issue || null,
      notes: form.notes || null,
      is_manual: true,
      status: form.status,
      price: form.price ? Number(form.price) : null,
      location: currentLocation || 'Beaumont'
    };

    let data, error;

    if (isEditMode && initialData) {
        // Update existing quote
        const response = await supabase
            .from("quotes")
            .update(payload)
            .eq('id', initialData.id)
            .select()
            .single();
        data = response.data;
        error = response.error;
    } else {
        // Insert new quote
        const response = await supabase
            .from("quotes")
            .insert([payload])
            .select()
            .single();
        data = response.data;
        error = response.error;
    }

    if (error) {
      console.error(error);
      alert(`Error saving quote: ${error.message}`);
      setMessage(`Error saving quote: ${error.message}`);
    } else {
      setMessage("Quote saved successfully.");
      if (!isEditMode) {
          setForm({
            customer_name: "",
            phone: "",
            email: "",
            brand: "",
            model: "",
            issue: "",
            notes: "",
            price: "",
            status: "new"
          });
      }
      if (onSaved && data) onSaved(data);
    }

    setLoading(false);
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">{isEditMode ? 'Edit Quote' : 'Create New Quote'}</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Customer Name</label>
            <input
              name="customer_name"
              value={form.customer_name}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Full Name"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Phone</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="email@example.com"
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-base font-semibold text-slate-800 mb-2">Brand</label>
                <select 
                    name="brand" 
                    value={form.brand} 
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                    <option value="">Select brand</option>
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Google">Google</option>
                    <option value="Motorola">Motorola</option>
                    <option value="LG">LG</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div>
                <label className="block text-base font-semibold text-slate-800 mb-2">Model</label>
                <input
                    name="model"
                    placeholder="e.g. iPhone 12, Galaxy S21"
                    value={form.model}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
            </div>
        </div>

        <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Issue</label>
            <select 
                name="issue" 
                value={form.issue} 
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
                <option value="">Select issue</option>
                {issueOptions.map((opt) => (
                    <option key={opt} value={opt}>
                    {opt}
                    </option>
                ))}
            </select>
        </div>

        <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Notes</label>
            <textarea
                name="notes"
                rows={3}
                placeholder="Ex: green lines on screen, doesn’t charge unless I wiggle cable..."
                value={form.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Price ($)</label>
                <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="0.00"
                />
            </div>
        </div>

        <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Status</label>
            <select 
                name="status" 
                value={form.status} 
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 capitalize"
            >
                {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                    {opt}
                    </option>
                ))}
            </select>
        </div>

        {message && <p className={`text-center font-semibold ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}

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
                disabled={loading}
                className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors shadow-md disabled:bg-red-400"
            >
                {loading ? "Saving..." : (isEditMode ? "Save Changes" : "Save Quote")}
            </button>
        </div>
      </form>
    </div>
  );
}

export default QuoteForm;