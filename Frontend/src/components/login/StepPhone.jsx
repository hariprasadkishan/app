import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StepIndicator from './StepIndicator';
import Alert from '../shared/Alert';
import Spinner from '../shared/Spinner';

const countryCodes = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'USA' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
  { code: '+65', flag: '🇸🇬', label: 'Singapore' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+1', flag: '🇨🇦', label: 'Canada' },
];

const StepPhone = ({ onSubmit, loading, error, onDismissError }) => {
  const [phone, setPhone] = useState('');
  const [countryIndex, setCountryIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const dropdownRef = useRef(null);

  const activeCountry = countryCodes[countryIndex];
  const isIndia = activeCountry.code === '+91';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (isIndia && val.length > 10) return;
    setPhone(val);
    setPhoneError('');
  };

  const isComplete = isIndia ? phone.length === 10 : phone.length >= 7;

  const handleSubmit = () => {
    if (isIndia && phone.length < 10) {
      setPhoneError('Please enter a valid 10-digit number');
      return;
    }
    if (!isComplete) return;
    onSubmit(`${activeCountry.code}${phone}`);
  };

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="font-sora text-2xl font-bold text-navy">
          True<span className="text-amber">Ed</span>
        </h2>
        <p className="text-muted text-sm mt-1">Enter your phone number to get started</p>
      </div>
      <StepIndicator currentStep={0} />
      <Alert message={error} type="error" show={!!error} onDismiss={onDismissError} />
      
      <div className="mb-6">
        <label className="block text-sm font-semibold text-navy mb-2">Phone Number</label>
        
        <div className="flex gap-2">
          {/* Country Code Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-[52px] px-3 flex items-center gap-2 border-2 border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors outline-none focus:border-sky text-base font-medium text-navy"
            >
              <span>{activeCountry.flag}</span>
              <span className="w-9 text-left">{activeCountry.code}</span>
              <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-lg shadow-brand-xl z-20 py-1 max-h-48 overflow-y-auto animate-slide-up-sm">
                {countryCodes.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCountryIndex(i);
                      setDropdownOpen(false);
                      if ((c.code === '+91') !== isIndia) setPhone('');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${i === countryIndex ? 'bg-cream text-navy font-bold' : 'text-slate-600'}`}
                  >
                    <span className="text-lg">{c.flag}</span>
                    <span className="flex-1 text-left">{c.label}</span>
                    <span className="text-slate-400 text-xs">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Phone Input */}
          <div className="relative flex-1">
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter 10-digit number"
              className="w-full h-[52px] px-4 border-2 border-slate-200 rounded-lg text-base font-semibold text-navy outline-none transition focus:border-sky focus:shadow-[0_0_0_3px_rgba(91,163,224,0.1)] placeholder:text-slate-400 placeholder:font-normal"
            />
            <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${isComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
              <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center shadow-sm">
                <i className="fa-solid fa-check text-white text-[10px]" />
              </div>
            </div>
          </div>
        </div>
        {phoneError && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fa-solid fa-circle-exclamation" /> {phoneError}</p>}
        <p className="text-xs text-muted mt-2 font-medium"><i className="fa-solid fa-lock text-slate-300 mr-1" /> We'll send a 6-digit OTP to verify your number</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !isComplete}
        className="w-full py-3.5 bg-navy text-white rounded-lg font-sora font-semibold hover:bg-navy-light hover:-translate-y-px shadow-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {loading ? <>Please wait<Spinner /></> : 'Send OTP'}
      </button>
      
      <div className="text-center mt-8">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-500 text-sm font-semibold hover:text-navy transition group">
          <i className="fa-solid fa-arrow-left text-xs group-hover:-translate-x-1 transition-transform" /> Back to home
        </Link>
      </div>
    </>
  );
};
export default StepPhone;
