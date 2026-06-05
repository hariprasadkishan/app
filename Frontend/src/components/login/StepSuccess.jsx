import Spinner from '../shared/Spinner';

const roleLabels = {
  student: 'Go to Student Section',
  teacher: 'Go to Teacher Section',
  admin: 'Go to Admin Section',
};

const StepSuccess = ({ role, onContinue, loading }) => (
  <div className="text-center">
    <div className="text-7xl mb-3">🎉</div>
    <h2 className="font-sora text-2xl font-bold text-navy mb-2">You're All Set!</h2>
    <p className="text-muted text-sm">Your account has been verified successfully.</p>

    <div className="flex items-center justify-center gap-2 text-success font-semibold text-base my-6">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"/>
      </svg>
      Phone &amp; Email Verified
    </div>

    <button
      onClick={onContinue}
      disabled={loading}
      className="w-full py-3.5 bg-navy text-white rounded-[10px] font-sora font-semibold hover:bg-navy-light transition disabled:opacity-60"
    >
      {loading ? <>Please wait<Spinner /></> : (roleLabels[role] || 'Go to Dashboard')}
    </button>
  </div>
);
export default StepSuccess;
