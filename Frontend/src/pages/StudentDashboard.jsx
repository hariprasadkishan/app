import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import TutorCard from '../components/shared/TutorCard';
import { useUser } from '../context/UserContext';
import { studentStats } from '../data/studentStats';

const getFormattedDate = (daysOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  if (daysOffset === 0) return 'Today';
  if (daysOffset === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const mockSessions = [
  { id: 1, teacher: 'Dr. Anand', initials: 'DA', subject: 'Physics', date: getFormattedDate(0), time: '5:00 PM', mode: 'Online' },
  { id: 2, teacher: 'Mrs. Sharma', initials: 'MS', subject: 'Mathematics', date: getFormattedDate(1), time: '10:00 AM', mode: 'Offline' },
  { id: 3, teacher: 'Mr. Gupta', initials: 'MG', subject: 'Chemistry', date: getFormattedDate(2), time: '4:00 PM', mode: 'Online' },
];

const mockTutors = [
  {
    name: 'Suresh Kumar',
    initials: 'SK',
    subject: 'Mathematics',
    verified: true,
    location: 'Bangalore, India',
    badge: 'Top Rated',
    rating: 4.9,
    reviews: 124,
    experience: '8 Years Exp.',
    mode: 'Online/Offline',
    tags: ['Algebra', 'Calculus', 'CBSE'],
    price: 800,
  },
  {
    name: 'Neha Reddy',
    initials: 'NR',
    subject: 'Biology',
    verified: true,
    location: 'Hyderabad, India',
    badge: 'Expert',
    rating: 4.8,
    reviews: 98,
    experience: '5 Years Exp.',
    mode: 'Online',
    tags: ['Genetics', 'Botany', 'NEET'],
    price: 750,
  },
  {
    name: 'Vikram Singh',
    initials: 'VS',
    subject: 'Physics',
    verified: false,
    location: 'Delhi, India',
    badge: 'Rising Star',
    rating: 4.7,
    reviews: 45,
    experience: '4 Years Exp.',
    mode: 'Online/Offline',
    tags: ['Mechanics', 'Optics', 'JEE'],
    price: 600,
  }
];

const recentTutors = [
  { name: 'Priya Desai', initials: 'PD', subject: 'English', rating: 4.6, price: 500 },
  { name: 'Amit Patel', initials: 'AP', subject: 'Computer Science', rating: 4.9, price: 900 },
];

export default function StudentDashboard() {
  const { user } = useUser();

  useEffect(() => {
    document.title = "Student Dashboard — TrueEdu";
  }, []);

  return (
    <div className="space-y-8 pb-10">
      {/* Greeting Banner */}
      <div className="bg-gradient-to-r from-navy to-blue-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-sora font-extrabold mb-2">Hello, {user?.name || 'Student'}! 👋</h1>
          <p className="text-blue-100 text-lg">Ready to learn something new today?</p>
        </div>
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {studentStats.map((stat, i) => (
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
          {/* Upcoming Sessions */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-sora font-bold text-navy">Upcoming Sessions</h2>
              <Link to="/student/bookings" className="text-sm font-semibold text-sky hover:text-navy transition">View All <i className="fa-solid fa-arrow-right ml-1"></i></Link>
            </div>
            <div className="space-y-4">
              {mockSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                      {session.initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-navy">{session.teacher}</h3>
                      <p className="text-sm text-gray-500">{session.subject}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{session.date} at {session.time}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-semibold ${session.mode === 'Online' ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'}`}>
                      {session.mode}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Teachers */}
          <div>
            <h2 className="text-xl font-sora font-bold text-navy mb-6">Recommended Teachers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {mockTutors.map((tutor, i) => (
                <TutorCard key={i} tutor={tutor} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-sora font-bold text-navy mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Find a Teacher', icon: 'fa-search', to: '/student/discover', bg: 'bg-blue-50', color: 'text-blue-600' },
                { label: 'My Bookings', icon: 'fa-calendar-alt', to: '/student/bookings', bg: 'bg-green-50', color: 'text-green-600' },
                { label: 'My Profile', icon: 'fa-user', to: '/student/profile', bg: 'bg-purple-50', color: 'text-purple-600' },
                { label: 'Help', icon: 'fa-question-circle', to: '/contact', bg: 'bg-orange-50', color: 'text-orange-600' },
              ].map((action, i) => (
                <Link key={i} to={action.to} className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-100 hover:shadow-md transition-all group">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${action.bg} ${action.color} group-hover:scale-110 transition-transform`}>
                    <i className={`fa-solid ${action.icon}`}></i>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 text-center">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recently Viewed Teachers */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-sora font-bold text-navy mb-4">Recently Viewed</h2>
            <div className="space-y-3">
              {recentTutors.map((tutor, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-50 hover:bg-gray-50 transition cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                    {tutor.initials}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-navy">{tutor.name}</h4>
                    <p className="text-xs text-gray-500">{tutor.subject}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy">₹{tutor.price}</p>
                    <p className="text-xs text-amber-500 font-bold"><i className="fa-solid fa-star"></i> {tutor.rating}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl border border-amber-100 shadow-sm">
            <div className="flex gap-3">
              <div className="text-2xl text-amber-500">💡</div>
              <div>
                <h4 className="font-bold text-amber-900 mb-1">Tip of the day</h4>
                <p className="text-sm text-amber-800 leading-relaxed">Consistency beats intensity. Even 30 minutes daily adds up to 180 hours a year!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
