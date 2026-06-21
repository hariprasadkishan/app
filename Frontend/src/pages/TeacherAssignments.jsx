import { useState, useEffect } from 'react';

const initialRequests = [
  { id: 1, student: 'Aarav Patel', subject: 'Mathematics', topic: 'Trigonometry Identities', deadline: 'Oct 30, 2023', question: "I'm having trouble proving that sin^4(x) - cos^4(x) = sin^2(x) - cos^2(x). Can you explain the steps?", status: 'pending' },
  { id: 2, student: 'Sanya Sharma', subject: 'Physics', topic: 'Kinematics', deadline: 'Nov 02, 2023', question: "How do you derive the third equation of motion (v^2 = u^2 + 2as) using calculus?", status: 'pending' }
];

const completedRequests = [
  { id: 3, student: 'Rohan Gupta', subject: 'Chemistry', topic: 'Balancing Equations', deadline: 'Oct 25, 2023', question: "Help balancing C6H12O6 + O2 -> CO2 + H2O", answer: "Start by balancing the carbons (6), then hydrogens (12), and finally oxygen. The balanced equation is C6H12O6 + 6O2 -> 6CO2 + 6H2O.", dateAnswered: 'Oct 24, 2023' }
];

const TeacherAssignments = () => {
  const [activeTab, setActiveTab] = useState('new');
  const [requests, setRequests] = useState(initialRequests);
  const [completed, setCompleted] = useState(completedRequests);
  
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState('');

  useEffect(() => {
    document.title = 'Assignment Requests — TrueEdu';
    window.scrollTo(0, 0);
  }, []);

  const handleSubmitAnswer = (req) => {
    if (!answerText.trim()) return;
    
    // Move from requests to completed
    const answeredReq = { ...req, status: 'answered', answer: answerText, dateAnswered: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) };
    setCompleted([answeredReq, ...completed]);
    setRequests(requests.filter(r => r.id !== req.id));
    
    // Reset
    setAnsweringId(null);
    setAnswerText('');
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="font-sora text-3xl font-bold text-navy mb-2">Assignment Requests</h1>
        <p className="text-muted">Help your students by providing detailed answers to their assignment questions.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-200 mb-8">
        <button 
          onClick={() => { setActiveTab('new'); setAnsweringId(null); }}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${activeTab === 'new' ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-navy'}`}
        >
          New Requests
          {requests.length > 0 && <span className="bg-error text-white text-[10px] px-2 py-0.5 rounded-full">{requests.length}</span>}
        </button>
        <button 
          onClick={() => { setActiveTab('completed'); setAnsweringId(null); }}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${activeTab === 'completed' ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-navy'}`}
        >
          Completed
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="space-y-6">
          {requests.length === 0 ? (
            <div className="bg-white p-10 rounded-brand shadow-sm border border-slate-200 text-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                <i className="fa-solid fa-check-double" />
              </div>
              <h3 className="font-sora text-xl font-bold text-navy mb-1">All Caught Up!</h3>
              <p className="text-muted text-sm">You have no pending assignment requests.</p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="bg-white rounded-brand shadow-sm border border-slate-200 overflow-hidden transition-all">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-sora font-bold text-navy text-lg">{req.topic}</h3>
                        <span className="text-[10px] font-bold text-sky bg-sky/10 px-2 py-0.5 rounded uppercase tracking-wider">{req.subject}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <i className="fa-regular fa-user" /> {req.student}
                      </p>
                    </div>
                    <div className="bg-amber/10 border border-amber/20 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                      <i className="fa-regular fa-clock" /> Deadline: {req.deadline}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm font-medium text-slate-700 mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Student's Question:</span>
                    {req.question}
                  </div>

                  {answeringId === req.id ? (
                    <div className="animate-fade-in border-t border-slate-100 pt-4 mt-4">
                      <label className="block text-sm font-semibold text-navy mb-2">Your Answer</label>
                      <textarea 
                        value={answerText} 
                        onChange={e => setAnswerText(e.target.value)} 
                        rows="5" 
                        className="w-full py-3 px-4 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-navy transition resize-none mb-4" 
                        placeholder="Type your detailed explanation here..." 
                      />
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => { setAnsweringId(null); setAnswerText(''); }} className="py-2.5 px-6 bg-white border border-slate-200 text-slate-500 font-bold rounded-lg hover:bg-slate-50 transition text-sm">
                          Cancel
                        </button>
                        <button onClick={() => handleSubmitAnswer(req)} className="py-2.5 px-6 bg-navy text-white font-bold rounded-lg hover:bg-navy-light transition shadow-md flex items-center gap-2 text-sm">
                          <i className="fa-solid fa-paper-plane" /> Submit Answer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button onClick={() => { setAnsweringId(req.id); setAnswerText(''); }} className="py-2.5 px-6 bg-white border-2 border-slate-200 text-navy font-bold rounded-lg hover:bg-slate-50 hover:border-navy transition text-sm flex items-center gap-2">
                        <i className="fa-regular fa-pen-to-square" /> View & Answer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {completed.length === 0 ? (
            <p className="text-center text-slate-400 font-medium py-10">No completed assignments yet.</p>
          ) : (
            completed.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-brand shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-sora font-bold text-navy text-lg mb-1">{req.topic}</h3>
                    <p className="text-sm font-medium text-slate-500">{req.student} • {req.subject}</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-green-50 text-success border border-green-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                      <i className="fa-solid fa-check" /> Answered
                    </span>
                    <p className="text-xs text-slate-400 font-medium mt-2">{req.dateAnswered}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Question</span>
                    <p className="text-slate-600 font-medium">{req.question}</p>
                  </div>
                  <div className="bg-sky/5 p-4 rounded-lg border border-sky/10 text-sm">
                    <span className="text-xs font-bold text-sky uppercase tracking-wider block mb-2">Your Answer</span>
                    <p className="text-slate-700 font-medium">{req.answer}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherAssignments;
