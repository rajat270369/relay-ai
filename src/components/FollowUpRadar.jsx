import { ArrowRight, CalendarDays, Clock3, CircleAlert, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { getFollowUpSignals } from '../lib/followupRadar.js';
import '../followup.css';
const icons={deadline:Clock3,decision:CircleAlert,review:ShieldCheck,waiting:Clock3,meeting:CalendarDays};

export default function FollowUpRadar({emails,onOpen,expanded=false,onViewAll}){
  const {counts,items}=getFollowUpSignals(emails);
  const shown=expanded?items:items.slice(0,3);
  return <section className="followup-panel" aria-label="Follow-up radar">
    <div className="followup-head">
      <div><span className="section-overline">ACTION INTELLIGENCE · SAMPLE EMAILS</span>
        <h2><ClipboardCheck size={21}/> Follow-up Radar <span>{counts.total}</span></h2>
        <p>Decisions, response gaps, scheduling and deadline wording—linked to the source conversations.</p>
      </div>
      {!expanded && <button className="followup-more" type="button" onClick={onViewAll}>View all <ArrowRight size={16}/></button>}
    </div>
    <div className="followup-summary" aria-label="Signal counts">
      <span><strong>{counts.decisions}</strong> Client approvals</span>
      <span><strong>{counts.waiting}</strong> Waiting</span>
      <span><strong>{counts.meetings}</strong> Scheduling</span>
      <span><strong>{counts.deadlines}</strong> Deadline mentions</span>
    </div>
    {shown.length ? <div className="followup-items">
      {shown.map(item=>{
        const Icon=icons[item.kind];
        return <button key={item.id} className="followup-item" type="button" onClick={()=>onOpen(item.id)}>
          <span className={`followup-item-icon followup-${item.kind}`}><Icon size={17}/></span>
          <span className="followup-item-copy"><span className="followup-kind">{item.label}</span>
            <strong>{item.subject}</strong><small>{item.sender} · {item.detail}</small></span>
          <ArrowRight className="followup-item-arrow" size={17}/>
        </button>;
      })}
    </div> : <div className="followup-empty">No outstanding follow-up signals in the active inbox.</div>}
    <p className="followup-disclaimer">Signals are based on email wording and existing categories. Relative dates are not confirmed deadlines or calendar bookings.</p>
  </section>;
}
