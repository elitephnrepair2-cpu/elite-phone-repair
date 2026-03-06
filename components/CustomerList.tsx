
import React, { useRef, useState, useMemo, useEffect } from 'react';
import type { Customer, ImportedRow } from '../types';

declare var XLSX: any;

interface CustomerListProps {
  customers: Customer[];
  selectedCustomerId: string | undefined;
  onSelectCustomer: (customer: Customer) => void;
  onAddNew: () => void;
  onImportData: (data: ImportedRow[]) => void;
  onExportData: () => void;
  onDeleteCustomer: (customerId: string) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ customers, selectedCustomerId, onSelectCustomer, onAddNew, onDeleteCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(''); 
  const [isOlderExpanded, setIsOlderExpanded] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchTerm || filterDate) {
      setIsOlderExpanded(true);
    }
  }, [searchTerm, filterDate]);

// ...keep all your imports + component setup the same

  const filteredCustomers = useMemo(() => {
    let result = customers;

    // Date filter (unchanged, just a little safer)
    if (filterDate) {
      result = result.filter((customer) => {
        if (!customer.created_at) return false;
        return customer.created_at.startsWith(filterDate);
      });
    }

    // ✅ Improved search (case-insensitive + trims + phone normalization + null-safe)
    const raw = searchTerm.trim();
    if (raw) {
      const s = raw.toLowerCase();
      const sDigits = raw.replace(/\D/g, ""); // only numbers from what user typed

      result = result.filter((customer) => {
        const name = (customer.name ?? "").trim().toLowerCase();
        const phone = (customer.phone ?? "");
        const phoneDigits = phone.replace(/\D/g, "");

        // Match by name OR phone (digits-only match)
        const nameMatch = name.includes(s);
        const phoneMatch = sDigits ? phoneDigits.includes(sDigits) : false;

        return nameMatch || phoneMatch;
      });
    }

    return result;
  }, [customers, searchTerm, filterDate]);

// ...keep the rest of your file the same

  const groupedCustomers = useMemo(() => {
    const groups: { today: Customer[], yesterday: Customer[], older: Customer[] } = {
      today: [],
      yesterday: [],
      older: [],
    };

    if (filterDate) {
      groups.older = filteredCustomers;
      return groups;
    }

    const today = new Date().toISOString().split('T')[0];
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterday = yest.toISOString().split('T')[0];

    filteredCustomers.forEach(customer => {
      if (!customer.created_at) {
        groups.older.push(customer);
        return;
      }
      const cDate = customer.created_at.split('T')[0];

      if (cDate === today) groups.today.push(customer);
      else if (cDate === yesterday) groups.yesterday.push(customer);
      else groups.older.push(customer);
    });

    return groups;
  }, [filteredCustomers, filterDate]);

  const handleDateTrigger = () => {
    if (dateInputRef.current) {
      try {
        // This opens the native calendar popup immediately
        dateInputRef.current.showPicker();
      } catch (e) {
        dateInputRef.current.click();
      }
    }
  };

  const renderCustomerList = (customerList: Customer[]) => (
    <ul className="space-y-2">
      {customerList.map((customer) => (
        <li
          key={customer.id}
          onClick={() => onSelectCustomer(customer)}
          className={`p-4 rounded-lg cursor-pointer transition-all duration-200 flex justify-between items-center border ${
            selectedCustomerId === customer.id
              ? 'bg-red-600 text-white shadow-lg border-red-700 scale-[1.02]'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-lg truncate">{customer.name}</p>
              {customer.marketing_sms_consent && (
                <span 
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    selectedCustomerId === customer.id ? 'bg-white text-red-600' : 'bg-green-100 text-green-700'
                  }`}
                  title="Consented to Marketing"
                >
                  SMS
                </span>
              )}
            </div>
            <p className={`text-sm ${selectedCustomerId === customer.id ? 'text-red-100' : 'text-slate-500'}`}>{customer.phone}</p>
          </div>
          <button
              onClick={(e) => { e.stopPropagation(); onDeleteCustomer(customer.id); }}
              className={`p-2 rounded-full transition-colors ml-2 ${selectedCustomerId === customer.id ? 'hover:bg-red-500' : 'hover:bg-red-100 text-slate-400 hover:text-red-600'}`}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
          </button>
        </li>
      ))}
    </ul>
  );
  
  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg h-full flex flex-col lg:max-h-[calc(100vh-6rem)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Customers</h2>
        <button
          onClick={onAddNew}
          className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center shadow-md text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add New
        </button>
      </div>

      <div className="mb-4 space-y-2">
        <div className="relative">
          <input
            type="search"
            placeholder="Search name/phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        <div className="flex gap-2">
          <div 
            onClick={handleDateTrigger}
            className={`flex-grow relative bg-slate-50 border ${filterDate ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-300'} rounded-xl px-4 py-2.5 flex items-center cursor-pointer hover:bg-slate-100 transition-all`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-3 ${filterDate ? 'text-red-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm font-bold flex-grow ${filterDate ? 'text-slate-800' : 'text-slate-500'}`}>
              {filterDate ? new Date(filterDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Filter by Date'}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          {filterDate && (
            <button 
              onClick={() => setFilterDate('')} 
              className="px-3 bg-slate-100 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Clear date filter"
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
        {filteredCustomers.length > 0 ? (
            <div className="space-y-6">
                {!filterDate && groupedCustomers.today.length > 0 && (
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                          <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2"></span>
                          Today
                        </h3>
                        {renderCustomerList(groupedCustomers.today)}
                    </div>
                )}
                {!filterDate && groupedCustomers.yesterday.length > 0 && (
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Yesterday</h3>
                        {renderCustomerList(groupedCustomers.yesterday)}
                    </div>
                )}
                {groupedCustomers.older.length > 0 && (
                    <div>
                        <div className="flex justify-between items-center cursor-pointer mb-3 group" onClick={() => setIsOlderExpanded(!isOlderExpanded)}>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600">
                              {filterDate ? `Results for ${new Date(filterDate + 'T00:00:00').toLocaleDateString()}` : `Earlier Records (${groupedCustomers.older.length})`}
                            </h3>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transform transition-transform ${isOlderExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        {isOlderExpanded && renderCustomerList(groupedCustomers.older)}
                    </div>
                )}
            </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 italic">No customers found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default CustomerList;
