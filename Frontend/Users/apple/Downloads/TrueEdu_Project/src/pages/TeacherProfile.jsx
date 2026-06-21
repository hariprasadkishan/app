import { useState, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import Spinner from '../components/shared/Spinner';

const TeacherProfile = () => {
  const { user } = useAuth();
  useEffect(() => { document.title = 'Teacher Profile — TrueEd'; }, []);
  const [available, setAvailable] = useState(true);

  const [profileForm, setProfileForm] = useState({
    bio: 'Experienced educator passionate about teaching.',
    subjects: 'Mathematics, Physics',
    rate: 800,
    location: 'Bangalore',
  });

  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [rateError, setRateError] = useState('');

  const handleSaveProfile = () => {
    const rateNum = Number(profileForm.rate);
    if (rateNum < 100 || rateNum > 10000) {
      setRateError('Rate must be between ₹100 and ₹10,000');
      return;
    }
    setRateError('');
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    }, 1000);
  };

  return (
    <div className="max-w-[800px] mx-auto relative">
      <h1 className="font-sora text-2xl font-bold text-navy mb-6">Teacher Profile</h1>
      
      {/* Success Toast */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${successToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="bg-success text-white px-6 py-3 rounded-full font-semibold shadow-brand-xl flex items-center gap-2">
          <i className="fa-solid fa-circle-check" /> Profile updated successfully!
        </div>
      </div>

      <div className="bg-white rounded-brand shadow-brand p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-sora text-xl font-bold text-navy">My Profile</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted">Available for bookings:</span>
            <button onClick={() => setAvailable(!available)} className={`w-12 h-6 rounded-full p-1 transition-colors ${available ? 'bg-success' : 'bg-slate-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${available ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
        
        <div className="space-y-5 max-w-lg">
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Bio</label>
            <textarea
              rows="3"
              maxLength={500}
              value={profileForm.bio}
              onChange={e => {
                if (e.target.value.length <= 500) {
                  setProfileForm({ ...profileForm, bio: e.target.value });
                }
              }}
              className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-sky resize-none transition focus:border-sky font-medium text-navy"
            />
            <p className="text-xs text-muted mt-1">{profileForm.bio.length}/500</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Subjects Taught (comma separated)</label>
            <input
              type="text"
              maxLength={100}
              value={profileForm.subjects}
              onChange={e => {
                if (e.target.value.length <= 100) {
                  setProfileForm({ ...profileForm, subjects: e.target.value });
                }
              }}
              className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-sky font-medium text-navy transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Hourly Rate (₹)</label>
              <input
                type="number"
                value={profileForm.rate}
                onChange={e => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) {
                    setProfileForm({ ...profileForm, rate: val });
                    setRateError('');
                  }
                }}
                className={`w-full py-2.5 px-3 border rounded-lg text-sm outline-none focus:border-sky font-medium text-navy transition ${rateError ? 'border-red-400' : 'border-slate-200'}`}
              />
              {rateError && <p className="text-xs text-red-500 mt-1">{rateError}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Location</label>
              <input
                type="text"
                maxLength={30}
                value={profileForm.location}
                onChange={e => {
                  const val = e.target.value;
                  if (/^[a-zA-Z\s]*$/.test(val) && val.length <= 30) {
                    setProfileForm({ ...profileForm, location: val });
                  }
                }}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-sky font-medium text-navy transition"
              />
            </div>
          </div>
          <button 
            onClick={handleSaveProfile}
            disabled={saving}
            className="py-3 px-6 bg-navy text-white rounded-lg text-sm font-bold hover:bg-navy-light transition mt-4 shadow-brand hover:shadow-brand-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
          >
            {saving ? (
              <><Spinner size="sm" /> <span className="ml-2">Saving...</span></>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default TeacherProfile;
