import { ArrowLeft, Check, ChevronRight, CircleCheck, Clock3, Mail, RotateCcw, Sparkles, UserCheck } from 'lucide-react';
import EmailDetail from './EmailDetail.jsx';
import { fullDate, initials, latestTime } from '../lib/helpers.js';
import { handoffLabels } from '../lib/handoff.js';

export default function ClientWorkspace({session, emails, selected, setSelected, onUpdate, onHandoff, showToast, onBack, backLabel="Assistant workspace"}) {
  const requests = emails
    .filter(e => e.group === 'client' && !e.archived && !e.completed)
    .sort((a,b) => new Date(latestTime(b)) - new Date(latestTime(a)));
  const current = requests.find(e => e.id === selected);
  const recent = emails
    .filter(e => e.handoff?.status)
    .sort((a,b) => new Date(b.handoff.at) - new Date(a.handoff.at))
    .slice(0, 6);
  const displayName = session?.name?.trim() || 'Client';
  const givenName = displayName.split(/\s+/)[0];
  const dayName = new Date().toLocaleDateString('en-US', {weekday:'long'}).toUpperCase();

  async function takeAction(id, action, options) {
    const success = await onHandoff(id, action, options);
    if (success) setSelected(null);
  }

  return <div className="client-page">
    <header className="client-header">
      <div className="brand"><span className="brand-mark"><Mail size={19}/></span><span>relay<span className="brand-dot">.</span></span><span className="client-mode-tag">CLIENT PORTAL</span></div>
      <div className="client-top-right"><div className="client-profile">{displayName.charAt(0).toUpperCase()}</div><span className="client-name">{displayName}</span><button className="secondary-button back-workspace" onClick={onBack}><ArrowLeft size={16}/> {backLabel}</button></div>
    </header>
    <main className="client-content">
      <div className="client-welcome">
        <div className="client-greeting">{dayName} · YOUR PERSONAL INBOX</div>
        <h1>Good to see you, {givenName} <span>✳</span></h1>
        <p>Only conversations that need your personal attention. Maya handles the rest.</p>
      </div>
      <div className="client-banner"><span className="client-banner-icon"><Sparkles size={21}/></span><div><b>Stay focused on what matters</b><p>{requests.length} conversation{requests.length === 1 ? '' : 's'} need your input. Review, mark handled, or delegate the coordination to Maya.</p></div><span className="client-banner-count">{requests.length} for you</span></div>
      <div className="client-list-header"><h2>Needs your response <span>{requests.length}</span></h2><small>Sorted by most recent</small></div>
      {requests.length === 0 ? <div className="client-zero"><CircleCheck size={38}/><h3>You're all caught up</h3><p>No conversations currently need your personal attention.</p></div> :
        <div className="client-grid">{requests.map(e =>
          <article className="client-email-card" key={e.id}>
            <div className="client-email-top"><span className="client-sender-icon">{initials(e.name)}</span><div><b>{e.name}</b><small>{fullDate(latestTime(e))}</small></div><span className="client-personal-badge">Your input</span></div>
            <h3>{e.subject}</h3><p className="client-email-summary">{e.summary}</p>
            <div className="client-reason"><span className="client-reason-icon"><Sparkles size={14}/></span><span>{e.reason}</span></div>
            <div className="client-card-actions"><button className="primary-button" onClick={() => {setSelected(e.id);onUpdate(e.id,{unread:false});}}>Review conversation <ChevronRight size={16}/></button><button className="delegate-link" onClick={() => takeAction(e.id, 'delegate')} title="Ask Maya to coordinate and follow up"><UserCheck size={16}/> Delegate to Maya</button></div>
          </article>
        )}</div>}

      {recent.length > 0 && <section className="client-activity-panel" aria-label="Recent client actions">
        <div className="client-activity-heading"><div><span className="section-overline">ALREADY TRIAGED</span><h2>Recent decisions</h2></div><span className="client-activity-hint">Shared with Maya's workspace</span></div>
        {recent.map(e => <div className="client-activity-row" key={e.id}>
          <div className="client-activity-symbol"><Check size={18}/></div>
          <div className="client-activity-details"><b>{e.subject}</b><span>{handoffLabels[e.handoff.status] || 'Updated'} · {fullDate(e.handoff.at)}</span></div>
          {e.handoff.status === 'delegated' && e.group === 'assistant' && !e.completed && <button className="client-activity-action" onClick={() => takeAction(e.id, 'recall')}><RotateCcw size={15}/> Reclaim</button>}
          {e.handoff.status === 'handled' && e.completed && <button className="client-activity-action" onClick={() => takeAction(e.id, 'reopen')}><RotateCcw size={15}/> Reopen</button>}
        </div>)}
      </section>}
      <div className="client-footer"><CircleCheck size={17}/> Sample inbox shared across linked accounts and devices. No real email is sent.</div>
    </main>
    {current && <div className="client-modal-backdrop" onClick={() => setSelected(null)}>
      <div className="client-modal" role="dialog" aria-modal="true" aria-label={`Conversation with ${current.name}`} onClick={e => e.stopPropagation()}>
        <EmailDetail email={current} onClose={() => setSelected(null)} onUpdate={onUpdate} onHandoff={takeAction} showToast={showToast} clientMode/>
      </div>
    </div>}
  </div>;
}
