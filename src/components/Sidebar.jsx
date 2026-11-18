import { isDelegatedToAssistant } from '../lib/handoff.js';
import { isFollowUpConversation } from '../lib/followupRadar.js';
import { Archive, CalendarDays, CheckCircle2, CircleHelp, Clock3, Inbox, LayoutDashboard, Mail, PanelLeftClose, Settings2, ShieldCheck, Sparkles, Star, UserCheck, UserRoundCheck, UsersRound, X } from 'lucide-react';

const items = [
  {id:'all', name:'All conversations', icon:Inbox},
  {id:'assistant', name:'Assistant to reply', icon:UserCheck},
  {id:'delegated', name:'Delegated by Alex', icon:UserRoundCheck},
  {id:'client', name:'Client to reply', icon:UsersRound},
  {id:'review', name:'Needs review', icon:CircleHelp},
  {id:'none', name:'No reply needed', icon:ShieldCheck},
  {id:'waiting', name:'Waiting for response', icon:Clock3},
  {id:'followups', name:'Follow-up Radar', icon:CalendarDays},
  {id:'meetings', name:'Meetings', icon:CalendarDays},
  {id:'important', name:'Important', icon:Star},
  {id:'archived', name:'Archived', icon:Archive},
  {id:'completed', name:'Completed', icon:CheckCircle2},
];

export default function Sidebar({filter, setFilter, emails, onSettings, connectedProvider, open, setOpen}) {
  const counts = {
    all: emails.filter(e => !e.archived && !e.completed).length,
    assistant: emails.filter(e => e.group==='assistant'&&!e.archived&&!e.completed).length,
    delegated: emails.filter(isDelegatedToAssistant).length,
    client: emails.filter(e => e.group==='client'&&!e.archived&&!e.completed).length,
    review: emails.filter(e => e.group==='review'&&!e.archived&&!e.completed).length,
    none: emails.filter(e => e.group==='none'&&!e.waiting&&!e.archived&&!e.completed).length,
    waiting: emails.filter(e => e.waiting&&!e.archived&&!e.completed).length,
    followups: emails.filter(isFollowUpConversation).length,
    meetings: emails.filter(e => e.tags.includes('Meetings')&&!e.archived&&!e.completed).length,
    important: emails.filter(e => e.importance&&!e.archived&&!e.completed).length,
    archived: emails.filter(e => e.archived).length,
    completed: emails.filter(e => e.completed && !e.archived).length
  };
  return <>
    {open && <button type="button" className="mobile-scrim" onClick={()=>setOpen(false)} aria-label="Close menu"/>}
    <aside className={`sidebar ${open ? 'sidebar-open':''}`}>
      <div className="sidebar-top">
        <div className="brand"><span className="brand-mark"><Mail size={19}/></span><span>relay<span className="brand-dot">.</span></span></div>
        <button className="icon-button sidebar-close" aria-label="Close menu" onClick={()=>setOpen(false)}><X size={19}/></button>
      </div>
      <div className="workspace-switch"><span className="workspace-logo">N</span><span><b>Northstar Studio</b><small>Executive workspace</small></span><span className="workspace-chevron">⌄</span></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <button className={`sidebar-link ${filter==='overview'?'active':''}`} onClick={()=>{setFilter('overview');setOpen(false);}}><LayoutDashboard size={18}/><span>Overview</span></button>
      <div className="sidebar-section-label sidebar-inbox-label">MAILBOX <span className="mini-oval">LIVE DEMO</span></div>
      <nav className="sidebar-nav" aria-label="Email categories">
        {items.map(({id,name,icon:Icon})=><button key={id} className={`sidebar-link ${filter===id?'active':''}`} onClick={()=>{setFilter(id);setOpen(false);}}><Icon size={18}/><span>{name}</span><span className="sidebar-count">{counts[id]}</span></button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={17}/></div><b>Smarter every day</b><p>Review and correct assignments to keep your workflow organized.</p><span>DEMO INTELLIGENCE</span></div>
        <button className="settings-nav" onClick={()=>{onSettings();setOpen(false);}}><Settings2 size={18}/><span>Connected accounts</span></button>
        <div className="connected-card"><span className="connected-indicator"/><span><b>{connectedProvider}</b><small>Sample data connected</small></span><span className="connected-status">Connected</span></div>
      </div>
    </aside>
  </>;
}
