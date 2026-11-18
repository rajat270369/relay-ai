import { ArrowRight, ArrowUpRight, CheckCircle2, Mail, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';

export default function Welcome({ onConnect }) {
  return <main className="welcome-page">
    <div className="welcome-container">
      <div className="welcome-left">
        <div className="brand welcome-brand"><span className="brand-mark"><Mail size={19}/></span><span>relay<span className="brand-dot">.</span></span></div>
        <div className="welcome-pill"><Sparkles size={15}/> THE INTELLIGENT INBOX</div>
        <h1>More clarity.<br/><span>Less inbox.</span></h1>
        <p className="welcome-lead">A calmer way for assistants and clients to stay in sync. Let intelligent triage surface what matters and who should respond.</p>
        <div className="welcome-features"><span><CheckCircle2 size={16}/> Automatically triage conversations</span><span><CheckCircle2 size={16}/> Know who needs to reply</span><span><CheckCircle2 size={16}/> Keep client and assistant aligned</span></div>
        <div className="connect-card">
          <div className="connect-heading"><div><h2>Get started</h2><p>Connect an account to see your workspace.</p></div><ShieldCheck size={20}/></div>
          <button className="connect-button" onClick={() => onConnect('Gmail')}><span className="gmail-g">G</span><span>Continue with Gmail <small>Demo connection</small></span><ArrowRight size={18}/></button>
          <button className="connect-button" onClick={() => onConnect('Outlook')}><span className="outlook-g">O</span><span>Continue with Outlook <small>Demo connection</small></span><ArrowRight size={18}/></button>
          <button className="text-button demo-open" onClick={() => onConnect('Demo Workspace')}>Or explore the demo workspace <ArrowUpRight size={15}/></button>
          <div className="connect-disclaimer"><ShieldCheck size={13}/> No credentials needed. Connections and emails are simulated.</div>
        </div>
      </div>
      <div className="welcome-right" aria-hidden="true">
        <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
        <div className="preview-window">
          <div className="preview-top"><span className="mini-logo"><Mail size={13}/></span><b>Inbox intelligence</b><span className="preview-dots">•••</span></div>
          <div className="preview-score"><span>Needs your attention</span><strong>04 <small>conversations</small></strong></div>
          <div className="preview-line"><span className="preview-bubble purple"><WandSparkles size={18}/></span><div><b>Client decision required</b><small>Investment proposal · 4 min ago</small></div><span className="preview-tag">Client</span></div>
          <div className="preview-line"><span className="preview-bubble teal"><Mail size={18}/></span><div><b>Meeting coordination</b><small>Strategy call · 12 min ago</small></div><span className="preview-tag teal-tag">Assistant</span></div>
          <div className="preview-line"><span className="preview-bubble gray"><CheckCircle2 size={18}/></span><div><b>Weekly product digest</b><small>No response needed</small></div><span className="preview-tag gray-tag">No reply</span></div>
          <div className="preview-insight"><Sparkles size={17}/><div><b>Good news.</b><br/>Your inbox is already organized by responsibility.</div></div>
        </div>
        <div className="float-note"><span className="note-pulse"/> Automatically sorted by responsibility</div>
      </div>
    </div>
  </main>;
}
