import { useState, useEffect } from 'react';
import { teacherData } from '../data/teacherData';

export default function TeacherSettings() {
  useEffect(() => {
    document.title = "Settings — TrueEd";
  }, []);

  const [savingAccount, setSavingAccount] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [notifs, setNotifs] = useState({
    booking: true, reminder: true, review: true, earnings: false, platform: true, marketing: false
  });
  
  const [privacy, setPrivacy] = useState({
    showProfile: true, showEarnings: false, allowMessages: true
  });
  
  const [availability, setAvailability] = useState({
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    slots: ['Morning', 'Evening']
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveAccount = () => {
    setSavingAccount(true);
    setTimeout(() => {
      setSavingAccount(false);
      showToast('Account details updated successfully!');
    }, 1000);
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(false);
    showToast('Account deletion request submitted', 'error');
  };

  const toggleNotif = (key) => setNotifs(p => ({ ...p, [key]: !p[key] }));
  const togglePrivacy = (key) => setPrivacy(p => ({ ...p, [key]: !p[key] }));

  const toggleDay = (day) => {
    setAvailability(p => ({
      ...p,
      days: p.days.includes(day) ? p.days.filter(d => d !== day) : [...p.days, day]
    }));
  };

  const toggleSlot = (slot) => {
    setAvailability(p => ({
      ...p,
      slots: p.slots.includes(slot) ? p.slots.filter(s => s !== slot) : [...p.slots, slot]
    }));
  };

  const ToggleSwitch = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-bold text-navy">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button 
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg font-bold text-white flex items-center gap-2 z-50 transition-opacity ${toast.type === 'error' ? 'bg-red-500' : 'bg-navy'}`}>
          <i className={`fa-solid ${toast.type === 'error' ? 'fa-triangle-exclamation' : 'fa-check-circle'}`}></i>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-sora font-extrabold text-navy mb-2">Settings</h1>
        <p className="text-gray-500">Manage your account preferences and profile settings</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-sora font-bold text-navy flex items-center gap-2">
            <i className="fa-solid fa-user-circle text-sky"></i> Account Settings
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Display Name</label>
              <input type="text" defaultValue={teacherData.name} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky/50 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <input type="email" defaultValue="ravi.kumar@example.com" disabled className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-600 outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                  <i className="fa-solid fa-check-circle"></i> Verified
                </span>
              </div>
            </div>
          </div>
          <div className="pt-2">
            <button 
              onClick={handleSaveAccount}
              disabled={savingAccount}
              className="bg-navy hover:bg-blue-900 text-white px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
            >
              {savingAccount ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-sora font-bold text-navy flex items-center gap-2">
              <i className="fa-solid fa-bell text-amber-500"></i> Notifications
            </h2>
          </div>
          <div className="p-6">
            <ToggleSwitch checked={notifs.booking} onChange={() => toggleNotif('booking')} label="New Bookings" description="Email alerts for new session requests" />
            <ToggleSwitch checked={notifs.reminder} onChange={() => toggleNotif('reminder')} label="Session Reminders" description="Reminders 1 hr before classes" />
            <ToggleSwitch checked={notifs.review} onChange={() => toggleNotif('review')} label="New Reviews" description="When a student leaves feedback" />
            <ToggleSwitch checked={notifs.earnings} onChange={() => toggleNotif('earnings')} label="Weekly Earnings" description="Summary of your weekly payouts" />
            <ToggleSwitch checked={notifs.platform} onChange={() => toggleNotif('platform')} label="Platform Updates" description="Important TrueEd announcements" />
            <ToggleSwitch checked={notifs.marketing} onChange={() => toggleNotif('marketing')} label="Marketing" description="Tips and promotional content" />
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-sora font-bold text-navy flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-green-500"></i> Privacy
              </h2>
            </div>
            <div className="p-6">
              <ToggleSwitch checked={privacy.showProfile} onChange={() => togglePrivacy('showProfile')} label="Public Profile" description="Allow students to find you in search" />
              <ToggleSwitch checked={privacy.showEarnings} onChange={() => togglePrivacy('showEarnings')} label="Show Stats" description="Display total students & sessions" />
              <ToggleSwitch checked={privacy.allowMessages} onChange={() => togglePrivacy('allowMessages')} label="Allow Messages" description="Students can message before booking" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-sora font-bold text-navy flex items-center gap-2">
                <i className="fa-regular fa-calendar-check text-purple-500"></i> Availability
              </h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <button 
                      key={day} 
                      onClick={() => toggleDay(day)}
                      className={`w-10 h-10 rounded-full font-bold text-sm transition-colors ${availability.days.includes(day) ? 'bg-sky text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {day.charAt(0)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Preferred Slots</label>
                <div className="flex flex-wrap gap-3">
                  {['Morning', 'Afternoon', 'Evening'].map(slot => (
                    <button 
                      key={slot}
                      onClick={() => toggleSlot(slot)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${availability.slots.includes(slot) ? 'border-sky bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <button onClick={() => showToast('Availability schedule saved')} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-bold transition">
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm overflow-hidden mt-8 p-6">
        <h2 className="text-lg font-sora font-bold text-red-700 flex items-center gap-2 mb-2">
          <i className="fa-solid fa-triangle-exclamation"></i> Danger Zone
        </h2>
        <p className="text-red-600/80 text-sm mb-4">Once you delete your account, there is no going back. Please be certain.</p>
        <button 
          onClick={() => setShowDeleteModal(true)}
          className="bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-6 py-2 rounded-lg font-bold transition"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl transition-opacity">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              <i className="fa-solid fa-trash-can"></i>
            </div>
            <h3 className="text-xl font-sora font-bold text-center text-navy mb-2">Are you absolutely sure?</h3>
            <p className="text-center text-gray-500 mb-6 text-sm">
              This action cannot be undone. This will permanently delete your account and remove your data from our servers.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
