import { useEffect } from 'react';

const Alert = ({ message, type = 'error', show, onDismiss }) => {
  useEffect(() => {
    if (show && onDismiss) {
      const t = setTimeout(onDismiss, 5000);
      return () => clearTimeout(t);
    }
  }, [show, onDismiss]);

  if (!show || !message) return null;

  const styles = {
    error: 'bg-red-50 text-red-600 border border-red-200',
    success: 'bg-green-50 text-green-600 border border-green-200',
  };

  return (
    <div className={`${styles[type]} px-4 py-3 rounded-lg text-sm mb-4 animate-shake`}>
      {message}
    </div>
  );
};
export default Alert;
