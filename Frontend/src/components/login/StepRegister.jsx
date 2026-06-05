import { useState } from 'react';
import StepIndicator from './StepIndicator';
import Alert from '../shared/Alert';
import Spinner from '../shared/Spinner';

const roles = [
  { key: 'student', icon: '🎓', label: 'Student / Parent' },
  { key: 'teacher', icon: '👨‍🏫', label: 'Teacher' },
];

const StepRegister = ({ onSubmit, loading, error, onDismissError, initialRole = 'student' }) => {
  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = () => {
    setLocalError('');
    if (!name.trim()) { setLocalError('Please enter your name'); return; }
    if (!email.trim() || !email.includes('@')) { setLocalError('Please enter a valid email address'); return; }
    if (!city.trim()) { setLocalError('Please enter your city'); return; }
    onSubmit({ name, email, city, area, role });
  };

  const displayError = localError || error;

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="font-sora text-2xl font-bold text-navy">Create Profile</h2>
        <p className="text-muted text-sm mt-1">Tell us a little about yourself</p>
      </div>
      <StepIndicator currentStep={2} />
      <Alert message={displayError} type="error" show={!!displayError} onDismiss={() => setLocalError('')} />

      {/* Role select */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {roles.map((r) => (
          <button
            key={r.key}
            onClick={() => setRole(r.key)}
            className={`p-4 border-2 rounded-[10px] text-center cursor-pointer transition-all ${
              role === r.key ? 'border-amber bg-amber/5' : 'border-slate-200 hover:border-amber/50'
            }`}
          >
            <div className="text-2xl mb-1">{r.icon}</div>
            <div className="text-sm font-semibold text-navy">{r.label}</div>
          </button>
        ))}
      </div>

      {/* Fields */}
      {[
        { label: 'Student / Full Name', value: name, setter: setName, type: 'text', placeholder: 'e.g. Arjun Sharma' },
        { label: 'Email Address', value: email, setter: setEmail, type: 'email', placeholder: 'arjun@example.com', hint: "We'll verify this email with a confirmation code" },
      ].map((f) => (
        <div key={f.label} className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-1.5">{f.label}</label>
          <input
            type={f.type}
            value={f.value}
            onChange={(e) => f.setter(e.target.value)}
            placeholder={f.placeholder}
            className="w-full py-3.5 px-4 border-2 border-slate-200 rounded-[10px] text-base font-dm outline-none transition focus:border-sky focus:shadow-[0_0_0_3px_rgba(91,163,224,0.1)]"
          />
          {f.hint && <p className="text-sm text-muted mt-1.5">{f.hint}</p>}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">City</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bangalore"
            className="w-full py-3.5 px-4 border-2 border-slate-200 rounded-[10px] text-base font-dm outline-none transition focus:border-sky focus:shadow-[0_0_0_3px_rgba(91,163,224,0.1)]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Area / Locality</label>
          <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Indiranagar"
            className="w-full py-3.5 px-4 border-2 border-slate-200 rounded-[10px] text-base font-dm outline-none transition focus:border-sky focus:shadow-[0_0_0_3px_rgba(91,163,224,0.1)]" />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3.5 bg-navy text-white rounded-[10px] font-sora font-semibold hover:bg-navy-light transition disabled:opacity-60"
      >
        {loading ? <>Please wait<Spinner /></> : 'Continue'}
      </button>
    </>
  );
};
export default StepRegister;
