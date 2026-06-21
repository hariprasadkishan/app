import { useState, useRef, useEffect } from 'react';

const OTPInput = ({ length = 6, onComplete, disabled }) => {
  const [values, setValues] = useState(Array(length).fill(''));
  const refs = useRef([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const handleChange = (idx, val) => {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...values];
    next[idx] = digit;
    setValues(next);
    if (digit && idx < length - 1) refs.current[idx + 1]?.focus();
    const joined = next.join('');
    if (joined.length === length) onComplete?.(joined);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !values[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length);
    if (pasted.length === length) {
      const next = pasted.split('');
      setValues(next);
      onComplete?.(pasted);
      refs.current[length - 1]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div className="flex gap-2 justify-center mb-4">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={values[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-[10px] outline-none transition-all focus:border-amber focus:shadow-[0_0_0_3px_rgba(245,166,35,0.15)] disabled:opacity-50"
        />
      ))}
    </div>
  );
};
export default OTPInput;
