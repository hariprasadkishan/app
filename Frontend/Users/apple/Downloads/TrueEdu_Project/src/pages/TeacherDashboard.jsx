import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { teacherData } from '../data/teacherData';
import { teacherQueriesData } from '../data/teacherQueries';

const initialSessions = [
  { id: 1, student: 'Aarav M.', initials: 'AM', subject: 'Physics Class 12', time: '10:00 AM - 11:30 AM', type: 'Online', completed: false },
  { id: 2, student: 'Priya K.', initials: 'PK', subject: 'Mathematics', time: '2:00 PM - 3:00 PM', type: 'Offline', completed: false },
  { id: 3, student: 'Rahul S.', initials: 'RS', subject: 'Chemistry', time: '5:00 PM - 6:30 PM', type: 'Online', completed: false },
];

const getFormattedDate = (daysOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  if (daysOffset === 0) return 'Today';
  if (daysOffset === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const initialBookings = [
  { id: 101, student: 'Rohan D.', initials: 'RD', subject: 'Physics Crash Course', date: `${getFormattedDate(1)}, 4 PM`, status: 'pending' },
  { id: 102, student: 'Sneha P.', initials: 'SP', subject: 'Math Doubt Session', date: `${getFormattedDate(2)}, 11 AM`, status: 'pending' },
  { id: 103, student: 'Karan V.', initials: 'KV', subject: 'Chemistry Revision', date: `${getFormattedDate(3)}, 2 PM`, status: 'pending' },
];



export default function TeacherDashboard() {
  useEffect(() => {
    document.title = "Teacher Dashboard — TrueEd";
  }, []);

  const [sessions, setSessions] = useState(initialSessions);
  const [bookings, setBookings] = useState(initialBookings);

  const totalQueries = teacherQueriesData.length;
  const pendingQueries = teacherQueriesData.filter(q => q.status === 'pending').length;
  const repliedQueries = teacherQueriesData.filter(q => q.status === 'replied').length;

  const toggleSessionComplete = (id) => {
    setSessions(sessions.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const handleBookingAction = (id, action) => {
    setBookings(bookings.map(b => b.id === id ? { ...b, status: action } : b));
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Greeting Banner */}
      <div className="bg-gradient-to-r from-navy to-blue-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-sora font-extrabold mb-2">Welcome back, {teacherData.name}! 👋</h1>
          <p className="text-blue-100 text-lg">You have {sessions.filter(s => !s.completed).length} sessions today</p>
        </div>
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: '45', icon: 'fa-users', color: 'text-sky-500', bg: 'bg-sky-50' },
          { label: 'Sessions This Month', value: '28', icon: 'fa-chalkboard-teacher', color: 'text-purple-500', bg: 'bg-purple-50' },
          { label: 'Total Earnings', value: '₹22,400', icon: 'fa-indian-rupee-sign', color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Avg Rating', value: '4.9 ⭐', icon: 'fa-star', color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${stat.bg} ${stat.color}`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-navy">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Today's Sessions */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-sora font-bold text-navy">Today's Sessions</h2>
              <Link to="/teacher/sessions" className="text-sm font-semibold text-sky hover:text-navy transition">View All</Link>
            </div>
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition ${session.completed ? 'border-green-100 bg-green-50/30' : 'border-gray-100 hover:border-blue-100'}`}>
                  <div className="flex items-center gap-4 mb-3 sm:mb-0">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg">
                      {session.initials}
                    </div>
                    <div>
                      <h3 className={`font-bold ${session.completed ? 'text-gray-500 line-through' : 'text-navy'}`}>{session.student}</h3>
                      <p className="text-sm text-gray-500">{session.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-gray-800 text-sm">{session.time}</p>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded font-semibold ${session.type === 'Online' ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'}`}>
                        {session.type}
                      </span>
                    </div>
                    <button 
                      onClick={() => toggleSessionComplete(session.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${session.completed ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                    >
                      <i className={`fa-solid ${session.completed ? 'fa-check-circle' : 'fa-check'}`}></i>
                      {session.completed ? 'Completed' : 'Mark Complete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Bookings */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-xl font-sora font-bold text-navy mb-6">Upcoming Bookings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 rounded-xl border border-gray-100 flex flex-col h-full bg-gray-50/50 hover:bg-white transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                      {booking.initials}
                    </div>
                    <div>
                      <h4 className="font-bold text-navy">{booking.student}</h4>
                      <p className="text-xs text-gray-500">{booking.subject}</p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700 mb-4 bg-white p-2 rounded border border-gray-100">
                    <i className="fa-regular fa-clock text-sky mr-2"></i>{booking.date}
                  </div>
                  <div className="mt-auto">
                    {booking.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleBookingAction(booking.id, 'accepted')} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold transition">Accept</button>
                        <button onClick={() => handleBookingAction(booking.id, 'declined')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-bold transition">Decline</button>
                      </div>
                    ) : booking.status === 'accepted' ? (
                      <div className="text-center py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-100">
                        <i className="fa-solid fa-check-circle mr-1"></i> Accepted
                      </div>
                    ) : (
                      <div className="text-center py-2 bg-gray-50 text-gray-500 rounded-lg text-sm font-bold border border-gray-200">
                        <i className="fa-solid fa-times-circle mr-1"></i> Declined
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Student Queries Widget */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
            <div className="mb-6">
              <h2 className="text-xl font-sora font-bold text-navy">Student Queries</h2>
              <p className="text-sm text-gray-500 mt-1">Students interested in learning from you</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 text-center">
                <p className="font-sora font-extrabold text-2xl text-navy">{totalQueries}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 tracking-wider">Total</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
                <p className="font-sora font-extrabold text-2xl text-amber-600">{pendingQueries}</p>
                <p className="text-[10px] uppercase font-bold text-amber-700 mt-1 tracking-wider">Pending</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                <p className="font-sora font-extrabold text-2xl text-green-600">{repliedQueries}</p>
                <p className="text-[10px] uppercase font-bold text-green-700 mt-1 tracking-wider">Replied</p>
              </div>
            </div>

            <div className="mt-auto">
              <Link to="/teacher/queries" className="w-full flex items-center justify-center gap-2 py-3 bg-navy text-white rounded-lg font-bold hover:bg-navy-light transition shadow-sm">
                View All Queries <i className="fa-solid fa-arrow-right text-xs" />
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Earnings Summary */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-sora font-bold text-navy mb-5">Earnings Summary</h2>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1 font-semibold">
                  <span className="text-gray-600">This Month</span>
                  <span className="text-navy">₹22,400</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1 font-semibold">
                  <span className="text-gray-600">Last Month</span>
                  <span className="text-gray-500">₹18,900</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-gray-400 h-2.5 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-xs text-green-600 font-bold bg-green-50 inline-block px-2 py-1 rounded">
                  <i className="fa-solid fa-arrow-trend-up mr-1"></i> 18.5% increase
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-sora font-bold text-navy mb-4">Quick Links</h2>
            <div className="space-y-2">
              {[
                { label: 'My Students', icon: 'fa-user-graduate', to: '/teacher/students' },
                { label: 'My Sessions', icon: 'fa-calendar-check', to: '/teacher/sessions' },
                { label: 'View Earnings', icon: 'fa-wallet', to: '/teacher/earnings' },
                { label: 'Edit Profile', icon: 'fa-user-edit', to: '/teacher/profile' },
              ].map((action, i) => (
                <Link key={i} to={action.to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-gray-700 hover:text-navy font-semibold transition group">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition">
                    <i className={`fa-solid ${action.icon}`}></i>
                  </div>
                  {action.label}
                  <i className="fa-solid fa-chevron-right ml-auto text-xs text-gray-400"></i>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Reviews */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-sora font-bold text-navy mb-4">Recent Reviews</h2>
            <div className="space-y-4">
              {[
                { name: 'Kavya T.', rating: 5, text: 'Ravi sir explains concepts so clearly! Best physics teacher.', date: '2 days ago' },
                { name: 'Siddharth M.', rating: 4, text: 'Very helpful and patient. Solved all my doubts.', date: '1 week ago' },
              ].map((review, i) => (
                <div key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-navy">{review.name}</span>
                    <span className="text-xs text-gray-400">{review.date}</span>
                  </div>
                  <div className="text-amber-500 text-xs mb-1">
                    {[...Array(5)].map((_, j) => <i key={j} className={`fa-star ${j < review.rating ? 'fa-solid' : 'fa-regular'}`}></i>)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">"{review.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
