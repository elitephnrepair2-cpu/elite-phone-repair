import React, { useState, useMemo } from 'react';
import { REPAIR_PRICES } from '../constants/prices';
import { 
  Phone, Smartphone, ChevronDown, ShieldCheck, 
  Menu, Timer, Tag, Clock, ThumbsUp, Calculator, 
  Wrench, Star, MapPin, MessageCircle, ArrowRight
} from 'lucide-react';
import { track } from '@vercel/analytics';

interface InstantQuoteWidgetProps {
  isInternal?: boolean;
}

const InstantQuoteWidget: React.FC<InstantQuoteWidgetProps> = ({ isInternal = false }) => {
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<string>('');

  const availableBrands = [...Object.keys(REPAIR_PRICES), 'Other'];
  const availableModels = selectedBrand === 'Other' ? ['Unknown / Other Model'] : (selectedBrand ? Object.keys(REPAIR_PRICES[selectedBrand] || {}) : []);
  
  const estimatedPrice = useMemo(() => {
    if (selectedBrand === 'Other') return 'Call Us';
    if (!selectedBrand || !selectedModel || !selectedIssue) return null;
    return REPAIR_PRICES[selectedBrand]?.[selectedModel]?.[selectedIssue] || 'N/A';
  }, [selectedBrand, selectedModel, selectedIssue]);

  const handleNext = () => {
    if (step === 1 && selectedBrand && selectedModel) setStep(2);
    else if (step === 2 && selectedIssue) setStep(3);
  };

  React.useEffect(() => {
    if (step === 3) {
      if (typeof window !== 'undefined' && (window as any).ttq) {
        const numericPrice = estimatedPrice ? parseFloat(estimatedPrice.replace(/[^0-9.]/g, '')) : 0;
        (window as any).ttq.track('ViewContent', {
          content_name: 'Instant Quote',
          value: isNaN(numericPrice) ? 0 : numericPrice,
          currency: 'USD'
        }, {
          test_event_code: 'TEST35714'
        });
      }
    }
  }, [step, estimatedPrice]);

  return (
    <div className={`bg-black min-h-screen text-white font-sans ${isInternal ? '' : 'pb-24'}`}>
      {/* Top Header */}
      {!isInternal && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-black sticky top-0 z-50">
          <div className="flex items-center">
            {/* Logo */}
            <img src="/logo.png" alt="Elite Phone Repair Logo" className="h-12 w-auto bg-white rounded-md p-0.5 shadow-sm" />
          </div>
          <div className="flex items-center gap-3">
            <a href="tel:7134716760" onClick={() => {
              track('Top Header Call Button Clicked');
              if (typeof window !== 'undefined' && (window as any).ttq) {
                (window as any).ttq.track('Contact', {}, { test_event_code: 'TEST35714' });
              }
            }} className="bg-[#e21a22] text-white flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs shadow-md">
              <Phone className="w-5 h-5 fill-current" />
              <div className="flex flex-col text-left leading-none tracking-tight">
                <span className="text-[9px] mb-0.5">CALL / TEXT</span>
                <span className="text-[11px]">(713) 471-6760</span>
              </div>
            </a>
            <button className="p-1">
              <Menu className="w-8 h-8" />
            </button>
          </div>
        </header>
      )}

      {/* Hero Section */}
      <section className="relative px-4 py-8 overflow-hidden">
        {/* Red Grunge bg effect */}
        <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, #e21a22 0%, transparent 60%)' }}></div>
        
        <div className="relative z-10 flex flex-col">
          <div className="inline-block bg-[#e21a22] text-white font-black italic px-3 py-1 text-sm transform -skew-x-12 w-max mb-2">
            <span className="transform skew-x-12 block">GET IT FIXED TODAY.</span>
          </div>
          <h1 className="text-5xl font-black italic uppercase leading-[0.9] tracking-tighter mb-3">
            INSTANT QUOTE<br/>
            <span className="text-[#e21a22]">IN SECONDS.</span>
          </h1>
          <div className="flex items-center gap-2 text-sm font-bold italic tracking-wide text-gray-200">
            <span>FAST.</span>
            <span>AFFORDABLE.</span>
            <span>TRUSTED.</span>
          </div>
          <div className="text-[#e21a22] font-black italic mt-1 flex items-center">
            <div className="w-8 h-[2px] bg-[#e21a22] mr-2"></div>
            WE GOT YOU.
            <div className="w-16 h-[2px] bg-[#e21a22] ml-2"></div>
          </div>
        </div>
        
        {/* Phone Image Placeholder */}
        <div className="absolute -right-8 -bottom-4 w-48 h-64 pointer-events-none opacity-90 rotate-12">
           <img src="https://images.unsplash.com/photo-1592839719941-8e2651039d01?w=400&q=80" alt="Cracked phone" className="rounded-[2rem] border-[6px] border-gray-400 shadow-2xl object-cover h-full w-full" style={{filter: 'grayscale(30%) brightness(0.9)'}} />
        </div>
      </section>

      {/* Features Row */}
      <section className="px-4 py-4">
        <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar">
          {/* Feature 1 */}
          <div className="min-w-[110px] flex-shrink-0 border border-gray-800 rounded-xl p-3 flex flex-col items-center text-center snap-center bg-black/50">
            <Timer className="w-8 h-8 text-[#e21a22] mb-2" />
            <span className="font-black text-[11px] uppercase leading-tight mb-1">Same-Day<br/>Repairs</span>
            <span className="text-[10px] text-gray-400">Walk in. Walk out.</span>
          </div>
          {/* Feature 2 */}
          <div className="min-w-[110px] flex-shrink-0 border border-gray-800 rounded-xl p-3 flex flex-col items-center text-center snap-center bg-black/50">
            <ShieldCheck className="w-8 h-8 text-[#e21a22] mb-2" />
            <span className="font-black text-[11px] uppercase leading-tight mb-1">Lifetime<br/>Warranty*</span>
            <span className="text-[10px] text-gray-400">We stand on<br/>our work.</span>
          </div>
          {/* Feature 3 */}
          <div className="min-w-[110px] flex-shrink-0 border border-gray-800 rounded-xl p-3 flex flex-col items-center text-center snap-center bg-black/50">
            <Tag className="w-8 h-8 text-[#e21a22] mb-2" />
            <span className="font-black text-[11px] uppercase leading-tight mb-1">Fair Prices</span>
            <span className="text-[10px] text-gray-400">No hidden<br/>fees.</span>
          </div>
           {/* Feature 4 */}
           <div className="min-w-[110px] flex-shrink-0 border border-gray-800 rounded-xl p-3 flex flex-col items-center text-center snap-center bg-black/50">
            <Clock className="w-8 h-8 text-[#e21a22] mb-2" />
            <span className="font-black text-[11px] uppercase leading-tight mb-1">Most Repairs<br/>Under 1 Hour</span>
            <span className="text-[10px] text-gray-400">Fast, reliable,<br/>no long waits.</span>
          </div>
           {/* Feature 5 */}
           <div className="min-w-[110px] flex-shrink-0 border border-gray-800 rounded-xl p-3 flex flex-col items-center text-center snap-center bg-black/50">
            <ThumbsUp className="w-8 h-8 text-[#e21a22] mb-2" />
            <span className="font-black text-[11px] uppercase leading-tight mb-1">5-Star<br/>Service</span>
            <span className="text-[10px] text-gray-400">Honest work.<br/>Real results.</span>
          </div>
        </div>
      </section>

      {/* Main Quote Card */}
      <section className="px-4 mt-2">
        <div className="bg-[#f4f2ee] text-black rounded-2xl p-5 md:p-8 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black italic uppercase tracking-tight">
              GET YOUR <span className="text-[#e21a22]">INSTANT QUOTE</span>
            </h2>
            <p className="text-sm text-gray-700 mt-1 font-medium">Just answer a few quick questions and see your price!</p>
          </div>

          {/* Progress Bar */}
          <div className="flex justify-between items-center mb-8 relative px-2">
            <div className="absolute left-[15%] right-[15%] top-4 h-[2px] bg-gray-300 -z-10"></div>
            <div className={`absolute left-[15%] top-4 h-[2px] bg-[#e21a22] -z-10 transition-all duration-500`} style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '70%' }}></div>

            <div className="flex flex-col items-center w-1/3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border-2 border-[#f4f2ee] ${step >= 1 ? 'bg-[#e21a22] text-white' : 'bg-gray-300 text-white'}`}>1</div>
              <span className={`mt-2 font-bold text-[9px] tracking-wider text-center uppercase ${step >= 1 ? 'text-[#e21a22]' : 'text-gray-400'}`}>Select Device</span>
            </div>
            <div className="flex flex-col items-center w-1/3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border-2 border-[#f4f2ee] ${step >= 2 ? 'bg-[#e21a22] text-white' : 'bg-gray-300 text-white'}`}>2</div>
              <span className={`mt-2 font-bold text-[9px] tracking-wider text-center uppercase ${step >= 2 ? 'text-gray-500' : 'text-gray-400'}`}>Select Issue</span>
            </div>
            <div className="flex flex-col items-center w-1/3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border-2 border-[#f4f2ee] ${step >= 3 ? 'bg-[#e21a22] text-white' : 'bg-gray-300 text-white'}`}>3</div>
              <span className={`mt-2 font-bold text-[9px] tracking-wider text-center uppercase ${step >= 3 ? 'text-gray-500' : 'text-gray-400'}`}>Get Quote</span>
            </div>
          </div>

          {/* Step Content */}
          {step === 1 && (
            <div className="animate-in fade-in duration-300">
              <h3 className="font-bold uppercase tracking-wide mb-4 text-[15px]">1. SELECT YOUR DEVICE</h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                    <Smartphone className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <select 
                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl py-4 pl-12 pr-10 font-bold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e21a22]"
                    value={selectedBrand}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedBrand(val);
                      if (val === 'Other') {
                        setSelectedModel('Unknown / Other Model');
                      } else {
                        setSelectedModel('');
                      }
                    }}
                  >
                    <option value="" disabled>Select Device Type</option>
                    {availableBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-800">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                    <Smartphone className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <select 
                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl py-4 pl-12 pr-10 font-bold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e21a22] disabled:opacity-50 disabled:bg-gray-50"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={!selectedBrand}
                  >
                    <option value="" disabled>Select Make & Model</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-800">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>

                <button 
                  onClick={handleNext}
                  disabled={!selectedBrand || !selectedModel}
                  className="w-full bg-[#d01017] text-white font-bold py-4 rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity tracking-wide"
                >
                  NEXT: SELECT ISSUE <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in duration-300">
               <h3 className="font-bold uppercase tracking-wide mb-4 text-[15px]">2. WHAT'S THE ISSUE?</h3>
               {/* Issues Grid */}
               <div className="grid grid-cols-2 gap-3 mb-4">
                 {[
                   { id: 'Screen', label: 'Cracked Screen' },
                   { id: 'Battery', label: 'Battery Issues' },
                   { id: 'Charging Port', label: 'Charging Port' },
                   { id: 'Back Camera', label: 'Camera Issues' },
                   { id: 'Earpiece / Loud Speaker', label: 'Speaker Issues' },
                   { id: 'Other', label: 'Other Issue' }
                 ].map(issue => (
                   <button
                    key={issue.id}
                    onClick={() => {
                      setSelectedIssue(issue.id);
                      setTimeout(() => setStep(3), 150); // Auto advance
                    }}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${selectedIssue === issue.id ? 'border-[#e21a22] bg-red-50 text-gray-900' : 'border-gray-200 bg-white text-gray-600'}`}
                   >
                     <span className="text-sm font-bold block">{issue.label}</span>
                   </button>
                 ))}
               </div>
               <button 
                  onClick={() => setStep(1)}
                  className="w-full bg-gray-200 text-gray-700 font-bold py-4 rounded-xl mt-2 flex items-center justify-center gap-2 transition-opacity"
                >
                  BACK
                </button>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in duration-300 text-center">
              <h3 className="font-bold uppercase tracking-wide mb-6 text-[15px]">3. YOUR INSTANT QUOTE</h3>
              <div className="bg-[#111] rounded-2xl p-6 text-white shadow-xl flex flex-col items-center relative overflow-hidden mb-6">
                <span className="text-xs font-bold tracking-widest text-gray-400 mt-2">ESTIMATED PRICE</span>
                <div className="text-6xl font-black tracking-tighter my-4">
                  {estimatedPrice}
                </div>
                <p className="text-sm font-medium mb-1">Most repairs done in</p>
                <p className="text-[#e21a22] font-bold mb-6">{selectedBrand === 'Other' ? 'for a custom quote!' : 'under 1 hour!'}</p>
                <a href="tel:7134716760" onClick={() => {
                  track('Quote Result Call Button Clicked', { price: estimatedPrice || 'N/A' });
                  if (typeof window !== 'undefined' && (window as any).ttq) {
                    (window as any).ttq.track('Contact', {}, { test_event_code: 'TEST35714' });
                  }
                }} className="w-full bg-[#e21a22] hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-colors mb-3 shadow-md">
                  <Phone className="w-5 h-5 fill-current" />
                  CALL NOW TO BOOK
                </a>
              </div>
              <button 
                  onClick={() => setStep(2)}
                  className="w-full bg-gray-200 text-gray-700 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-opacity"
                >
                  BACK TO ISSUES
                </button>
            </div>
          )}

          {/* Security & Contact block */}
          <div className="mt-6 pt-6 border-t border-gray-300">
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-600 mb-4">
              <ShieldCheck className="w-4 h-4" />
              Your info is secure and will never be shared.
            </div>

            <div className="bg-white rounded-xl p-4 flex items-center gap-4 border border-gray-200 shadow-sm">
              <div className="bg-[#d01017] w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-white fill-current" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[13px] tracking-wide mb-1">PREFER TO TALK TO US?</h4>
                <p className="text-[11px] text-gray-600 mb-2 leading-tight">Call or text us and we'll<br/>help you right away!</p>
              </div>
              <div className="flex-shrink-0">
                 <a href="tel:7134716760" onClick={() => {
                  track('Footer Call Button Clicked');
                  if (typeof window !== 'undefined' && (window as any).ttq) {
                    (window as any).ttq.track('Contact', {}, { test_event_code: 'TEST35714' });
                  }
                }} className="block w-full border border-[#d01017] text-[#d01017] text-center font-bold py-2 px-3 rounded-md text-[11px] leading-tight hover:bg-red-50">
                  CALL / TEXT<br/><span className="text-[13px]">(713) 471-6760</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Navigation */}
      {!isInternal && (
        <nav className="fixed bottom-0 left-0 w-full bg-black border-t border-gray-800 z-50 px-1 py-2 flex justify-between items-center text-[9px] font-bold tracking-wider">
          <a href="#" className="flex flex-col items-center justify-center w-1/5 text-white bg-[#d01017] rounded-xl py-2">
            <Calculator className="w-5 h-5 mb-1" />
            <span>INSTANT QUOTE</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center w-1/5 text-gray-400 hover:text-white py-2">
            <Wrench className="w-5 h-5 mb-1" />
            <span>REPAIRS</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center w-1/5 text-gray-400 hover:text-white py-2">
            <Star className="w-5 h-5 mb-1" />
            <span>REVIEWS</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center w-1/5 text-gray-400 hover:text-white py-2">
            <MapPin className="w-5 h-5 mb-1" />
            <span>LOCATION</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center w-1/5 text-gray-400 hover:text-white py-2">
            <MessageCircle className="w-5 h-5 mb-1" />
            <span>CONTACT</span>
          </a>
        </nav>
      )}

      {/* Style for hiding scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default InstantQuoteWidget;
