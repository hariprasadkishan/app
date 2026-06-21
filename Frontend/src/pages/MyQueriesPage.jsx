import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const dummyQueries = [
  {
    id: 1,
    teacherName: 'Ravi Kumar',
    initials: 'RK',
    subject: 'Mathematics',
    message: 'Hello sir, I am preparing for JEE Mains and looking for intensive coaching. What is your teaching approach?',
    date: 'Oct 12, 2023',
    status: 'Replied',
    reply: 'Hi! I focus heavily on conceptual clarity and problem-solving speed. I provide mock tests every week. We can do a trial class if you like.'
  },
  {
    id: 2,
    teacherName: 'Sneha Patel',
    initials: 'SP',
    subject: 'Physics',
    message: 'Ma\'am, do you provide offline classes in Koramangala area for class 12?',
    date: 'Oct 14, 2023',
    status: 'Pending',
    reply: null
  },
  {
    id: 3,
    teacherName: 'Amit Mishra',
    initials: 'AM',
    subject: 'Chemistry',
    message: 'I need help with organic chemistry specifically. Will you cover only that portion?',
    date: 'Oct 10, 2023',
    status: 'Declined',
    reply: null
  }
];

const MyQueriesPage = () => {
  const [passActive, setPassActive] = useState(false);
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    document.title = 'My Queries — TrueEdu';
    window.scrollTo(0, 0);
    const passData = localStorage.getItem('trueedu_query_pass');
    if (passData) {
      try {
        const parsed = JSON.parse(passData);
        const expiry = new Date(parsed.expiry);
        const now = new Date();
        if (parsed.active && expiry > now) {
          setPassActive(true);
          setQueriesUsed(parsed.used || 0);
          const diffTime = Math.abs(expiry - now);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          setDaysLeft(diffDays);
        }
      } catch (e) { console.error(e) }
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-6">
      <h1 className="font-sora text-2xl font-bold text-navy">My Queries</h1>

      {/* Pass Status Banner */}
      {passActive ? (
        <div className="bg-green-50 border border-green-200 text-success p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-circle-check text-xl" />
            <span className="font-semibold text-sm">Pass Active · {5 - queriesUsed} queries remaining · {daysLeft} days left</span>
          </div>
          <Link to="/student/discover" className="px-4 py-2 bg-white border border-green-200 text-success text-xs font-bold rounded-lg hover:bg-green-100 transition">
            Find Teachers
          </Link>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-600">
            <i className="fa-solid fa-circle-exclamation text-xl" />
            <span className="font-semibold text-sm">Pass Expired or Inactive</span>
          </div>
          <Link to="/student/direct-queries" className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg hover:bg-navy-light transition">
            Get Pass for ₹19
          </Link>
        </div>
      )}

      {/* Query List */}
      <div className="space-y-4">
        {dummyQueries.length === 0 ? (
          <div className="bg-white p-10 rounded-xl border border-slate-200 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              <i className="fa-regular fa-comments" />
            </div>
            <h3 className="font-sora font-bold text-navy text-lg mb-2">You haven't sent any queries yet</h3>
            <p className="text-muted text-sm mb-6">Find a teacher and send your first query to discuss your needs.</p>
            <Link to="/student/discover" className="px-6 py-2.5 bg-navy text-white rounded-lg font-semibold hover:bg-navy-light transition">
              Find a Teacher
            </Link>
          </div>
        ) : (
          dummyQueries.map(query => (
            <div key={query.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
                      {query.initials}
                    </div>
                    <div>
                      <h4 className="font-bold text-navy text-sm leading-tight">{query.teacherName}</h4>
                      <span className="text-xs text-slate-500">{query.subject}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold px-2 py-1 rounded-md inline-block mb-1 ${
                      query.status === 'Replied' ? 'bg-green-100 text-green-700' :
                      query.status === 'Declined' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {query.status}
                    </div>
                    <div className="text-xs text-slate-400 block">{query.date}</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 mb-4 border border-slate-100 relative">
                  <span className="absolute -top-2 left-4 bg-white px-1 text-[10px] font-bold text-slate-400 uppercase">You sent</span>
                  <p className="mt-1">"{query.message}"</p>
                </div>

                {query.status === 'Replied' && (
                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg text-sm text-navy mb-4 relative">
                    <span className="absolute -top-2 left-4 bg-white px-1 text-[10px] font-bold text-blue-500 uppercase">Teacher Reply</span>
                    <p className="mt-1 font-medium">{query.reply}</p>
                    <div className="mt-4 text-right">
                      <Link to={`/book/${query.teacherName.toLowerCase().replace(/\s+/g, '-')}`} className="inline-block px-5 py-2 bg-navy text-white text-xs font-bold rounded-lg hover:bg-navy-light transition shadow-sm">
                        Book a Session
                      </Link>
                    </div>
                  </div>
                )}

                {query.status === 'Pending' && (
                  <div className="text-xs text-slate-500 flex items-center gap-2 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <i className="fa-regular fa-clock text-slate-400" />
                    Waiting for response · Teacher typically responds within 24 hours
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyQueriesPage;
