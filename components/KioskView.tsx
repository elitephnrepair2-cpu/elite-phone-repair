
import React, { useState } from 'react';
import { DEVICE_CATALOG } from '../constants/devices';
import { REPAIR_CATEGORIES } from '../constants/prices';

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
    smsConsent: boolean;
    consent_ip?: string;
    consent_form_version?: string;
  }) => Promise<boolean>;
  onExitKiosk: () => void;
  kioskPassword?: string;
}

const KioskView: React.FC<KioskViewProps> = ({ onCheckIn, onExitKiosk, kioskPassword }) => {
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
  const [smsConsent, setSmsConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

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

    const finalProblemDescription = problemDescription.trim() || `Repair Category: ${repairCategory}`;

    setIsSubmitting(true);
    try {
      let ip = 'unknown';
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        ip = data.ip;
      } catch (err) {
        console.warn("Could not capture IP address:", err);
      }

      const success = await onCheckIn({
        name,
        phone,
        email,
        deviceBrand: deviceBrand || 'Other',
        deviceModel: deviceModel || otherDevice,
        device: finalDevice,
        repairCategory,
        problemDescription: finalProblemDescription,
        callBackNumber,
        heardFrom,
        smsConsent,
        consent_ip: ip,
        consent_form_version: 'v1.0'
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
        setSmsConsent(false);

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

  const handleAdminExitClick = () => {
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = kioskPassword || '1271';
    if (passwordInput === correctPassword) {
      onExitKiosk();
    } else {
      setPasswordError(true);
      setPasswordInput('');
      setTimeout(() => setPasswordError(false), 1000);
    }
  };

  const handleCloseModal = () => {
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError(false);
  };
  console.log("KIOSK SUBMIT FIRED");
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
        <form onSubmit={handleSubmit} className="space-y-5">
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
                onChange={(e) => setPhone(e.target.value)}
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
                onChange={(e) => setCallBackNumber(e.target.value)}
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

          <div className="p-5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start gap-4">
              <input
                id="kiosk-sms-consent"
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-1 w-7 h-7 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="kiosk-sms-consent" className="text-lg text-slate-700 leading-tight cursor-pointer">
                I consent to receive <strong>SMS updates</strong> regarding my repair status as well as <strong>promotional offers</strong> and special materials from Elite Phone Repair.
              </label>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-red-700 transition-colors shadow-lg text-xl disabled:bg-red-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
        <div className="text-center mt-8">
          <button onClick={handleAdminExitClick} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Return to Admin View</button>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" aria-modal="true" role="dialog">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-sm relative">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Admin Access</h3>
            <p className="text-slate-600 mb-6">Please enter the password to return to the dashboard.</p>
            <form onSubmit={handlePasswordSubmit}>
              <label htmlFor="admin-password" className="sr-only">Password</label>
              <input
                id="admin-password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={`w-full px-4 py-3 text-lg bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${passwordError ? 'ring-2 ring-red-500 animate-shake' : ''}`}
                autoFocus
              />
              {passwordError && <p className="text-red-500 text-sm mt-2">Incorrect password. Please try again.</p>}
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
