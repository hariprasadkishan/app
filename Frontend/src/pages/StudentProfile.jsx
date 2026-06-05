import { useState, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import { useUser } from '../context/UserContext';
import Spinner from '../components/shared/Spinner';

const MAX_SUBJECTS = 8;

const suggestionGroups = [
  {
    label: 'Popular Subjects',
    items: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science', 'Hindi', 'Social Science', 'Sanskrit', 'Economics'],
  },
  {
    label: 'Competitive Exams',
    items: ['JEE Mains', 'JEE Advanced', 'NEET', 'UPSC', 'CAT', 'GATE', 'NDA', 'CUET'],
  },
  {
    label: 'Hobbies and Skills',
    items: ['Guitar', 'Piano', 'Drawing', 'Chess', 'Dance', 'Coding', 'Photography', 'Spoken English', 'Yoga', 'Cricket Coaching'],
  },
];

const StudentProfile = () => {
  const { user: authUser } = useAuth();
  const { user, updateUser } = useUser();
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || 'Student Name',
    class: 'Class 10',
    location: user?.location || 'Bangalore',
    subjects: ['Mathematics', 'Science'],
  });

  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [nameError, setNameError] = useState('');
  const [cityError, setCityError] = useState('');

  // Subject dropdown state
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => { document.title = 'My Profile — TrueEdu'; }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSubjectDropdown(false);
        setSubjectSearch('');
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowSubjectDropdown(false);
        setSubjectSearch('');
      }
    };
    if (showSubjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSubjectDropdown]);

  const lettersAndSpaces = /^[a-zA-Z\s]*$/;

  const handleNameChange = (e) => {
    const val = e.target.value;
    if (!lettersAndSpaces.test(val)) {
      setNameError('Only letters and spaces allowed');
      return;
    }
    if (val.length > 50) {
      setNameError('Maximum 50 characters');
      return;
    }
    setProfileForm({ ...profileForm, name: val });
    setNameError('');
  };

  const handleCityChange = (e) => {
    const val = e.target.value;
    if (!lettersAndSpaces.test(val)) {
      setCityError('Only letters and spaces allowed');
      return;
    }
    if (val.length > 30) {
      setCityError('Maximum 30 characters');
      return;
    }
    setProfileForm({ ...profileForm, location: val });
    setCityError('');
  };

  const handleSaveProfile = () => {
    setNameError('');
    setCityError('');
    if (!profileForm.name.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    
    setSaving(true);
    setTimeout(() => {
      updateUser(profileForm);
      setSaving(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    }, 1000);
  };

  const atLimit = profileForm.subjects.length >= MAX_SUBJECTS;

  const addSubject = (sub) => {
    if (atLimit) return;
    if (!profileForm.subjects.includes(sub)) {
      setProfileForm({ ...profileForm, subjects: [...profileForm.subjects, sub] });
    }
  };

  const addCustomSubject = () => {
    const trimmed = subjectSearch.trim();
    if (!trimmed || atLimit) return;
    if (!profileForm.subjects.includes(trimmed)) {
      setProfileForm({ ...profileForm, subjects: [...profileForm.subjects, trimmed] });
    }
    setSubjectSearch('');
  };

  const removeSubject = (sub) => {
    setProfileForm({ ...profileForm, subjects: profileForm.subjects.filter(s => s !== sub) });
  };

  // Filter suggestions: exclude already selected, then filter by search query
  const getFilteredGroups = () => {
    const query = subjectSearch.toLowerCase().trim();
    return suggestionGroups.map(group => ({
      ...group,
      items: group.items.filter(item =>
        !profileForm.subjects.includes(item) &&
        (query === '' || item.toLowerCase().includes(query))
      ),
    })).filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();
  const hasAnyResult = filteredGroups.some(g => g.items.length > 0);
  const searchMatchesExact = subjectSearch.trim() && !suggestionGroups.some(g => g.items.some(i => i.toLowerCase() === subjectSearch.trim().toLowerCase()));

  return (
    <div className="max-w-[800px] mx-auto relative">
      <h1 className="font-sora text-2xl font-bold text-navy mb-6">Student Profile</h1>
      
      {/* Success Toast */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${successToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="bg-success text-white px-6 py-3 rounded-full font-semibold shadow-brand-xl flex items-center gap-2">
          <i className="fa-solid fa-circle-check" /> Profile updated successfully!
        </div>
      </div>

      <div className="bg-white rounded-brand shadow-brand p-6 md:p-8">
        <h2 className="font-sora text-xl font-bold text-navy mb-6">My Profile</h2>
        <div className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Full Name</label>
            <input 
              type="text" 
              value={profileForm.name} 
              onChange={handleNameChange} 
              className={`w-full py-2.5 px-3 border-2 ${nameError ? 'border-error/50 bg-error/5' : 'border-slate-200'} rounded-lg text-sm outline-none focus:border-sky font-medium text-navy transition`} 
            />
            {nameError && <p className="text-error text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fa-solid fa-circle-exclamation" /> {nameError}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Class / Grade</label>
            <select 
              value={profileForm.class} 
              onChange={e => setProfileForm({...profileForm, class: e.target.value})} 
              className="w-full py-2.5 px-3 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-sky bg-white font-medium text-navy cursor-pointer transition"
            >
              {[6,7,8,9,10,11,12].map(c => <option key={c}>Class {c}</option>)}
              <option>College</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">City</label>
            <input 
              type="text" 
              value={profileForm.location} 
              onChange={handleCityChange} 
              className={`w-full py-2.5 px-3 border-2 ${cityError ? 'border-error/50 bg-error/5' : 'border-slate-200'} rounded-lg text-sm outline-none focus:border-sky font-medium text-navy transition`} 
            />
            {cityError && <p className="text-error text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fa-solid fa-circle-exclamation" /> {cityError}</p>}
          </div>

          {/* Subjects of Interest — Smart Suggestions */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-semibold text-navy mb-1.5">
              Subjects of Interest
              <span className="text-slate-400 font-normal ml-1">({profileForm.subjects.length}/{MAX_SUBJECTS})</span>
            </label>

            {/* Selected subject chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {profileForm.subjects.map(s => (
                <span key={s} className="bg-navy text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                  {s}
                  <button onClick={() => removeSubject(s)} className="hover:bg-white/20 transition w-4 h-4 rounded-full flex items-center justify-center text-white/70 hover:text-white">
                    <i className="fa-solid fa-xmark text-[10px]" />
                  </button>
                </span>
              ))}

              {/* Add Subject button */}
              {!showSubjectDropdown && (
                <button
                  onClick={() => { if (!atLimit) setShowSubjectDropdown(true); }}
                  disabled={atLimit}
                  className={`border-2 border-dashed text-xs font-bold px-3 py-1.5 rounded-full transition ${
                    atLimit
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 text-slate-400 hover:border-navy hover:text-navy'
                  }`}
                >
                  + Add Subject
                </button>
              )}
            </div>

            {atLimit && !showSubjectDropdown && (
              <p className="text-amber-600 text-xs font-medium flex items-center gap-1 mb-2">
                <i className="fa-solid fa-circle-info" /> Maximum {MAX_SUBJECTS} subjects reached
              </p>
            )}

            {/* Suggestions Dropdown */}
            {showSubjectDropdown && (
              <div className="bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden animate-fadeIn">
                {/* Search input */}
                <div className="p-3 border-b border-slate-100">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                      type="text"
                      autoFocus
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomSubject();
                        }
                      }}
                      placeholder="Search or type a subject..."
                      className="w-full py-2 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-sky font-medium text-navy transition placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {atLimit ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-amber-600 text-sm font-semibold">Maximum {MAX_SUBJECTS} subjects reached</p>
                    <p className="text-slate-400 text-xs mt-1">Remove a subject to add a new one</p>
                  </div>
                ) : (
                  <div className="max-h-[280px] overflow-y-auto p-3 space-y-4">
                    {filteredGroups.map(group => (
                      <div key={group.label}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">{group.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.items.map(item => {
                            const query = subjectSearch.toLowerCase().trim();
                            const isHighlighted = query && item.toLowerCase().includes(query);
                            return (
                              <button
                                key={item}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => addSubject(item)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                                  isHighlighted
                                    ? 'bg-amber/20 text-amber-700 border border-amber/30 shadow-sm'
                                    : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-amber/10 hover:text-amber-700'
                                }`}
                              >
                                {item}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* No results + custom add */}
                    {!hasAnyResult && subjectSearch.trim() && (
                      <div className="text-center py-3">
                        <p className="text-slate-400 text-sm mb-3">No suggestions found for "{subjectSearch}"</p>
                        <button
                          onClick={addCustomSubject}
                          className="text-xs font-bold px-4 py-2 bg-navy text-white rounded-full hover:bg-navy-light transition shadow-sm"
                        >
                          + Add "{subjectSearch.trim()}" as custom subject
                        </button>
                      </div>
                    )}

                    {/* Custom add button when search term exists and isn't already a suggestion */}
                    {hasAnyResult && searchMatchesExact && subjectSearch.trim() && !profileForm.subjects.includes(subjectSearch.trim()) && (
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          onClick={addCustomSubject}
                          className="text-xs font-bold px-4 py-2 bg-slate-100 text-navy rounded-full hover:bg-amber/10 hover:text-amber-700 transition w-full"
                        >
                          + Add custom subject "{subjectSearch.trim()}"
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={handleSaveProfile}
            disabled={saving}
            className="py-3 px-6 bg-navy text-white rounded-lg text-sm font-bold hover:bg-navy-light transition shadow-brand hover:shadow-brand-xl disabled:opacity-70 disabled:cursor-not-allowed mt-4 flex items-center justify-center min-w-[140px]"
          >
            {saving ? (
              <><Spinner size="sm" /> <span className="ml-2">Saving...</span></>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default StudentProfile;

