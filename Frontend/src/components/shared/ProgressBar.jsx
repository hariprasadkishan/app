import { useEffect, useState } from 'react';

const ProgressBar = ({ progress = 0, label }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(progress), 200);
    return () => clearTimeout(t);
  }, [progress]);

  return (
    <div>
      {label && <div className="flex justify-between text-sm mb-1"><span className="text-muted">{label}</span><span className="font-semibold text-navy">{progress}%</span></div>}
      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-navy to-sky transition-all duration-700 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};
export default ProgressBar;
