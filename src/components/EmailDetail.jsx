import { useEffect, useRef, useState } from 'react';
import {
  Archive, ArrowLeft, Check, CheckCheck, ChevronDown, ChevronUp,
  Clipboard, Clock3, MailOpen, MoreHorizontal, RefreshCw,
  RotateCcw, Send, Sparkles, Star, UserCheck, WandSparkles, X,
} from 'lucide-react';
import { responsibilities } from '../lib/demoAI.js';
import { colorClass, fullDate, initials } from '../lib/helpers.js';
import { handoffLabels, isDelegatedToAssistant } from '../lib/handoff.js';

function ownership(email) {
  if (email.waiting) return {
    title: 'Waiting for a response',
    help: 'Maya has replied. No further reply is needed until the sender responds.',
    tone: 'waiting',
  };
  if (email.group === 'client') return {
    title: 'Alex needs to decide',
    help: 'Maya can coordinate, but Alex must make personal approvals and decisions.',
    tone: 'client',
  };
  if (email.group === 'assistant') return {
    title: isDelegatedToAssistant(email) ? 'Maya owns the follow-up' : 'Maya needs to reply',
    help: isDelegatedToAssistant(email)
      ? 'Alex delegated coordination. Decisions requiring his approval remain with Alex.'
      : 'This is an assistant-owned request. Prepare a reply or complete the task.',
    tone: 'assistant',
  };
  if (email.group === 'review') return {
    title: 'Needs human review',
    help: 'Responsibility is uncertain. Review the conversation and choose an owner.',
    tone: 'review',
  };
  return {title: 'No reply needed',help:'This is informational or already resolved.',tone:'none'};
}

