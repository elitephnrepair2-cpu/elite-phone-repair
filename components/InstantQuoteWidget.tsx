import React, { useState, useMemo } from 'react';
import { REPAIR_PRICES } from '../constants/prices';

const InstantQuoteWidget: React.FC = () => {
  const [selectedBrand, setSelectedBrand] = useState<string>('Apple');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<string>('Screen');

  const availableBrands = Object.keys(REPAIR_PRICES);
  const availableModels = selectedBrand ? Object.keys(REPAIR_PRICES[selectedBrand] || {}) : [];
  
  const estimatedPrice = useMemo(() => {
    if (!selectedBrand || !selectedModel || !selectedIssue) return null;
    const priceStr = REPAIR_PRICES[selectedBrand]?.[selectedModel]?.[selectedIssue];
    return priceStr || 'N/A';
  }, [selectedBrand, selectedModel, selectedIssue]);

  const issues = [
    { id: 'Screen', label: 'Cracked Screen', icon: (
      <svg className="w-8 h-8 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z M9 4l6 6-6 6" />
      </svg>
    )},
    { id: 'Battery', label: 'Battery Issues', icon: (
      <svg className="w-8 h-8 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16v4H4v-4z M20 11h2v2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14V10M14 14V10" />
      </svg>
    )},
    { id: 'Charging Port', label: 'Charging Port', icon: (
      <svg className="w-8 h-8 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v8l9-11h-7z" />
      </svg>
    )},
    { id: 'Back Camera', label: 'Camera Issues', icon: (
      <svg className="w-8 h-8 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { id: 'Earpiece / Loud Speaker', label: 'Speaker Issues', icon: (
      <svg className="w-8 h-8 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    )},
    { id: 'Other', label: 'Other Issue', icon: (
      <svg className="w-8 h-8 mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    )}
  ];

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="max-w-6xl w-full bg-[#f4f2ee] p-8 md:p-12 relative overflow-hidden" style={{
        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.05)',
        border: '8px solid white',
      }}>
        
        {/* Grunge/Texture Overlay (subtle) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}></div>

        {/* Header */}
        <div className="text-center relative z-10 mb-12">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-[#111]">
            Get Your <span className="text-[#e21a22] italic">Instant Quote</span>
          </h1>
          <p className="mt-2 text-lg text-gray-700 font-medium">Just answer a few quick questions and see your price!</p>
        </div>

        {/* Progress Bar (Desktop mostly) */}
        <div className="hidden md:flex justify-between items-center max-w-3xl mx-auto mb-16 relative z-10">
          <div className="absolute left-[15%] right-[15%] top-5 h-[2px] bg-gray-300 -z-10"></div>
          <div className="absolute left-[15%] w-[35%] top-5 h-[2px] bg-[#e21a22] -z-10 transition-all duration-500"></div>

          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-[3px] border-[#f4f2ee] ${true ? 'bg-[#e21a22] text-white shadow-md' : 'bg-gray-300 text-gray-600'}`}>1</div>
            <span className={`mt-3 font-bold text-sm tracking-widest ${true ? 'text-[#e21a22]' : 'text-gray-400'}`}>SELECT DEVICE</span>
          </div>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-[3px] border-[#f4f2ee] ${selectedModel ? 'bg-[#e21a22] text-white shadow-md' : 'bg-gray-300 text-white'}`}>2</div>
            <span className={`mt-3 font-bold text-sm tracking-widest ${selectedModel ? 'text-[#e21a22]' : 'text-gray-400'}`}>SELECT ISSUE</span>
          </div>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-[3px] border-[#f4f2ee] ${selectedModel && selectedIssue ? 'bg-gray-400 text-white shadow-md' : 'bg-gray-300 text-white'}`}>3</div>
            <span className="mt-3 font-bold text-sm tracking-widest text-gray-400">GET QUOTE</span>
          </div>
        </div>

        {/* 3 Columns Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
          
          {/* Column 1: Select Device */}
          <div className="flex flex-col">
            <h2 className="text-xl font-bold uppercase tracking-wider mb-6 text-center lg:text-left">1. Select Your Device</h2>
            <div className="space-y-4">
              {/* Brand Dropdown */}
              <div className="relative">
                <select 
                  className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-5 py-4 text-lg font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e21a22] focus:border-transparent cursor-pointer"
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setSelectedModel('');
                    setSelectedIssue('Screen');
                  }}
                >
                  {availableBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                {/* Brand icon placeholder */}
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                  {selectedBrand === 'Apple' ? (
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.74 3.53-.78 1.48-.04 2.5.54 3.2 1.41-2.92 1.63-2.39 5.86.6 6.94-.65 1.67-1.48 3.51-2.41 4.6m-3.41-14.8c-.14-1.63 1.35-3.21 2.92-3.48.33 1.84-1.39 3.26-2.92 3.48"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  )}
                </div>
              </div>

              {/* Model Dropdown */}
              <div className="relative">
                <select 
                  className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-5 py-4 pl-12 text-lg font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e21a22] focus:border-transparent cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!selectedBrand}
                >
                  <option value="" disabled>Select Model</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: What's the Issue */}
          <div className="flex flex-col border-t lg:border-t-0 lg:border-l lg:border-r border-gray-300 pt-8 lg:pt-0 lg:px-8 mt-4 lg:mt-0">
            <h2 className="text-xl font-bold uppercase tracking-wider mb-6 text-center lg:text-left">2. What's the Issue?</h2>
            <div className="grid grid-cols-2 gap-3">
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  disabled={!selectedModel}
                  onClick={() => setSelectedIssue(issue.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                    !selectedModel ? 'opacity-50 cursor-not-allowed bg-white border-gray-200 text-gray-400' :
                    selectedIssue === issue.id
                      ? 'border-[#e21a22] bg-red-50 text-gray-900 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className={`${selectedIssue === issue.id ? 'text-[#e21a22]' : 'text-gray-500'}`}>
                    {issue.icon}
                  </div>
                  <span className={`text-sm font-bold text-center ${selectedIssue === issue.id ? 'text-gray-900' : 'text-gray-700'}`}>
                    {issue.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Column 3: Instant Quote */}
          <div className="flex flex-col pt-8 lg:pt-0 mt-4 lg:mt-0">
            <h2 className="text-xl font-bold uppercase tracking-wider mb-6 text-center lg:text-left">3. Your Instant Quote</h2>
            
            <div className="bg-[#111] rounded-2xl p-6 text-white shadow-xl flex flex-col items-center relative overflow-hidden">
              <span className="text-sm font-bold tracking-widest text-gray-400 mt-2">ESTIMATED PRICE</span>
              
              <div className="flex items-center justify-center gap-3 mt-4 mb-6">
                <svg className="w-12 h-12 text-[#e21a22]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                </svg>
                <span className="text-6xl font-black tracking-tighter">
                  {estimatedPrice ? estimatedPrice : '---'}
                </span>
              </div>
              
              <p className="text-sm font-medium mb-1">Most repairs done in</p>
              <p className="text-[#e21a22] font-bold mb-8">under 1 hour!</p>

              <button className="w-full bg-[#e21a22] hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-colors mb-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                CALL NOW TO BOOK
              </button>
              
              <button className="w-full bg-white hover:bg-gray-100 text-[#111] font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                TEXT US INSTEAD
              </button>
            </div>
          </div>

        </div>

        {/* Footer Disclaimer */}
        <div className="mt-12 text-center text-sm font-medium text-gray-500 relative z-10 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          Prices are estimates. Final price may vary after diagnosis.
        </div>

      </div>
    </div>
  );
};

export default InstantQuoteWidget;
