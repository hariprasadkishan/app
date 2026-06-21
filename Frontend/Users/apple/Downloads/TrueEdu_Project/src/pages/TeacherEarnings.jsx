import { useEffect } from 'react';
const TeacherEarnings = () => {
  useEffect(() => { document.title = 'Earnings — TrueEd'; }, []);
  const getFormattedDate = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const dummyPayouts = [
    { id: 'PO001', date: getFormattedDate(-15), amount: '₹4,500', status: 'Transferred' },
    { id: 'PO002', date: getFormattedDate(-8), amount: '₹5,200', status: 'Processing' },
  ];

  return (
    <div className="max-w-[1000px] mx-auto">
      <h1 className="font-sora text-2xl font-bold text-navy mb-6">Earnings</h1>
      <div className="bg-white rounded-brand shadow-brand p-6 md:p-8">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-cream rounded-lg p-4">
            <p className="text-sm text-muted mb-1">This Month</p>
            <p className="font-sora text-2xl font-bold text-navy">₹18,500</p>
          </div>
          <div className="bg-cream rounded-lg p-4">
            <p className="text-sm text-muted mb-1">Overall Total</p>
            <p className="font-sora text-2xl font-bold text-navy">₹1,42,000</p>
          </div>
        </div>

        <h3 className="font-bold text-navy text-sm mb-4">Last 6 Months (₹)</h3>
        <div className="flex items-end gap-2 h-32 mb-8 border-b border-slate-100 pb-2">
          {[40, 60, 80, 50, 90, 75].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end items-center group">
              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity mb-1">{h}k</span>
              <div className="w-full max-w-[30px] bg-sky rounded-t-sm transition-all" style={{ height: `${h}%` }}></div>
            </div>
          ))}
        </div>

        <h3 className="font-bold text-navy text-sm mb-3">Payout History</h3>
        <table className="w-full text-left border-collapse text-sm">
          <tbody>
            {dummyPayouts.map(p => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="py-3 px-2 text-muted">{p.date}</td>
                <td className="py-3 px-2 font-medium text-navy">{p.amount}</td>
                <td className="py-3 px-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.status === 'Transferred' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TeacherEarnings;