export default function EmailDetail({
  email, draftMode='demo', onClose, onUpdate, onAnalyze, onFollowUp,
  onDraft, onSendDraft, onResetThread, onHandoff, showToast,
  clientMode=false, busy=false,
}) {
  const replySectionRef=useRef(null);
  const latestReplyRef=useRef(null);
  const [handoffNote,setHandoffNote]=useState('');
  const [showAllMessages,setShowAllMessages]=useState(false);
  useEffect(()=>{setHandoffNote('');setShowAllMessages(false);},[email?.id]);
  const latestMessage=email?.messages?.at(-1);
  useEffect(()=>{
    if(String(latestMessage?.id||'').startsWith('demo-reply-')){
      latestReplyRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
  },[email?.id,latestMessage?.id]);

  if(!email)return <div className="detail-empty"><div className="detail-empty-icon"><MailOpen size={28}/></div><h3>No conversation selected</h3><p>Choose a conversation from the list to review it.</p></div>;

  const owner=ownership(email);
  const visibleMessages=showAllMessages?email.messages:email.messages.slice(-3);
  const hiddenCount=email.messages.length-visibleMessages.length;
  const aiLabel=email.aiSource==='live'?'GroqCloud AI':'Rules-based demo';
  const copyDraft=async()=>{
    try {await navigator.clipboard.writeText(email.draft);showToast('Draft copied to clipboard');}
    catch {showToast('Clipboard unavailable. Select and copy the draft manually.');}
  };
  const scrollToDraft=()=>replySectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
  const changeOwner=value=>{
    onUpdate(email.id,{group:value,override:true,waiting:false,reason:'Manually assigned by the assistant.',confidence:100});
    showToast('Reply owner updated');
  };
  const takeAction=(action,options)=>onHandoff?.(email.id,action,options);

  return <section className="detail-wrap clarity-reader">
    <div className="detail-toolbar clarity-reader-toolbar">
      <button className="icon-button detail-back" onClick={onClose} title="Back" aria-label="Back to conversations"><ArrowLeft size={19}/></button>
      <span className="detail-caption">MESSAGE DETAILS</span>
      <div className="detail-actions">
        {!clientMode&&<>
          {!clientMode&&<button className={`icon-button ${email.importance?'selected-star':''}`} title={email.importance?'Remove important':'Mark important'} aria-label="Toggle important" onClick={()=>onUpdate(email.id,{importance:!email.importance})}><Star size={18} fill={email.importance?'currentColor':'none'}/></button>}
          <button className="icon-button" title={email.unread?'Mark as read':'Mark as unread'} aria-label="Toggle read status" onClick={()=>onUpdate(email.id,{unread:!email.unread})}><MailOpen size={18}/></button>
          {!clientMode&&<button className="icon-button" title={email.archived?'Unarchive':'Archive'} aria-label="Toggle archive" onClick={()=>{onUpdate(email.id,{archived:!email.archived});onClose();showToast(email.archived?'Conversation restored':'Conversation archived');}}><Archive size={18}/></button>}
        </>}
        <button className="icon-button clarity-close-reader" title="Close" aria-label="Close conversation" onClick={onClose}><X size={18}/></button>
      </div>
    </div>

    <div className="detail-scroll clarity-reader-scroll">
      <div className="clarity-reader-heading">
        <div className="detail-subject-kicker">{email.tags?.[0]||'Conversation'} <span className="kicker-separator">·</span> {email.messages.length} message{email.messages.length===1?'':'s'}</div>
        <h2>{email.subject}</h2>
        <p>From <strong>{email.name}</strong> · {email.email}</p>
      </div>

      <div className={`clarity-owner clarity-owner-${owner.tone}`} role="status">
        <div><span className="clarity-field-label">CURRENT STATUS</span><strong>{owner.title}</strong><p>{owner.help}</p></div>
        {!clientMode&&<label className="clarity-owner-select">Change owner
          <select value={email.group} onChange={e=>changeOwner(e.target.value)} aria-label="Change reply owner">
            <option value="assistant">Maya · Assistant</option>
            <option value="client">Alex · Client</option>
            <option value="review">Needs review</option>
            <option value="none">No reply needed</option>
          </select>
        </label>}
      </div>

      {email.handoff?.status&&<div className="clarity-handoff" role="status">
        <UserCheck size={18}/><div><strong>{handoffLabels[email.handoff.status]||'Handoff updated'}</strong>
          <p>{email.handoff.status==='delegated'?'Alex delegated coordination to Maya; approval authority remains with Alex.'
            :email.handoff.status==='handled'?'Alex marked this conversation handled.'
            :email.handoff.status==='return'?'Maya returned the decision to Alex.'
            :email.handoff.status==='replied'?'Maya sent an approved demo reply.':'Assignment updated.'}</p>
          {email.handoff.note&&<p><b>Alex's note:</b> {email.handoff.note}</p>}
        </div>
        {!clientMode&&isDelegatedToAssistant(email)&&<button className="secondary-button" onClick={()=>takeAction('return')}><UserCheck size={16}/> Return to Alex</button>}
      </div>}

      <section className="clarity-briefing" aria-label="AI email briefing">
        <div className="clarity-section-heading">
          <span><Sparkles size={19}/> AI briefing</span>
          <span className="clarity-ai-source">{aiLabel}{email.override?' · Owner set manually':''}</span>
        </div>
        <p className="clarity-summary">{email.summary||'No summary available yet. Refresh AI to analyze this email.'}</p>
        {email.waiting ? <div className="clarity-next"><strong>Next step</strong><p>Wait for the sender's response. This conversation is in your Waiting queue.</p></div>
          :Array.isArray(email.actionItems)&&email.actionItems.length>0&&<div className="clarity-next"><strong>Suggested next steps</strong><ul>{email.actionItems.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
        <details className="clarity-reason">
          <summary>Why was this assigned here? <ChevronDown size={16}/></summary>
          <p>{email.reason}</p>
          <small>{email.override?'Responsibility manually set':email.confidence===0?'Analyzing…':`${email.confidence}% ${email.aiSource==='live'?'AI':'demo'} estimate`}</small>
        </details>
      </section>

      {!clientMode&&<div className="clarity-actions-bar">
        <button className="primary-button" onClick={()=>{if(!email.draft)onDraft(email.id);scrollToDraft();}} disabled={busy}>
          <WandSparkles size={18}/>{busy?'Working…':email.draft?'Review suggested reply':'Create a reply'}
        </button>
        <button className="secondary-button" onClick={()=>onAnalyze(email.id)} disabled={busy}><RefreshCw size={17}/> {busy?'Analyzing…':'Refresh AI'}</button>
        <details className="clarity-advanced">
          <summary><MoreHorizontal size={19}/> More</summary>
          <div className="clarity-advanced-panel">
            <button onClick={()=>onFollowUp(email.id)} disabled={busy}><MailOpen size={16}/> Simulate follow-up</button>
            <button onClick={()=>onResetThread(email.id)} disabled={busy}><RotateCcw size={16}/> Reset demo conversation</button>
          </div>
        </details>
      </div>}

      {clientMode&&<section className="clarity-client-actions" aria-label="Client decision actions">
        <h3>What would you like to do?</h3>
        <label htmlFor="client-handoff-note">Instructions for Maya (optional)</label>
        <textarea id="client-handoff-note" rows={2} maxLength={400} value={handoffNote} onChange={e=>setHandoffNote(e.target.value)} placeholder="e.g. Coordinate the meeting, but let me approve the terms."/>
        <p>Delegation does not authorize Maya to make personal decisions.</p>
        <div className="client-detail-actions">
          <button className="primary-button" onClick={()=>takeAction('handled')}><CheckCheck size={17}/> Mark handled</button>
          <button className="secondary-button" onClick={()=>takeAction('delegate',{note:handoffNote})}><UserCheck size={17}/> Delegate to Maya</button>
        </div>
      </section>}

      {!clientMode&&<section className="draft-section clarity-draft" ref={replySectionRef}>
        <div className="draft-head"><div><span className="clarity-field-label">REVIEW BEFORE SENDING</span><h3>{email.draft?'Suggested reply':'Reply assistance'}</h3></div>
          <button className="secondary-button" onClick={()=>onDraft(email.id)} disabled={busy}><WandSparkles size={16}/>{busy?'Generating…':email.draft?'Regenerate draft':draftMode==='live'?'Draft with GroqCloud':'Generate demo draft'}</button>
        </div>
        {email.group==='client'&&<p className="clarity-approval-note">Alex must make the decision. Maya's draft should only acknowledge or coordinate the request.</p>}
        {email.draft?<div className="draft-editor">
          <textarea aria-label="Review reply draft" value={email.draft} onChange={event=>onUpdate(email.id,{draft:event.target.value})} rows={5}/>
          <div className="draft-footer"><span>Editable draft · Not sent automatically</span>
            <div className="clarity-draft-actions"><button className="secondary-button" onClick={copyDraft}><Clipboard size={16}/> Copy</button>
              <button className="primary-button" onClick={()=>onSendDraft(email.id)} disabled={busy||!email.draft.trim()}><Send size={16}/> Approve &amp; send demo</button></div>
          </div>
        </div>:<div className="clarity-no-draft">No reply has been drafted yet. Use <strong>Draft with AI</strong> above to prepare one.</div>}
      </section>}

      <section className="conversation-section clarity-messages">
        <div className="clarity-messages-head"><h3>Conversation history <span>{email.messages.length}</span></h3>
          {email.messages.length>3&&<button className="secondary-button" onClick={()=>setShowAllMessages(v=>!v)} aria-expanded={showAllMessages}>
            {showAllMessages?<><ChevronUp size={16}/> Show latest only</>:<><ChevronDown size={16}/> Show all {email.messages.length}</>}
          </button>}
        </div>
        {hiddenCount>0&&<p className="clarity-hidden-messages">Showing the latest 3 of {email.messages.length} messages · Expand to read the full history</p>}
        {visibleMessages.map((message,index)=><article ref={index===visibleMessages.length-1?latestReplyRef:null} className="message-card" key={message.id||index}>
          <div className="message-top"><span className={`sender-avatar ${message.role==='external'?colorClass(email.id):'avatar-assistant'}`}>{message.role==='external'?initials(email.name):'M'}</span>
            <div className="message-sender"><b>{message.author}</b><small>{message.role==='external'?email.email:'maya@northstar.demo'}</small></div><time>{fullDate(message.time)}</time></div>
          <div className="message-body">{message.body}</div>
        </article>)}
      </section>

      {Array.isArray(email.handoffHistory)&&email.handoffHistory.length>0&&<details className="clarity-activity">
        <summary>Assignment history ({email.handoffHistory.length}) <ChevronDown size={16}/></summary>
        <div className="handoff-history">{email.handoffHistory.slice(-6).reverse().map(event=><div className="handoff-history-item" key={event.id}>
          <span className="handoff-history-dot"/><div><b>{handoffLabels[event.action]||event.action}</b><span>{event.actor} · {fullDate(event.at)}</span>{event.note&&<p>{event.note}</p>}</div>
        </div>)}</div>
      </details>}

      {!clientMode&&<button className="complete-link" onClick={()=>{onUpdate(email.id,{completed:!email.completed});onClose();showToast(email.completed?'Reopened conversation':'Conversation marked complete');}}><Check size={17}/>{email.completed?'Reopen conversation':'Mark conversation complete'}</button>}
    </div>
  </section>;
}
