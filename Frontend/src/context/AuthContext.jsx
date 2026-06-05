import { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('trueed_profile');
    const savedRole = localStorage.getItem('trueed_role');
    const savedToken = localStorage.getItem('trueed_token');

    if (savedToken && savedProfile && savedRole) {
      setUser(JSON.parse(savedProfile));
      setRole(savedRole);
      setIsAuthenticated(true);
    }
  }, []);

  // Simulate phone OTP send
  const sendPhoneOTP = (phone) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, phone });
      }, 1500);
    });
  };

  // Verify phone OTP — demo code: 123456
  const verifyPhoneOTP = (otp) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (otp === '123456') {
          resolve({ success: true });
        } else {
          reject(new Error('Invalid OTP. Try 123456 for demo'));
        }
      }, 1200);
    });
  };

  // Register profile
  const register = (profile) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, profile });
      }, 1500);
    });
  };

  // Verify email OTP — demo code: 654321
  const verifyEmailOTP = (otp, profile) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (otp === '654321') {
          // Save to localStorage
          localStorage.setItem('trueed_profile', JSON.stringify(profile));
          localStorage.setItem('trueed_role', profile.role);
          localStorage.setItem('trueed_token', 'demo_token_' + Date.now());
          localStorage.setItem('trueed_uid', 'demo_uid_' + Date.now());

          setUser(profile);
          setRole(profile.role);
          setIsAuthenticated(true);

          resolve({ success: true });
        } else {
          reject(new Error('Invalid code. Try 654321 for demo'));
        }
      }, 1200);
    });
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('trueed_profile');
    localStorage.removeItem('trueed_role');
    localStorage.removeItem('trueed_token');
    localStorage.removeItem('trueed_uid');
    setUser(null);
    setRole(null);
    setIsAuthenticated(false);
  };

  // Get route by role
  const getDashboardRoute = (userRole) => {
    const routes = {
      student: '/student/discover',
      teacher: '/teacher/dashboard',
      admin: '/admin/verify',
    };
    return routes[userRole] || '/student/discover';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        sendPhoneOTP,
        verifyPhoneOTP,
        register,
        verifyEmailOTP,
        logout,
        getDashboardRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
