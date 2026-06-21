import { useState, useEffect } from 'react';
import { teacherQueriesData } from '../data/teacherQueries';
import { Link } from 'react-router-dom';

const TeacherQueriesPage = () => {
  const [queries, setQueries] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [activeQueryId, setActiveQueryId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    document.title = "Student Queries — TrueEdu";
    setQueries(teacherQueriesData);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openReplyModal = (id) => {
    setActiveQueryId(id);
    setReplyText('');
    setReplyModalOpen(true);
  };

  const openDeclineModal = (id) => {
    setActiveQueryId(id);
    setDeclineModalOpen(true);
  };

  const handleSendReply = () => {
    setQueries(queries.map(q => q.id === activeQueryId ? { 
      ...q, 
      status: 'replied', 
      reply: replyText, 
      replyDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } : q));
    setReplyModalOpen(false);
    showToast('Reply sent successfully');
  };

  const handleDeclineConfirm = () => {
    setQueries(queries.map(q => q.id === activeQueryId ? { ...q, status: 'declined' } : q));
    setDeclineModalOpen(false);
    showToast('Query declined');
  };

  const filteredQueries = activeTab === 'All' 
    ? queries 
    : queries.filter(q => q.status === activeTab.toLowerCase());

  // Analytics
  const queriesThisMonth = queries.length; // dummy
  const repliedCount = queries.filter(q => q.status === 'replied').length;
  const totalActioned = queries.filter(q => q.status === 'replied' || q.status === 'declined').length;
  const responseRate = totalActioned > 0 ? Math.round((repliedCount / totalActioned) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-8">
      <div>
        <h1 className="font-sora text-3xl font-bold text-navy mb-2">Student Queries</h1>
        <p className="text-slate-500 font-medium">Manage and reply to students interested in learning from you.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-sky/10 text-sky rounded-full flex items-center justify-center text-xl shrink-0"><i className="fa-regular fa-comments" /></div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Queries This Month</p>
            <p className="font-sora font-extrabold text-2xl text-navy">{queriesThisMonth}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xl shrink-0"><i className="fa-solid fa-chart-line" /></div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Response Rate</p>
            <p className="font-sora font-extrabold text-2xl text-navy">{responseRate}%</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-xl shrink-0"><i className="fa-regular fa-clock" /></div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Response Time</p>
            <p className="font-sora font-extrabold text-2xl text-navy">4 Hours</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-8">
        {['All', 'Pending', 'Replied', 'Declined'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === tab ? 'text-navy' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-navy rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* Query List */}
      <div className="space-y-6">
        {filteredQueries.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-4"><i className="fa-regular fa-folder-open" /></div>
            <h3 className="font-sora font-bold text-navy text-lg mb-2">No queries found</h3>
            <p className="text-slate-500 text-sm">You don't have any {activeTab.toLowerCase()} queries at the moment.</p>
          </div>
        ) : (
          filteredQueries.map(query => (
            <div key={query.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-6 items-start">
              
              {/* Left Column: Student Info & Preferences */}
              <div className="w-full lg:w-1/3 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg shrink-0">
                    {query.initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-navy">{query.student}</h3>
                    <p className="text-xs text-slate-500">Query Date: {query.date}</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500 font-medium">Class:</span>
                    <span className="font-semibold text-navy">{query.classLevel}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500 font-medium">Subject:</span>
                    <span className="font-semibold text-navy">{query.subject}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500 font-medium">Mode:</span>
                    <span className="font-semibold text-navy">{query.preferredMode}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500 font-medium">Days:</span>
                    <span className="font-semibold text-navy">{query.preferredDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Time:</span>
                    <span className="font-semibold text-navy">{query.preferredTime}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Message & Actions */}
              <div className="w-full flex-1 border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-6 flex flex-col h-full">
                
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-navy text-sm uppercase tracking-wide">Conversation</h4>
                  <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                    query.status === 'replied' ? 'bg-green-100 text-green-700' :
                    query.status === 'declined' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {query.status}
                  </div>
                </div>

                {query.status === 'replied' ? (
                  <div className="space-y-4 flex-1">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 mb-1">Student:</p>
                      <p className="text-sm text-slate-700">"{query.message}"</p>
                    </div>
                    <div className="bg-sky/5 p-4 rounded-xl border border-sky/20">
                      <p className="text-xs font-bold text-sky mb-1">Teacher (You):</p>
                      <p className="text-sm text-navy font-medium">"{query.reply}"</p>
                      <p className="text-[11px] text-slate-400 mt-2">Replied On: {query.replyDate}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex-1">
                    <p className="text-xs font-bold text-slate-500 mb-1">Student Message:</p>
                    <p className="text-sm text-slate-700">"{query.message}"</p>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {query.status === 'pending' && (
                    <>
                      <button onClick={() => openReplyModal(query.id)} className="px-6 py-2.5 bg-navy text-white text-sm font-bold rounded-lg hover:bg-navy-light transition shadow-sm">
                        Reply to Query
                      </button>
                      <button onClick={() => openDeclineModal(query.id)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 transition">
                        Decline
                      </button>
                    </>
                  )}
                  {query.status === 'replied' && (
                    <>
                      <button className="px-6 py-2 bg-white border border-slate-200 text-navy text-xs font-bold rounded-lg hover:bg-slate-50 transition">
                        Book Trial Session
                      </button>
                      <button className="px-6 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition">
                        View Student Profile
                      </button>
                    </>
                  )}
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply Modal */}
      {replyModalOpen && (() => {
        const query = queries.find(q => q.id === activeQueryId);
        return (
          <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-brand shadow-2xl animate-scale-in overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-sora font-bold text-lg text-navy">Reply to {query?.student}</h3>
                <button onClick={() => setReplyModalOpen(false)} className="text-slate-400 hover:text-navy"><i className="fa-solid fa-xmark text-xl" /></button>
              </div>
              <div className="p-6">
                <label className="block text-xs font-semibold text-navy/70 mb-2 uppercase flex justify-between">
                  <span>Your Response</span>
                  <span className={replyText.length > 500 ? 'text-error' : 'text-slate-400'}>{replyText.length}/500</span>
                </label>
                <textarea 
                  value={replyText} 
                  onChange={(e) => setReplyText(e.target.value)} 
                  maxLength={500}
                  rows="5" 
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm outline-none focus:border-navy resize-none mb-6" 
                  placeholder="Type your response..."
                ></textarea>
                <div className="flex gap-3">
                  <button onClick={() => setReplyModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition">Cancel</button>
                  <button onClick={handleSendReply} disabled={!replyText.trim() || replyText.length > 500} className="flex-[2] py-3 bg-navy text-white font-bold rounded-lg hover:bg-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Send Reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Decline Modal */}
      {declineModalOpen && (
        <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-brand shadow-2xl animate-scale-in overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-error rounded-full flex items-center justify-center text-2xl mx-auto mb-4"><i className="fa-solid fa-triangle-exclamation" /></div>
              <h3 className="font-sora font-bold text-xl text-navy mb-2">Decline Query?</h3>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to decline this query? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeclineModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition">Cancel</button>
                <button onClick={handleDeclineConfirm} className="flex-1 py-3 bg-error text-white font-bold rounded-lg hover:bg-red-600 transition">Decline Query</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-navy text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in">
          <i className="fa-solid fa-circle-check text-success text-xl" />
          <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default TeacherQueriesPage;
