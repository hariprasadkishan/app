import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const dummyRooms = [
  { id: 1, name: 'Crash Course: Organic Chemistry', teacher: 'Ravi Kumar', rating: 4.9, subject: 'Chemistry', date: 'Oct 25, 2023 - 05:00 PM', students: 12, max: 20, mode: 'Online', price: 499 },
  { id: 2, name: 'Board Prep: Calculus Masterclass', teacher: 'Neha Gupta', rating: 4.8, subject: 'Mathematics', date: 'Oct 28, 2023 - 10:00 AM', students: 8, max: 15, mode: 'Offline', price: 799 },
  { id: 3, name: 'Physics Numericals: Mechanics', teacher: 'Priya Patel', rating: 4.7, subject: 'Physics', date: 'Oct 29, 2023 - 04:00 PM', students: 25, max: 25, mode: 'Online', price: 399 },
  { id: 4, name: 'English Grammar Review', teacher: 'Rahul Sharma', rating: 4.6, subject: 'English', date: 'Nov 02, 2023 - 06:00 PM', students: 5, max: 10, mode: 'Online', price: 299 },
];

const StudentRooms = () => {
  const [filterSubject, setFilterSubject] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [joinedRooms, setJoinedRooms] = useState([]);

  useEffect(() => {
    document.title = 'Browse Group Rooms — TrueEd';
    window.scrollTo(0, 0);
  }, []);

  const filteredRooms = useMemo(() => {
    return dummyRooms.filter(room => {
      if (filterSubject && room.subject !== filterSubject) return false;
      if (filterDate && !room.date.includes(filterDate)) return false; // Simple string match for dummy data
      return true;
    });
  }, [filterSubject, filterDate]);

  const handleJoinClick = (room) => {
    setSelectedRoom(room);
    setShowModal(true);
  };

  const handleConfirmJoin = () => {
    setJoinedRooms(prev => [...prev, selectedRoom.id]);
    setShowModal(false);
    setSelectedRoom(null);
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-sora text-3xl font-bold text-navy mb-2">Browse Group Rooms</h1>
          <p className="text-muted">Join group sessions hosted by top teachers at affordable prices.</p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-3">
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="py-2.5 px-4 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-navy outline-none focus:border-navy shadow-sm">
            <option value="">All Subjects</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="English">English</option>
          </select>
          {/* Simple dummy date filter */}
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="py-2.5 px-4 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-navy outline-none focus:border-navy shadow-sm">
            <option value="">Any Date</option>
            <option value="Oct 25">Oct 25</option>
            <option value="Oct 28">Oct 28</option>
            <option value="Oct 29">Oct 29</option>
            <option value="Nov 02">Nov 02</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredRooms.map(room => {
          const isFull = room.students >= room.max;
          const isJoined = joinedRooms.includes(room.id);

          return (
            <div key={room.id} className="bg-white rounded-brand-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden hover:-translate-y-1 hover:shadow-brand transition-all">
              <div className="p-5 border-b border-slate-100 relative">
                <span className="absolute top-5 right-5 text-[10px] font-bold text-sky bg-sky/10 px-2 py-0.5 rounded uppercase tracking-wider">{room.subject}</span>
                <h3 className="font-sora font-bold text-navy text-lg mb-1 pr-20 line-clamp-2">{room.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-navy to-sky text-white flex items-center justify-center text-[10px] font-bold">
                    {room.teacher.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{room.teacher}</span>
                  <span className="text-xs font-bold text-amber flex items-center gap-1 ml-2"><i className="fa-solid fa-star" /> {room.rating}</span>
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                    <div className="w-8 flex justify-center text-slate-400"><i className="fa-regular fa-calendar text-lg" /></div>
                    <span>{room.date}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                    <div className="w-8 flex justify-center text-slate-400"><i className={`fa-solid ${room.mode === 'Online' ? 'fa-laptop' : 'fa-house-user'} text-lg`} /></div>
                    <span>{room.mode}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                    <div className="w-8 flex justify-center text-slate-400"><i className="fa-solid fa-users text-lg" /></div>
                    <div className="w-full flex items-center justify-between">
                      <span>{room.students} / {room.max} Seats Filled</span>
                      {isFull && !isJoined && <span className="text-xs font-bold text-error bg-red-50 px-2 py-0.5 rounded">FULL</span>}
                    </div>
                  </div>
                  {/* Progress bar for seats */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 ml-11 max-w-[calc(100%-2.75rem)]">
                    <div className={`h-full rounded-full ${isFull ? 'bg-error' : 'bg-sky'}`} style={{ width: `${(room.students/room.max)*100}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                    <p className="font-sora font-extrabold text-xl text-navy">₹{room.price}</p>
                  </div>
                  
                  {isJoined ? (
                    <div className="text-right">
                      <span className="inline-block py-2.5 px-6 bg-green-50 text-success font-bold rounded-lg text-sm border border-green-200">
                        <i className="fa-solid fa-check mr-1" /> Joined
                      </span>
                      <p className="text-[10px] text-muted font-medium mt-1">Check My Bookings</p>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleJoinClick(room)}
                      disabled={isFull}
                      className={`py-2.5 px-6 rounded-lg font-bold text-sm transition shadow-sm ${isFull ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-navy text-white hover:bg-navy-light hover:shadow-md'}`}
                    >
                      Join Room
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Booking Modal */}
      {showModal && selectedRoom && (
        <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-brand shadow-2xl animate-scale-in overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-sora font-bold text-xl text-navy mb-1">Confirm Booking</h3>
              <p className="text-sm text-slate-500 font-medium">You are about to join a group session.</p>
            </div>
            <div className="p-6 bg-slate-50">
              <h4 className="font-bold text-navy mb-1">{selectedRoom.name}</h4>
              <p className="text-sm text-slate-600 mb-4 flex items-center gap-1.5"><i className="fa-regular fa-calendar" /> {selectedRoom.date}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Session Fee</span>
                  <span className="font-semibold text-navy">₹{selectedRoom.price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Platform Fee (15%)</span>
                  <span className="font-semibold text-navy">₹{Math.round(selectedRoom.price * 0.15)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Access Fee</span>
                  <span className="font-semibold text-navy">₹19</span>
                </div>
                <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-lg">
                  <span className="text-navy">Total</span>
                  <span className="text-navy">₹{selectedRoom.price + Math.round(selectedRoom.price * 0.15) + 19}</span>
                </div>
              </div>

              <button onClick={handleConfirmJoin} className="w-full py-3.5 bg-success text-white rounded-lg font-sora font-bold text-[15px] hover:shadow-lg transition flex items-center justify-center gap-2 mb-3 shadow-md">
                <i className="fa-solid fa-lock" /> Pay & Join Room
              </button>
              <button onClick={() => setShowModal(false)} className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-navy transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentRooms;
