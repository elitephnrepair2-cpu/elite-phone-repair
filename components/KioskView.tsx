import React, { useState } from 'react';
import { DEVICE_CATALOG } from '../constants/devices';
import { REPAIR_CATEGORIES } from '../constants/prices';
import { formatPhoneInput, isValidPhoneNumber } from '../services/phoneValidator';

interface KioskViewProps {
  onCheckIn: (data: {
    name: string;
    phone: string;
    email: string;
    deviceBrand: string;
    deviceModel: string;
    device: string;
    repairCategory: string;
    problemDescription: string;
    callBackNumber: string;
    heardFrom: string;
    transactionalConsent: boolean;
    promotionalConsent: boolean;
    consent_ip?: string;
    consent_form_version?: string;
  }) => Promise<boolean>;
  onExitKiosk: () => void;
  kioskPassword?: string;
  verification?: React.ReactNode;
  canSubmit?: boolean;
}

const KioskView: React.FC<KioskViewProps> = ({ onCheckIn, onExitKiosk, kioskPassword, verification, canSubmit = true }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [callBackNumber, setCallBackNumber] = useState('');
  const [email, setEmail] = useState('');

  // New Device Selection State
  const [deviceBrand, setDeviceBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [otherDevice, setOtherDevice] = useState('');
  const [repairCategory, setRepairCategory] = useState('');

  const [problemDescription, setProblemDescription] = useState('');
  const [heardFrom, setHeardFrom] = useState('');
  const [transactionalConsent, setTransactionalConsent] = useState(true);
  const [promotionalConsent, setPromotionalConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine the final device string
    let finalDevice = '';
    if (deviceBrand === 'Other' || deviceModel === 'Other') {
      finalDevice = otherDevice.trim();
    } else if (deviceBrand && deviceModel) {
      finalDevice = `${deviceBrand} ${deviceModel}`.trim();
    }

    if (!name || !phone || !finalDevice || !repairCategory || !heardFrom) {
      alert("Please fill out all required fields.");
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      alert("Please enter a valid 10-digit Phone Number.");
      return;
    }

    if (callBackNumber && !isValidPhoneNumber(callBackNumber)) {
      alert("Please enter a valid 10-digit Call Back Phone Number.");
      return;
    }

    if (!transactionalConsent) {
      alert("You must agree to receive service-related messages to continue.");
      return;
    }

    const finalProblemDescription = problemDescription.trim() || `Repair Category: ${repairCategory}`;

    setIsSubmitting(true);
    try {
      const success = await onCheckIn({
        name,
        phone: formatPhoneInput(phone),
        email,
        deviceBrand: deviceBrand || 'Other',
        deviceModel: deviceModel || otherDevice,
        device: finalDevice,
        repairCategory,
        problemDescription: finalProblemDescription,
        callBackNumber: callBackNumber ? formatPhoneInput(callBackNumber) : '',
        heardFrom,
        transactionalConsent,
        promotionalConsent,
        consent_form_version: 'v1.1'
      });
      setIsSubmitting(false);

      if (success) {
        // Reset form fields
        setName('');
        setPhone('');
        setCallBackNumber('');
        setEmail('');
        setDeviceBrand('');
        setDeviceModel('');
        setOtherDevice('');
        setRepairCategory('');
        setProblemDescription('');
        setHeardFrom('');
        setTransactionalConsent(true);
        setPromotionalConsent(false);

        // Show success message and hide it after a few seconds
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      } else {
        alert("There was an error submitting your ticket. Please ask a technician for help.");
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error("Kiosk submission error:", err);
      alert("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <>
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl max-w-3xl mx-auto relative overflow-hidden">
        {showSuccess && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-95 flex flex-col items-center justify-center z-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-3xl font-bold text-white mt-4">Thank You!</h3>
            <p className="text-lg text-white mt-1">Your ticket has been submitted.</p>
          </div>
        )}

        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-slate-800">Device Check-in</h2>
          <p className="text-lg text-slate-500 mt-2">Please provide your details below to start a repair ticket.</p>
        </div>
        <form autoComplete="off" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="kiosk-name" className="block text-base font-semibold text-slate-800 mb-2">Full Name <span className="text-red-500">*</span></label>
              <input
                id="kiosk-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
                required
              />
            </div>
            <div>
              <label htmlFor="kiosk-email" className="block text-base font-semibold text-slate-800 mb-2">Email Address</label>
              <input
                id="kiosk-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="kiosk-phone" className="block text-base font-semibold text-slate-800 mb-2">Phone Number <span className="text-red-500">*</span></label>
              <input
                id="kiosk-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
                required
              />
            </div>
            <div>
              <label htmlFor="kiosk-callback" className="block text-base font-semibold text-slate-800 mb-2">Call Back Phone Number (Optional)</label>
              <input
                id="kiosk-callback"
                type="tel"
                value={callBackNumber}
                onChange={(e) => setCallBackNumber(formatPhoneInput(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="kiosk-brand" className="block text-base font-semibold text-slate-800 mb-2">Device Brand <span className="text-red-500">*</span></label>
              <select
                id="kiosk-brand"
                value={deviceBrand}
                onChange={(e) => {
                  setDeviceBrand(e.target.value);
                  setDeviceModel(''); // Reset model when brand changes
                }}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg appearance-none"
                required
              >
                <option value="">Select Brand</option>
                {Object.keys(DEVICE_CATALOG).map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
                <option value="Other">Other Brand</option>
              </select>
            </div>

            <div>
              <label htmlFor="kiosk-model" className="block text-base font-semibold text-slate-800 mb-2">Device Model <span className="text-red-500">*</span></label>
              <select
                id="kiosk-model"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                disabled={!deviceBrand || deviceBrand === 'Other'}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg appearance-none disabled:opacity-50 disabled:bg-slate-200"
                required={deviceBrand !== 'Other'}
              >
                <option value="">Select Model</option>
                {deviceBrand && DEVICE_CATALOG[deviceBrand]?.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
                <option value="Other">Other Model / Not Listed</option>
              </select>
            </div>
          </div>

          {(deviceBrand === 'Other' || deviceModel === 'Other') && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label htmlFor="kiosk-other-device" className="block text-base font-semibold text-slate-800 mb-2">Please specify your device <span className="text-red-500">*</span></label>
              <input
                id="kiosk-other-device"
                type="text"
                value={otherDevice}
                onChange={(e) => setOtherDevice(e.target.value)}
                placeholder="e.g., Google Pixel 5, LG Wing..."
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="kiosk-heard" className="block text-base font-semibold text-slate-800 mb-2">How did you hear about us? <span className="text-red-500">*</span></label>
            <select
              id="kiosk-heard"
              value={heardFrom}
              onChange={(e) => setHeardFrom(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg appearance-none"
              required
            >
              <option value="">Select option</option>
              <option value="Google">Google</option>
              <option value="Friend/Family">Friend/Family</option>
              <option value="Facebook/IG">Facebook/IG</option>
              <option value="Returning Customer">Returning Customer</option>
            </select>
          </div>

          <div>
            <label htmlFor="kiosk-repair-category" className="block text-base font-semibold text-slate-800 mb-2">What type of repair do you need? <span className="text-red-500">*</span></label>
            <select
              id="kiosk-repair-category"
              value={repairCategory}
              onChange={(e) => setRepairCategory(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg appearance-none"
              required
            >
              <option value="">Select option</option>
              {REPAIR_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="kiosk-problem" className="block text-base font-semibold text-slate-800 mb-2">Additional details about the problem (Optional)</label>
            <textarea
              id="kiosk-problem"
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
              placeholder="e.g., The screen is completely shattered and the battery dies really fast..."
              rows={3}
            ></textarea>
          </div>

          <div className="space-y-4 p-5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start gap-4">
              <input
                id="kiosk-transactional-consent"
                type="checkbox"
                checked={transactionalConsent}
                onChange={(e) => setTransactionalConsent(e.target.checked)}
                className="mt-1 w-7 h-7 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                required
              />
              <label htmlFor="kiosk-transactional-consent" className="text-lg text-slate-700 leading-tight cursor-pointer">
                <span className="font-bold text-red-600 uppercase text-xs tracking-wider block mb-1">Required (Service / Non-Marketing)</span>
                I agree to receive account updates and notifications from Elite Phone Repair.
              </label>
            </div>

            <div className="flex items-start gap-4 mt-6">
              <input
                id="kiosk-promotional-consent"
                type="checkbox"
                checked={promotionalConsent}
                onChange={(e) => setPromotionalConsent(e.target.checked)}
                className="mt-1 w-7 h-7 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="kiosk-promotional-consent" className="text-lg text-slate-700 leading-tight cursor-pointer">
                <span className="font-bold text-slate-500 uppercase text-xs tracking-wider block mb-1">Optional (Marketing)</span>
                I agree to receive marketing messages and special offers from Elite Phone Repair. Message frequency varies. Message &amp; data rates may apply. Reply STOP to opt out or HELP for assistance.
              </label>
            </div>

            <div className="text-xs text-slate-500 mt-6 space-y-3 border-t border-slate-200 pt-5">
              <p>By providing your phone number, you consent to receive SMS text messages from Elite Phone Repair regarding account updates and notifications.</p>
              <p>If you opt in to receive promotional messages, you agree to receive marketing messages and special offers.</p>
              <p>Message frequency may vary. Message and data rates may apply. You can opt out at any time by replying STOP or get help by replying HELP.</p>
              <p>Your consent to receive marketing messages is not a condition of purchase.</p>
              <p>You confirm that you are the authorized user of the phone number provided.</p>
              <p>View our Terms of Use and Privacy Policy for more information.</p>
              <p className="font-semibold text-slate-600 mt-4 text-sm bg-slate-100 p-2 rounded">
                Elite Phone Repair does not sell or share your personal information, including phone numbers, with third parties for marketing purposes.
              </p>
            </div>
          </div>

          <div className="pt-4">
            {verification}
          <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="w-full bg-red-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-red-700 transition-colors shadow-lg text-xl disabled:bg-red-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
        <div className="text-center mt-8">
          <button onClick={onExitKiosk} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Return to staff dashboard</button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </>
  );
};

export default KioskView;
