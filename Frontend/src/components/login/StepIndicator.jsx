const StepIndicator = ({ currentStep }) => {
  const steps = [
    { label: 'Phone' },
    { label: 'OTP' },
    { label: 'Profile' },
    { label: 'Done' }
  ];

  return (
    <div className="flex items-center justify-center gap-6 mb-8 px-4">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isPast = index < currentStep;

        return (
          <div key={index} className="flex flex-col items-center gap-1.5 relative">
            {/* The line connecting dots */}
            {index !== steps.length - 1 && (
              <div
                className={`absolute top-1.5 left-6 w-[2.5rem] h-[2px] -z-10 transition-colors ${
                  isPast ? 'bg-amber' : 'bg-slate-200'
                }`}
              />
            )}
            
            {/* The dot */}
            <div
              className={`w-3 h-3 rounded-full transition-colors ${
                isActive
                  ? 'bg-amber ring-4 ring-amber/20'
                  : isPast
                  ? 'bg-amber'
                  : 'bg-slate-200'
              }`}
            />
            
            {/* The label */}
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isActive ? 'text-amber' : isPast ? 'text-amber' : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
export default StepIndicator;
