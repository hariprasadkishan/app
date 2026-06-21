import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useUser } from '../../context/UserContext';

const navConfig = {
  student: [
    { label: 'Discover Tutors', icon: 'fa-solid fa-compass', to: '/student/discover' },
    { label: 'My Dashboard', icon: 'fa-solid fa-gauge-high', to: '/student/dashboard' },
    { label: 'My Bookings', icon: 'fa-solid fa-calendar-check', to: '/student/bookings' },
    { label: 'Favourite Teachers', icon: 'fa-solid fa-heart', to: '/student/favourites' },
    { label: 'Payment History', icon: 'fa-solid fa-credit-card', to: '/student/payments' },
    { label: 'My Profile', icon: 'fa-solid fa-user', to: '/student/profile' },
    { label: 'Settings', icon: 'fa-solid fa-gear', to: '/student/settings' },
  ],
  teacher: [
    { label: 'Dashboard', icon: 'fa-solid fa-gauge-high', to: '/teacher/dashboard' },
    { label: 'My Students', icon: 'fa-solid fa-user-group', to: '/teacher/students' },
    { label: 'Earnings', icon: 'fa-solid fa-indian-rupee-sign', to: '/teacher/earnings' },
    { label: 'Reviews', icon: 'fa-solid fa-star', to: '/teacher/reviews' },
    { label: 'Profile', icon: 'fa-solid fa-user', to: '/teacher/profile' },
    { label: 'Settings', icon: 'fa-solid fa-gear', to: '/teacher/settings' },
  ],
  admin: [
    { label: 'KYC Verification', icon: 'fa-solid fa-user-check', to: '/admin/verify' },
    { label: 'Teachers', icon: 'fa-solid fa-chalkboard-user', to: null },
    { label: 'Students', icon: 'fa-solid fa-graduation-cap', to: null },
    { label: 'Bookings', icon: 'fa-solid fa-calendar-check', to: null },
    { label: 'Payments', icon: 'fa-solid fa-credit-card', to: null },
    { label: 'Overview', icon: 'fa-solid fa-chart-pie', to: null },
    { label: 'Reports', icon: 'fa-solid fa-file-lines', to: null },
    { label: 'Settings', icon: 'fa-solid fa-gear', to: null },
  ],
};

const Sidebar = ({ role, isOpen, onClose }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout: authLogout } = useAuth();
  const { user, resetUser } = useUser();
  const items = navConfig[role] || [];

  const initials = user?.initials || 'U';

  // Logout confirmation modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    // 1. Clear user context and localStorage
    resetUser();
    // 2. Clear cookie consent
    localStorage.removeItem('trueedu_cookie_consent');
    // 3. Clear auth state
    authLogout();
    // 4. Close the modal
    setShowLogoutModal(false);
    // 5. Navigate to login
    navigate('/login');
  };

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full w-[75%] max-w-[320px] md:w-[260px] bg-white border-r border-slate-200 z-50 flex flex-col transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
          <Link to="/" onClick={onClose}>
            <img src="/logo.png" alt="TrueEdu logo" className="h-8 w-auto" loading="lazy" />
          </Link>
          <button onClick={onClose} className="md:hidden w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy transition">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-5 px-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
            {role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Admin'} Menu
          </p>
          {items.map((item) => {
            const isActive = item.to && pathname === item.to;
            const isDisabled = !item.to;
            
            if (isDisabled) {
              return (
                <span
                  key={item.label}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold text-slate-300 cursor-not-allowed mb-1"
                >
                  <i className={`${item.icon} w-5 text-center text-lg`} />
                  {item.label}
                </span>
              );
            }
            
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold mb-1 transition-all
                  ${isActive 
                    ? 'bg-amber/10 text-amber-hover border border-amber/20 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-navy'
                  }`}
              >
                <i className={`${item.icon} w-5 text-center text-lg ${isActive ? 'text-amber-hover' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-navy truncate">{user?.name || 'User Name'}</p>
              <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1">
                <i className="fa-solid fa-location-dot text-[10px]" /> {user?.location || 'City'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-error transition w-full px-4 py-2.5 rounded-lg hover:bg-error/10 border border-transparent hover:border-error/20"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" />
            Logout
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowLogoutModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <i className="fa-solid fa-arrow-right-from-bracket text-error text-2xl" />
            </div>
            <h3 className="font-sora text-xl font-bold text-navy mb-2">Are you sure you want to logout?</h3>
            <p className="text-slate-500 text-sm mb-8">You will need to login again to access your dashboard.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 px-4 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 px-4 bg-error text-white rounded-xl text-sm font-bold hover:bg-red-600 transition shadow-lg"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Sidebar;
