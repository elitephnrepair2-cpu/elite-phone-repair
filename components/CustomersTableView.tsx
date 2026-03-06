import React, { useState, useMemo } from 'react';
import type { Customer } from '../types';

interface CustomersTableViewProps {
    customers: Customer[];
    onSelectCustomer: (customerId: string) => void;
    onAddNew: () => void;
}

const CustomersTableView: React.FC<CustomersTableViewProps> = ({ customers, onSelectCustomer, onAddNew }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCustomers = useMemo(() => {
        const raw = searchTerm.trim().toLowerCase();
        const sDigits = raw.replace(/\\D/g, "");

        return customers.filter(customer => {
            const name = (customer.name ?? "").toLowerCase();
            const phoneDigits = (customer.phone ?? "").replace(/\\D/g, "");
            const email = (customer.email ?? "").toLowerCase();

            return name.includes(raw) || phoneDigits.includes(sDigits) || email.includes(raw);
        });
    }, [customers, searchTerm]);

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">All Customers</h2>
                    <p className="text-slate-500">Total: {customers.length} records</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[300px]">
                        <input
                            type="search"
                            placeholder="Search by name, phone, or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button
                        onClick={onAddNew}
                        className="whitespace-nowrap bg-red-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-700 transition-colors flex items-center shadow-md justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add Customer
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-sm uppercase tracking-wider font-bold">
                            <th className="p-4">Name</th>
                            <th className="p-4 hidden sm:table-cell">Phone</th>
                            <th className="p-4 hidden md:table-cell">Email</th>
                            <th className="p-4 hidden lg:table-cell">SMS Marketing</th>
                            <th className="p-4 text-right">Added</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(customer => (
                                <tr
                                    key={customer.id}
                                    onClick={() => onSelectCustomer(customer.id)}
                                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                                >
                                    <td className="p-4">
                                        <p className="font-bold text-slate-800 flex items-center gap-2">
                                            {customer.name}
                                        </p>
                                        <p className="text-sm text-slate-500 sm:hidden mt-1">{customer.phone}</p>
                                    </td>
                                    <td className="p-4 hidden sm:table-cell text-slate-600">{customer.phone}</td>
                                    <td className="p-4 hidden md:table-cell text-slate-600">{customer.email || '-'}</td>
                                    <td className="p-4 hidden lg:table-cell">
                                        {customer.marketing_sms_consent ? (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold uppercase">Consented</span>
                                        ) : (
                                            <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold uppercase">No</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right text-slate-500 font-medium">
                                        {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}
                                        <div className="text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold uppercase mt-1">View Profile &rarr;</div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                                    No customers found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default CustomersTableView;
