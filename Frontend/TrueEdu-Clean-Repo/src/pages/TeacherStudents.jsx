import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const mockStudents = [
  { id: 1, name: 'Aarav Sharma', initials: 'AS', grade: 'Class 12', city: 'Mumbai', subjects: ['Physics', 'Math'], totalSessions: 14, lastSession: '2023-10-24', status: 'Active' },
  { id: 2, name: 'Priya Kapoor', initials: 'PK', grade: 'Class 10', city: 'Delhi', subjects: ['Math', 'Science'], totalSessions: 8, lastSession: '2023-10-20', status: 'Active' },
  { id: 3, name: 'Rahul Verma', initials: 'RV', grade: 'Class 11', city: 'Bangalore', subjects: ['Chemistry'], totalSessions: 22, lastSession: '2023-09-15', status: 'Inactive' },
  { id: 4, name: 'Sneha Patel', initials: 'SP', grade: 'Class 9', city: 'Ahmedabad', subjects: ['English', 'SST'], totalSessions: 5, lastSession: '2023-10-25', status: 'Active' },
  { id: 5, name: 'Karan Singh', initials: 'KS', grade: 'Class 12', city: 'Pune', subjects: ['Physics'], totalSessions: 3, lastSession: '2023-10-10', status: 'Inactive' },
  { id: 6, name: 'Neha Gupta', initials: 'NG', grade: 'Class 8', city: 'Lucknow', subjects: ['Math'], totalSessions: 12, lastSession: '2023-10-22', status: 'Active' },
  { id: 7, name: 'Vikram Joshi', initials: 'VJ', grade: 'Class 11', city: 'Jaipur', subjects: ['Biology', 'Chemistry'], totalSessions: 19, lastSession: '2023-10-23', status: 'Active' },
  { id: 8, name: 'Aditi Rao', initials: 'AR', grade: 'Class 10', city: 'Hyderabad', subjects: ['Physics', 'Math'], totalSessions: 2, lastSession: '2023-08-05', status: 'Inactive' },
];

export default function TeacherStudents() {
  useEffect(() => {
    document.title = "My Students — TrueEdu";
  }, []);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filteredStudents = mockStudents.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' ? true : s.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-sora font-extrabold text-navy">My Students</h1>
          <span className="bg-sky-100 text-sky-700 font-bold px-3 py-1 rounded-full text-sm">
            {mockStudents.length} Total
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => console.log('clicked')} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 transition">
            <i className="fa-solid fa-download mr-2"></i>Export
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between gap-4">
        <div className="relative w-full md:w-96">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input 
            type="text" 
            placeholder="Search students by name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0" style={{scrollbarWidth: 'none'}}>
          {['All', 'Active', 'Inactive'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${filter === tab ? 'bg-navy text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
            >
              {tab === 'All' ? 'All Students' : tab}
            </button>
          ))}
        </div>
      </div>

      {filteredStudents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStudents.map(student => (
            <div key={student.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-100 to-blue-50 flex items-center justify-center text-sky-700 font-bold text-xl border border-sky-100">
                  {student.initials}
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${student.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {student.status}
                </span>
              </div>
              <h3 className="font-bold text-navy text-lg">{student.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{student.grade} • {student.city}</p>
              
              <div className="flex flex-wrap gap-1 mb-4">
                {student.subjects.map((sub, i) => (
                  <span key={i} className="text-xs bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded">
                    {sub}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-gray-50 pt-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Sessions</p>
                  <p className="font-bold text-navy">{student.totalSessions}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Last Session</p>
                  <p className="font-bold text-navy text-sm">{student.lastSession}</p>
                </div>
              </div>

              <button onClick={() => console.log('clicked')} className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition text-sm">
                View History
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <i className="fa-solid fa-user-xmark text-4xl text-gray-300"></i>
          </div>
          <h3 className="text-xl font-bold text-navy mb-2">No students found</h3>
          <p className="text-gray-500 max-w-sm">We couldn't find any students matching your current search or filter criteria. Try adjusting your filters.</p>
          <button 
            onClick={() => { setSearch(''); setFilter('All'); }}
            className="mt-6 text-sky font-bold hover:underline"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
