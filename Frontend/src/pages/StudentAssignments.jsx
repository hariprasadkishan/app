import { useState, useEffect } from 'react';

const dummyAssignments = [
  { id: 1, subject: 'Mathematics', topic: 'Calculus - Integration', status: 'Answered', date: 'Oct 24, 2023', answer: "Here is the step-by-step breakdown for integrating by parts: \n\n1. Let u = x, dv = e^x dx \n2. Then du = dx, v = e^x \n3. Using the formula uv - ∫v du \n\nThe final answer is x*e^x - e^x + C. Let me know if you need more clarification!" },
  { id: 2, subject: 'Physics', topic: 'Thermodynamics Laws', status: 'Reviewed', date: 'Oct 20, 2023', answer: "Your understanding of the first law is correct. Energy is always conserved. However, your notes on entropy (second law) need a small correction. Entropy of an isolated system always increases over time, it never remains constant unless the process is reversible." },
  { id: 3, subject: 'Chemistry', topic: 'Organic Reactions', status: 'Pending', date: 'Oct 26, 2023', answer: null }
];

const StudentAssignments = () => {
  const [activeTab, setActiveTab] = useState('submit');
  const [showModal, setShowModal] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  
  const [form, setForm] = useState({
    subject: '', class: '', topic: '', description: '', deadline: ''
  });

  useEffect(() => {
    document.title = 'Assignment Help — TrueEdu';
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm({ subject: '', class: '', topic: '', description: '', deadline: '' });
      setActiveTab('my-assignments');
    }, 2000);
  };

  const handleViewAnswer = (assignment) => {
    setSelectedAnswer(assignment);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    if (status === 'Answered') return <span className="bg-green-50 text-success border border-green-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Answered</span>;
    if (status === 'Reviewed') return <span className="bg-sky/10 text-sky border border-sky/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Reviewed</span>;
    return <span className="bg-amber/10 text-amber border border-amber/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Pending</span>;
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="font-sora text-3xl font-bold text-navy mb-2">Assignment Help</h1>
        <p className="text-muted">Stuck on a problem? Submit your assignment and get help from expert teachers.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-200 mb-8">
        <button 
          onClick={() => setActiveTab('submit')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${activeTab === 'submit' ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-navy'}`}
        >
          Submit Assignment
        </button>
        <button 
          onClick={() => setActiveTab('my-assignments')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${activeTab === 'my-assignments' ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-navy'}`}
        >
          My Assignments
        </button>
      </div>

      {activeTab === 'submit' ? (
        submitted ? (
          <div className="bg-white p-10 rounded-brand shadow-sm border border-slate-200 text-center animate-fade-in">
            <div className="w-16 h-16 bg-green-50 text-success rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              <i className="fa-solid fa-check" />
            </div>
            <h3 className="font-sora text-xl font-bold text-navy mb-2">Assignment Submitted!</h3>
            <p className="text-muted text-sm">A teacher will review your request and provide an answer soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-brand shadow-sm border border-slate-200 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-navy mb-2">Subject</label>
                <input required type="text" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-navy transition" placeholder="e.g. Mathematics" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy mb-2">Class / Grade</label>
                <input required type="text" value={form.class} onChange={e => setForm({...form, class: e.target.value})} className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-navy transition" placeholder="e.g. Class 12" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-navy mb-2">Topic</label>
                <input required type="text" value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-navy transition" placeholder="e.g. Integration by parts" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-navy mb-2">Assignment Question / Description</label>
                <textarea required value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows="4" className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-navy transition resize-none" placeholder="Type your question or describe what you need help with..." />
              </div>
              
              <div className="md:col-span-2 border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50 hover:bg-slate-100 transition cursor-pointer">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-sm border border-slate-100">
                  <i className="fa-solid fa-cloud-arrow-up" />
                </div>
                <p className="text-sm font-semibold text-navy mb-1">Click to upload file</p>
                <p className="text-xs text-muted">PDF, JPG, PNG up to 10MB (UI Only)</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-navy mb-2">Deadline</label>
                <input required type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-navy transition" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button type="submit" className="py-3.5 px-8 bg-navy text-white rounded-lg font-sora font-semibold hover:bg-navy-light hover:-translate-y-0.5 transition shadow-brand">
                Submit Request
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="space-y-4">
          {dummyAssignments.map(a => (
            <div key={a.id} className="bg-white p-6 rounded-brand shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-sora font-bold text-navy text-lg">{a.topic}</h3>
                  {getStatusBadge(a.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500 font-medium mb-1">
                  <span>{a.subject}</span>
                  <span>•</span>
                  <span>Submitted: {a.date}</span>
                </div>
              </div>
              <div className="flex items-center">
                {a.status !== 'Pending' ? (
                  <button 
                    onClick={() => handleViewAnswer(a)}
                    className="py-2.5 px-6 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-light transition shadow-sm whitespace-nowrap"
                  >
                    View Answer
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-slate-400 italic">Awaiting Response</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Answer Modal */}
      {showModal && selectedAnswer && (
        <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-brand-lg shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                <h3 className="font-sora font-bold text-xl text-navy mb-1">Teacher Response</h3>
                <p className="text-sm text-slate-500 font-medium">{selectedAnswer.topic} • {selectedAnswer.subject}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-navy hover:bg-slate-100 transition shadow-sm">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="bg-sky/5 border border-sky/10 rounded-xl p-5 relative">
                <i className="fa-solid fa-quote-left absolute top-4 right-4 text-sky/20 text-3xl" />
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedAnswer.answer}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 text-right">
              <button onClick={() => setShowModal(false)} className="py-2.5 px-6 bg-white border border-slate-200 text-navy font-bold rounded-lg hover:bg-slate-100 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAssignments;
