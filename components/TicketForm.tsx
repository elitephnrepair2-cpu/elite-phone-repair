
import React, { useState, useEffect } from 'react';
import type { Customer, RepairTicket } from '../types';

interface TicketFormProps {
  customer: Customer;
  onSubmit: (ticketData: Omit<RepairTicket, 'id' | 'customer_id' | 'created_at' | 'location'>) => void;
  onCancel: () => void;
  initialData?: RepairTicket;
}

const TicketForm: React.FC<TicketFormProps> = ({ customer, onSubmit, onCancel, initialData }) => {
  const isEditMode = !!initialData;
  
  const [device, setDevice] = useState(initialData?.device || '');
  const [serial_number, setSerialNumber] = useState(initialData?.serial_number || '');
  const [problem_description, setProblemDescription] = useState(initialData?.problem_description || '');
  const [price, setPrice] = useState(initialData?.price?.toString() || '');
  const [is_paid, setIsPaid] = useState(initialData?.is_paid || false);
  const [heard_from, setHeardFrom] = useState(initialData?.heard_from || '');
  const [promo_code, setPromoCode] = useState(initialData?.promo_code || '');
  
  const [paymentOption, setPaymentOption] = useState('cash');
  const [otherPaymentText, setOtherPaymentText] = useState('');

  useEffect(() => {
    if (initialData?.payment_method) {
      const method = initialData.payment_method.toLowerCase();
      if (method === 'cash' || method === 'card') {
        setPaymentOption(method);
        setOtherPaymentText('');
      } else {
        setPaymentOption('other');
        setOtherPaymentText(initialData.payment_method);
      }
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device || !problem_description) {
        alert("Device and Problem Description are required.");
        return;
    }
    const priceAsNumber = price ? parseFloat(price) : null;
    const payment_method = paymentOption === 'other' ? otherPaymentText : paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1);
    
    onSubmit({ 
        device, 
        serial_number, 
        problem_description, 
        price: priceAsNumber, 
        payment_method, 
        is_paid,
        heard_from: heard_from || null,
        promo_code: promo_code || null
    });
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg max-w-4xl mx-auto border border-slate-200 animate-in fade-in duration-300">
      <h2 className="text-3xl font-bold text-slate-800 mb-2">{isEditMode ? 'Update Repair Ticket' : 'New Repair Ticket'}</h2>
      <p className="text-lg text-slate-600 mb-6">Customer: <span className="font-bold text-red-600">{customer.name}</span></p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Device Model *</label>
            <input
              type="text"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none shadow-sm"
              placeholder="e.g., iPhone 15 Pro Max"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Serial Number / IMEI</label>
            <input
              type="text"
              value={serial_number}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none shadow-sm"
              placeholder="e.g., IMEI: 35..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Reported Issue *</label>
          <textarea
            value={problem_description}
            onChange={(e) => setProblemDescription(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none shadow-sm"
            rows={3}
            placeholder="Describe the problem in detail..."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Repair Cost ($)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none shadow-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Payment Status</label>
            <div 
              onClick={() => setIsPaid(!is_paid)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${is_paid ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'}`}
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center border-2 ${is_paid ? 'bg-green-600 border-green-600' : 'border-slate-300'}`}>
                 {is_paid && <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </div>
              <span className={`font-bold ${is_paid ? 'text-green-700' : 'text-slate-500'}`}>{is_paid ? 'Customer Paid' : 'Not Paid Yet'}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl hover:bg-slate-300 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-red-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-red-700 shadow-lg active:scale-95 transition-all"
          >
            {isEditMode ? 'Update Ticket' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TicketForm;
