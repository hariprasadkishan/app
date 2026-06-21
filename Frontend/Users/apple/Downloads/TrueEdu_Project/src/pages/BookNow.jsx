import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const BookNow = () => {
  const { teacherName } = useParams();
  const name = teacherName ? teacherName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Teacher Name';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    date: '', time: '', duration: 1, mode: 'Online', subject: 'Mathematics', notes: ''
  });
  const [bookingError, setBookingError] = useState('');

  useEffect(() => { document.title = 'Book Session — TrueEd'; }, []);

  const baseRate = 500;
  const sessionCost = baseRate * form.duration;
  const platformFee = sessionCost * 0.15;
  const total = sessionCost + platformFee;

  const handleConfirmBooking = () => {
    if (!form.date) {
      setBookingError('Please select a date');
      return;
    }
    if (!form.time) {
      setBookingError('Please select a time slot');
      return;
    }
    setBookingError('');
    setStep(2);
  };

  if (step === 2) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="font-sora text-3xl font-bold text-navy mb-4">Booking Confirmed!</h2>
        <p className="text-muted mb-8">Your session with {name} has been successfully scheduled.</p>
        <div className="bg-cream rounded-brand p-6 text-left max-w-md mx-auto mb-8">
          <div className="flex justify-between mb-3"><span className="text-muted">Date & Time</span><span className="font-semibold text-navy">{form.date || 'TBD'} at {form.time}</span></div>
          <div className="flex justify-between mb-3"><span className="text-muted">Subject</span><span className="font-semibold text-navy">{form.subject}</span></div>
          <div className="flex justify-between mb-3"><span className="text-muted">Mode</span><span className="font-semibold text-navy">{form.mode}</span></div>
          <div className="flex justify-between pt-3 border-t border-slate-200"><span className="text-muted">Amount Paid</span><span className="font-bold text-navy">₹{total}</span></div>
        </div>
        <Link to="/student/dashboard" className="inline-block py-3.5 px-8 bg-navy text-white rounded-brand font-sora font-semibold hover:bg-navy-light transition">
          Go to Dashboard
        </Link>
        <p className="text-xs text-muted mt-6 max-w-sm mx-auto">
          Note: Students pay a one-time ₹19 access fee to connect with teachers.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto py-12 px-6">
      {/* Teacher Header */}
      <div className="bg-white rounded-brand shadow-brand p-6 mb-8 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-amber flex items-center justify-center text-white text-xl font-bold">{initials}</div>
        <div>
          <h1 className="font-sora text-2xl font-bold text-navy flex items-center gap-2">
            {name} <i className="fa-solid fa-circle-check text-sky text-base" />
          </h1>
          <p className="text-muted text-sm mt-1">Mathematics & Physics · Bangalore</p>
          <div className="flex items-center gap-2 mt-2">
            <i className="fa-solid fa-star text-amber text-sm" /><span className="text-sm font-semibold text-navy">4.8</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Form */}
          <div className="bg-white rounded-brand shadow-brand p-6 md:p-8">
            <h2 className="font-sora text-lg font-bold text-navy mb-6">Schedule Session</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-navy mb-2">Select Date</label>
                <input type="date" value={form.date} min={new Date().toISOString().split('T')[0]} onChange={e => setForm({...form, date: e.target.value})} className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm outline-none focus:border-sky" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy mb-2">Subject</label>
                <select value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm outline-none focus:border-sky bg-white">
                  <option>Mathematics</option>
                  <option>Physics</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-navy mb-3">Available Time Slots</label>
              <div className="flex flex-wrap gap-3">
                {['Morning 9AM', 'Afternoon 2PM', 'Evening 6PM'].map(t => (
                  <button key={t} onClick={() => setForm({...form, time: t})} className={`py-2 px-4 rounded-lg text-sm font-medium border transition ${form.time === t ? 'bg-navy text-white border-navy' : 'bg-white text-muted border-slate-200 hover:border-navy hover:text-navy'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-navy mb-3">Duration</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {[1, 1.5, 2].map(d => (
                    <button key={d} onClick={() => setForm({...form, duration: d})} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${form.duration === d ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'}`}>
                      {d} hr
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy mb-3">Mode</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {['Online', 'In-person'].map(m => (
                    <button key={m} onClick={() => setForm({...form, mode: m})} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${form.mode === m ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Message for Teacher</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows="3" placeholder="What do you want to learn in this session?" className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm outline-none focus:border-sky resize-none" />
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div>
          <div className="bg-white rounded-brand shadow-brand p-6 sticky top-24">
            <h3 className="font-sora font-bold text-navy mb-4">Summary</h3>
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between text-muted">
                <span>₹{baseRate} × {form.duration} hr</span>
                <span className="text-navy font-medium">₹{sessionCost}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Platform Fee (15%)</span>
                <span className="text-navy font-medium">₹{platformFee}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between font-bold text-lg">
                <span className="text-navy">Total</span>
                <span className="text-navy">₹{total}</span>
              </div>
            </div>
            <button onClick={handleConfirmBooking} className="w-full py-3.5 bg-navy text-white rounded-lg font-sora font-semibold hover:bg-navy-light transition disabled:opacity-50 mb-4">
              Confirm Booking
            </button>
            {bookingError && (
              <p className="text-red-500 text-sm text-center mb-4">{bookingError}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#92400e] bg-amber/10 py-2.5 rounded-lg">
              <i className="fa-solid fa-shield-halved" /> Payment Protection Included
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BookNow;
