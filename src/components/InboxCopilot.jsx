import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BrainCircuit, CalendarDays, Check, Clock3, CornerDownLeft, Inbox, MessageSquareText, Search, ShieldCheck, Sparkles, UserRoundCheck, X } from 'lucide-react';
import { answerInboxQuestion, getInboxSignals } from '../lib/inboxCopilot.js';

const SUGGESTIONS = [
  'What should I focus on today?',
  'Which emails need Alex’s approval?',
  'What am I waiting for?',
  'Show meetings and scheduling',
  'Which conversations need review?',
  'What deadlines are mentioned?',
];
const responsibilityText = {assistant:'Maya to reply',client:'Alex to reply',review:'Needs review',none:'No reply needed'};

export default function InboxCopilot({ emails, selectedId, onClose, onOpenThread }) {
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const entryRef = useRef(null);
  const signals = useMemo(() => getInboxSignals(emails), [emails]);
  const [answer, setAnswer] = useState(null);
  const [pending, setPending] = useState(false);
  const [answerMode, setAnswerMode] = useState('demo');
  const requestCounter = useRef(0);

  useEffect(() => {
    entryRef.current?.focus();
    const onKeyDown = (event) => {
      if(event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown',onKeyDown);
    return () => window.removeEventListener('keydown',onKeyDown);
  }, [onClose]);

  const ask = async value => {
    const clean=String(value||'').trim().slice(0,220);
    if(!clean)return;
    const request=++requestCounter.current;
    setQuestion(clean);
    setInput('');
    setPending(true);
    setAnswer(null);
    try {
      const response=await fetch('/api/ask',{
        method:'POST',headers:{'Content-Type':'application/json','X-Relay-Request':'1'},
        body:JSON.stringify({question:clean,emails,selectedId}),
      });
      if(!response.ok)throw new Error('AI API unavailable');
      const data=await response.json();
      if(!data.answer || typeof data.answer.answer!=='string') throw new Error('Invalid answer');
      const normalized=data.mode==='live' ? {
        intent:'live', title:data.answer.title||'Inbox answer',answer:data.answer.answer,
        results:(data.answer.sourceIds||[]).map(id=>emails.find(e=>e.id===id))
          .filter(Boolean).map(e=>({id:e.id,name:e.name,subject:e.subject,
            category:e.group,summary:String(e.summary||'').slice(0,230)})),
        total:(data.answer.sourceIds||[]).length,
        source:'Live GroqCloud AI · checked against current inbox IDs',
      } : data.answer;
      if(request===requestCounter.current){setAnswer(normalized);setAnswerMode(data.mode||'demo');}
    } catch {
      if(request===requestCounter.current){
        setAnswer(answerInboxQuestion(clean,emails,selectedId));
        setAnswerMode('demo');
      }
    } finally {if(request===requestCounter.current)setPending(false);}
  };

  return <div className="copilot-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="copilot-panel" role="dialog" aria-modal="true" aria-labelledby="copilot-title">
      <header className="copilot-header">
        <div className="copilot-logo"><BrainCircuit size={23}/></div>
        <div className="copilot-header-main"><span className="copilot-eyebrow">RELAY INTELLIGENCE</span><h2 id="copilot-title">Ask your inbox</h2><span>Find decisions, follow-ups and important conversations in seconds.</span></div>
        <button className="copilot-close" aria-label="Close inbox copilot" onClick={onClose}><X size={21}/></button>
      </header>

      <div className="copilot-body">
        <section className="copilot-quick-summary" aria-label="Live inbox briefing">
          <div className="copilot-subtitle"><Sparkles size={15}/> <b>Live inbox briefing</b><span>Based on your current demo conversations</span></div>
          <div className="copilot-stats">
            <div><UserRoundCheck size={16}/><strong>{signals.client}</strong><span>For Alex</span></div>
            <div><Inbox size={16}/><strong>{signals.assistant}</strong><span>For Maya</span></div>
            <div><Clock3 size={16}/><strong>{signals.waiting}</strong><span>Waiting</span></div>
            <div><MessageSquareText size={16}/><strong>{signals.review}</strong><span>To review</span></div>
          </div>
        </section>

        {pending && <section className="copilot-answer" role="status"><div className="copilot-response-label"><Sparkles size={16}/> Asking Relay AI…</div><p className="copilot-answer-text">Analyzing your inbox. No messages will be sent.</p></section>}
        {pending ? null : answer ? <section className="copilot-answer" aria-live="polite" aria-label="Inbox answer">
          <div className="copilot-question"><span>You asked</span><p>{question}</p></div>
          <div className="copilot-response-label"><Sparkles size={16}/> <b>{answer.title}</b></div>
          <p className="copilot-answer-text">{answer.answer}</p>
          {answer.results.length > 0 && <div className="copilot-match-list">
            <div className="copilot-match-title"><b>Related conversations</b><span>{answer.total} found{answer.total > answer.results.length ? ` · showing ${answer.results.length}` : ''}</span></div>
            {answer.results.map(email => <button className="copilot-match" key={email.id} onClick={()=>onOpenThread(email.id)} title={`Open ${email.subject}`}>
              <span className="copilot-match-avatar">{email.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span>
              <span className="copilot-match-text"><span className="copilot-match-top"><b>{email.name}</b><span>{responsibilityText[email.category] || 'Review'}</span></span><strong>{email.subject}</strong><small>{email.summary}</small>{email.timeHint && <span className="copilot-time-hint"><CalendarDays size={13}/> Mentioned: {email.timeHint}</span>}</span>
              <ArrowRight className="copilot-match-arrow" size={16}/>
            </button>)}
          </div>}
          <p className="copilot-grounding"><ShieldCheck size={13}/> {answer.source}. Open a thread to verify details.</p>
        </section> : <section className="copilot-welcome" aria-label="Suggested priorities">
          <div className="copilot-subtitle"><Check size={15}/> <b>Suggested priority threads</b></div>
          {signals.priority.length ? signals.priority.map(email=><button className="copilot-priority" key={email.id} onClick={()=>onOpenThread(email.id)}>
            <span><b>{email.subject}</b><small>{email.name} · {responsibilityText[email.group]}</small></span><ArrowRight size={16}/>
          </button>) : <p className="copilot-no-priority">No important or review-flagged threads at the moment.</p>}
        </section>}

        <section className="copilot-suggestions" aria-label="Suggested questions">
          <span className="copilot-subtitle"><Sparkles size={15}/><b>Try asking</b></span>
          <div className="copilot-chips">{SUGGESTIONS.map(s=><button key={s} onClick={()=>ask(s)}>{s}<ArrowRight size={13}/></button>)}</div>
        </section>
      </div>
      <form className="copilot-input-form" onSubmit={event=>{event.preventDefault();ask(input);}}>
        <Search size={19}/>
        <input ref={entryRef} value={input} maxLength={220} onChange={event=>setInput(event.target.value)} placeholder="Ask about a decision, sender, meeting or deadline…" aria-label="Ask your inbox" />
        <button type="submit" disabled={!input.trim() || pending} aria-label="Search your inbox"><CornerDownLeft size={18}/><span>Ask</span></button>
      </form>
      <div className="copilot-disclaimer">{answerMode === 'live' ? 'GROQCLOUD LIVE AI · Verify important details in source emails.' : 'RULE-BASED DEMO / FALLBACK · Answers use current inbox content.'} No emails are sent.</div>
    </section>
  </div>;
}
