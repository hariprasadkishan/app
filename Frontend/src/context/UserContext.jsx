import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

const defaultUser = {
  name: 'Hari Prasad L',
  initials: 'HP',
  email: 'hari.prasad@example.com',
  phone: '+91 9876543210',
  location: 'Tumakuru',
  school: 'Sri Siddaganga High School',
  class: 'Class 10',
  subjects: ['Mathematics', 'Science'],
  role: 'student',
};

const getInitials = (name) => {
  if (!name || !name.trim()) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
};

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const getInitialUser = () => {
    const storedUser = localStorage.getItem('trueedu_user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
      }
    }
    return { ...defaultUser };
  };

  const [user, setUser] = useState(getInitialUser);

  // Sync to localStorage whenever user changes
  useEffect(() => {
    localStorage.setItem('trueedu_user', JSON.stringify(user));
  }, [user]);

  const updateUser = (updates) => {
    setUser((prevUser) => {
      const newUser = { ...prevUser, ...updates };
      // Auto-generate initials from name
      if (updates.name !== undefined) {
        newUser.initials = getInitials(updates.name);
      }
      // Immediately sync to localStorage
      localStorage.setItem('trueedu_user', JSON.stringify(newUser));
      return newUser;
    });
  };

  const resetUser = () => {
    localStorage.removeItem('trueedu_user');
    setUser({ ...defaultUser });
  };

  return (
    <UserContext.Provider value={{ user, updateUser, resetUser, defaultUser }}>
      {children}
    </UserContext.Provider>
  );
};
