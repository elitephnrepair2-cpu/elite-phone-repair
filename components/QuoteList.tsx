

import React, { useMemo, useState } from 'react';
import type { Quote } from '../types';

interface QuoteListProps {
  quotes: Quote[];
  onCreateNew: () => void;
  onEdit: (quote: Quote) => void;
  onDelete: (id: string) => void;
}

const QuoteList: React.FC<QuoteListProps> = ({ quotes, onCreateNew, onEdit, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQuotes = useMemo(() => {
    if (!searchTerm) return quotes;
    const lowerSearch = searchTerm.toLowerCase();
    return quotes.filter(q => 
        (q.customer_name?.toLowerCase().includes(lowerSearch)) ||
        (q.email?.toLowerCase().includes(lowerSearch)) ||
        (q.phone?.includes(lowerSearch)) ||
        (q.brand?.toLowerCase().includes(lowerSearch)) ||
        (q.model?.toLowerCase().includes(lowerSearch))
    );
  }, [quotes, searchTerm]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(window.confirm("Are you sure you want to delete this quote?")) {
          onDelete(id);
      }
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Quotes</h2>
        <button
          onClick={onCreateNew}
          className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center shadow-md"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            New Quote
        </button>
      </div>

      <div className="mb-6 relative max-w-md">
        <input
          type="search"
          placeholder="Search quotes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {filteredQuotes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
                <th className="p-3 rounded-tl-lg">Created At</th>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Brand</th>
                <th className="p-3">Model</th>
                <th className="p-3">Issue</th>
                <th className="p-3">Price</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.map((quote) => (
                <tr 
                  key={quote.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onEdit(quote)}
                >
                  <td className="p-3 text-slate-500 text-sm">
                    {new Date(quote.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 font-semibold text-slate-800">
                    {quote.customer_name || 'Unknown'}
                  </td>
                  <td className="p-3 text-slate-600">
                    {quote.email || '-'}
                  </td>
                  <td className="p-3 text-slate-600">
                    {quote.phone || '-'}
                  </td>
                  <td className="p-3 text-slate-700">
                    {quote.brand || '-'}
                  </td>
                  <td className="p-3 text-slate-700">
                    {quote.model || '-'}
                  </td>
                   <td className="p-3 text-slate-700 truncate max-w-xs" title={quote.issue || ''}>
                    {quote.issue || '-'}
                  </td>
                  <td className="p-3 text-slate-700 font-medium">
                     {quote.price ? `$${quote.price}` : 'N/A'}
                  </td>
                   <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        quote.status === 'new' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                        {quote.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button 
                        onClick={(e) => handleDelete(e, quote.id)}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete Quote"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-500">
          <p>No quotes found.</p>
        </div>
      )}
    </div>
  );
};

export default QuoteList;