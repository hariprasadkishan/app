import StepIndicator from './StepIndicator';
import OTPInput from './OTPInput';
import Alert from '../shared/Alert';
import Spinner from '../shared/Spinner';

const StepEmailOTP = ({ email, onSubmit, onResend, onBack, loading, error, onDismissError }) => (
  <>
    <div className="text-center mb-8">
      <h2 className="font-sora text-2xl font-bold text-navy">Verify Email</h2>
      <p className="text-muted text-sm mt-1">
        Enter the 6-digit code sent to <strong className="text-navy">{email}</strong>
      </p>
    </div>
    <StepIndicator currentStep={3} />
    <Alert message={error} type="error" show={!!error} onDismiss={onDismissError} />
    <OTPInput onComplete={onSubmit} disabled={loading} />
    <button onClick={() => console.log('clicked')}
      disabled={loading}
      className="w-full py-3.5 bg-navy text-white rounded-[10px] font-sora font-semibold hover:bg-navy-light transition disabled:opacity-60 mb-3"
    >
      {loading ? <>Please wait<Spinner /></> : 'Verify Email & Finish'}
    </button>
    <button
      onClick={onResend}
      disabled={loading}
      className="w-full py-3.5 border-2 border-slate-200 text-muted rounded-[10px] font-sora font-semibold hover:border-navy hover:text-navy transition disabled:opacity-60"
    >
      Resend Code
    </button>
    <div className="text-center mt-6">
      <button onClick={onBack} className="text-muted text-sm hover:text-navy transition">← Edit profile</button>
    </div>
  </>
);
export default StepEmailOTP;
