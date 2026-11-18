import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowDownRight, ArrowRight, Bell, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Clock3, Filter, Inbox, Mail, Menu, Plus, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Star, UserRoundCheck, WandSparkles, X } from 'lucide-react';
import AuthFlow from './components/AuthFlow.jsx';
import WorkspaceJoin from './components/WorkspaceJoin.jsx';
import Sidebar from './components/Sidebar.jsx';
import EmailDetail from './components/EmailDetail.jsx';
import ClientWorkspace from './components/ClientWorkspace.jsx';
import InboxCopilot from './components/InboxCopilot.jsx';
import FollowUpRadar from './components/FollowUpRadar.jsx';
import { createIncomingEmail, sampleEmails } from './data/sampleEmails.js';
import { analyzeEmail, draftReply, responsibilities } from './lib/demoAI.js';
import { colorClass, initials, lastPreview, latestTime, timeLabel } from './lib/helpers.js';
import { isDelegatedToAssistant } from './lib/handoff.js';
import { isFollowUpConversation } from './lib/followupRadar.js';
import { readAccount, registerAccount, signInAccount, signOutAccount, connectAccount, disconnectAccount, ensureAssistantWorkspaceAccount } from './lib/authClient.js';
import { useSharedInbox } from './lib/useSharedInbox.js';
import { workspaceRequest, createWorkspaceInvite } from './lib/workspaceClient.js';
import './handoff.css';
import './copilot.css';
import './auth.css';
import './clarity.css';
import './workspace.css';

// Inbox records now belong to the authenticated, server-owned workspace.

// Prepare a local, editable suggestion for messages that need a human reply.
// A suggestion is never sent automatically. No draft is created for newsletters,
// resolved threads, or messages where the assistant is awaiting a response.
function canSuggestReply(email) {
  return ['assistant', 'client'].includes(email?.group)
    && !email.waiting && !email.completed && !email.archived
    && email.messages?.at(-1)?.role === 'external';
}
function withSuggestedReply(email) {
  return canSuggestReply(email) && !email.draft
    ? {...email, draft:draftReply(email), draftSource:'demo'} : email;
}



const filterNames = {overview:'Today',all:'All conversations',assistant:'My queue',client:'Needs Alex',review:'Needs review',none:'No reply needed',waiting:'Waiting for reply',meetings:'Meetings',important:'Important',archived:'Archived',completed:'Completed',delegated:'Delegated to me',followups:'Follow-up Radar'};

function MetricCard({icon:Icon,label,value,tone,detail,active,onClick}) {
  return <button className={`metric-card metric-${tone} ${active?'metric-active':''}`} onClick={onClick}>
    <div className="metric-top"><span className="metric-icon"><Icon size={19}/></span><ArrowRight size={16} className="metric-arrow"/></div>
    <div className="metric-number">{value.toString().padStart(2,'0')}</div><div className="metric-label">{label}</div><div className="metric-detail">{detail}</div>
  </button>;
}

function MailRow({email,active,onClick}) {
  const cat=email.waiting ? {tone:'amber',small:'Waiting',label:'Waiting for response'}
    : email.group==='assistant' ? {tone:'teal',small:'Maya to reply'}
    : email.group==='client' ? {tone:'purple',small:'Alex to reply'}
    : email.group==='review' ? {tone:'amber',small:'Needs review'}
    : {tone:'slate',small:'No reply needed'};
  return <button className={`mail-row ${active?'mail-row-active':''}`} onClick={onClick}>
    <span className={`mail-avatar ${colorClass(email.id)}`}>{initials(email.name)}</span>
    <span className="mail-row-main"><span className="mail-sender-line"><span className={`mail-name ${email.unread?'mail-unread':''}`}>{email.name}</span><span className="mail-time">{timeLabel(latestTime(email))}</span></span>
      <span className={`mail-subject ${email.unread?'mail-unread':''}`}>{email.subject}</span>
      <span className="mail-preview">{lastPreview(email)}</span>
      <span className="mail-row-bottom"><span className={`responsibility-pill ${cat.tone}`}><span className="tiny-circle"/>{cat.small}</span>{email.tags[0]&&<span className="tag-muted">{email.tags[0]}</span>}{isDelegatedToAssistant(email)&&<span className="handoff-mini-badge">From Alex</span>}{email.completed&&<span className="handoff-mini-badge">{email.handoff?.status==='handled'?'Handled by Alex':'Completed'}</span>}<span className="mail-row-bottom-right">{email.importance&&<Star size={13} fill="currentColor"/>}{email.unread&&<i className="unread-circle"/>}</span></span>
    </span>
  </button>;
}

function SettingsDialog({session,onReconnect,onSignOut,onReset,onClose,syncStatus}) {
  const [invite,setInvite]=useState(null);
  const [inviteError,setInviteError]=useState('');
  const [inviteBusy,setInviteBusy]=useState(false);
  async function generateInvite(){
    setInviteBusy(true);setInviteError('');
    try{setInvite(await createWorkspaceInvite());}catch(error){setInviteError(error.message);}
    finally{setInviteBusy(false);}
  }
  const connection=session?.connection;
  const synced=connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Not synchronized';
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="settings-dialog" onClick={event=>event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Workspace account settings">
      <div className="settings-header"><div><span className="section-overline">WORKSPACE SETTINGS</span><h2>Account &amp; connection</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={19}/></button></div>
      <div className="auth-settings-profile"><span className="auth-settings-avatar">{session?.name?.charAt(0) || 'M'}</span><span><b>{session?.name || 'Relay user'}</b><small>{session?.email} · Authenticated assistant account</small></span></div>
      <div className="auth-settings-status"><CheckCircle2 size={19}/><div><b>{connection?.provider || 'No provider'} · Sample mailbox</b><small>Sample mailbox: {connection?.address || 'maya@northstar.demo'}</small><small>Simulated synchronization: {synced}</small></div></div>
      <p className="settings-description">Your account is authenticated with a server session. Gmail/Outlook connections and email sending remain simulated; no third-party mailbox is connected.</p>
      <div className="workspace-share">
        <h3>Invite Alex to this shared workspace</h3>
        <p>Use a second browser or device to sign up as a Client, then enter this one-time invitation. All sample inbox changes will be shared.</p>
        <button type="button" onClick={generateInvite} disabled={inviteBusy}>{inviteBusy?'Generating…':'Create client invitation'}</button>
        {invite&&<><div className="workspace-invite-code" aria-label="Invitation code">{invite.code}</div><button type="button" onClick={()=>navigator.clipboard?.writeText(invite.code)}>Copy invitation</button><small>Expires {new Date(invite.expiresAt).toLocaleString()} · Single use</small></>}
        {inviteError&&<p role="alert">{inviteError}</p>}
      </div>
      <div className="workspace-sync">Shared inbox: {syncStatus==='synced'?'Up to date':syncStatus==='saving'?'Saving changes…':syncStatus==='connecting'?'Connecting…':syncStatus==='error'?'Check connection':'Reconnecting…'}</div>
      <div className="auth-settings-actions"><button onClick={onReconnect}><RefreshCw size={16}/> Switch demo provider</button><button onClick={onSignOut}><X size={16}/> Sign out</button></div>
      <button className="reset-button" onClick={onReset}><RefreshCw size={16}/> Reset all demo conversations</button>
      <div className="settings-foot"><ShieldCheck size={14}/> Email drafts and sending are simulated. Conversations are stored in your shared workspace, not this browser.</div>
    </div>
  </div>;
}

// Recover legacy assistant accounts without requiring users to sign out, recreate
// accounts, or manually change anything in their MongoDB database.
function WorkspaceRecovery({session,onRecovered,onSignOut}) {
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  const recover = async (active=()=>true) => {
    setBusy(true);setError('');
    try {
      const {user}=await ensureAssistantWorkspaceAccount();
      if (!user || user.role !== 'assistant' || !user.workspaceId)
        throw new Error('The server did not return a valid assistant workspace.');
      if (active()) onRecovered(user);
    } catch (cause) {
      if (active()) setError(cause?.message || 'Workspace recovery failed.');
    } finally {
      if (active()) setBusy(false);
    }
  };
  useEffect(() => {
    let active=true;
    if (session?.role === 'assistant') void recover(()=>active);
    else {setBusy(false);setError('This account has an unknown role. Please sign out and sign in again.');}
    return () => {active=false;};
  },[session?.id,session?.role]);
  return <main className="auth-page" style={{display:'grid',placeItems:'center',minHeight:'100vh',padding:'24px'}}>
    <div className="auth-card" style={{maxWidth:460,padding:28}} role="status">
      <h2 style={{marginTop:0}}>Setting up your assistant workspace</h2>
      <p>{busy ? 'Checking your existing account and recovering its workspace…' : error || 'Workspace recovered.'}</p>
      {!busy && <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <button className="auth-submit" type="button" onClick={()=>void recover()} disabled={busy}>Retry workspace setup</button>
        <button type="button" onClick={onSignOut}>Sign out</button>
      </div>}
    </div>
  </main>;
}

export default function App() {
  const [session,setSession] = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const provider=session?.connection?.provider || null;
  const [filter,setFilter] = useState('overview');
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState(null);
  const [clientMode,setClientMode] = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [copilotOpen,setCopilotOpen] = useState(false);
  const [mobileMenu,setMobileMenu] = useState(false);
  const [demoToolsOpen,setDemoToolsOpen] = useState(false);
  const [toast,setToast] = useState('');
  const [busyId,setBusyId] = useState(null);
  const [aiMode,setAiMode] = useState('demo');
  const {emails,setEmails,loaded:inboxLoaded,syncStatus,applyRemoteThread,applyList,refresh}=useSharedInbox(session,withSuggestedReply,setToast);

  useEffect(()=>{
    let active=true;
    fetch('/api/health').then(r=>r.ok?r.json():Promise.reject()).then(data=>{
      if(active)setAiMode(data.aiMode==='live'?'live':'demo');
    }).catch(()=>{if(active)setAiMode('demo');});
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    let active=true;
    readAccount().then(({user})=>{if(active)setSession(user);})
      .catch(()=>{if(active)setSession(null);})
      .finally(()=>{if(active)setAuthLoading(false);});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3300);return()=>clearTimeout(t);},[toast]);
  const showToast = (message) => setToast(message);
  const onUpdate = (id,patch) => setEmails(current=>current.map(e=>{
    if (e.id !== id) return e;
    const updated = {...e,...patch};
    // Changing responsibility can change the type of response suggested.
    if (Object.hasOwn(patch,'group')) {
      // A manual reassignment supersedes any previous active handoff label.
      updated.handoff = null;
      if (!Object.hasOwn(patch,'waiting')) updated.waiting = false;
      if (!Object.hasOwn(patch,'draft')) {
        updated.draft = '';
        return withSuggestedReply(updated);
      }
    }
    return updated;
  }));

  // All handoff transitions are validated and saved by the authenticated server.
  const onHandoff = async (id, action, options = {}) => {
    const email = emails.find(e=>e.id===id);
    if(!email||busyId===id)return false;
    const allowed=session?.role==='client'?['delegate','handled','recall','reopen']:['return'];
    if(!allowed.includes(action)){showToast('This action is not available to your account.');return false;}
    setBusyId(id);
    try {
      const {email:updated}=await workspaceRequest('/handoff',{
        method:'POST',body:{id,action,note:options.note||'',revision:email._rev},
      });
      applyRemoteThread(updated);
      if(action==='return')setFilter('all');
      showToast(action==='delegate'?'Delegated to Maya. Her queue will update automatically.':
        action==='handled'?'Marked handled in the shared workspace.':
        action==='return'?'Returned to Alex. His portal will update automatically.':'Shared workspace updated.');
      return true;
    } catch(error){showToast(error.message);await refresh(true).catch(()=>{});return false;}
    finally{setBusyId(null);}
  };

  // API is optional. If it is unavailable, use the openly labeled demo classifier.
  const classify = async (email) => {
    try {
      const response=await fetch('/api/analyze',{
        method:'POST',headers:{'Content-Type':'application/json','X-Relay-Request':'1'},
        body:JSON.stringify({email}),
      });
      if(!response.ok)throw new Error('AI API offline');
      const data=await response.json();
      if(!data.analysis || !responsibilities[data.analysis.group])throw new Error('Invalid classifier result');
      return data.analysis;
    } catch {
      return analyzeEmail(email);
    }
  };

  const saveAnalysis = (id,result) => setEmails(current=>current.map(e=>{
    if(e.id!==id)return e;
    // A manual change made while analysis was running must still win.
    if(e.override)return {...e,summary:result.summary,...(!e.handoff?.status ? {actionItems:result.actionItems} : {}),lastAnalyzedAt:result.lastAnalyzedAt};
    // The latest result supersedes any stale unsent draft. For a Client to Reply
    // email, Maya can prepare an acknowledgement, not a decision on Alex's behalf.
    return withSuggestedReply({...e,...result,handoff:null,draft:''});
  }));

  const onAnalyze = async id => {
    if(busyId)return;
    const email=emails.find(e=>e.id===id);
    if(!email)return;
    setBusyId(id);
    // Respect manual ownership (including Alex's delegation). Incoming
    // follow-ups, not an optional summary refresh, can reassign a thread.
    try {
      const result=await classify(email);
      saveAnalysis(id,result);
      showToast(`${result.aiSource==='live'?'Live AI':'Demo'} classification refreshed`);
    } finally {setBusyId(null);}
  };

  const onFollowUp = async id => {
    if(busyId)return;
    const email=emails.find(e=>e.id===id);
    if(!email)return;
    const sample=email.group==='assistant'
      ? 'Hi Alex, a new development: I now need your personal approval on the final terms before we proceed. Please confirm your decision.'
      :email.group==='client'
        ? 'Hi Maya, thanks for reviewing. Could you schedule a short meeting next week to discuss the next steps? Please coordinate available times.'
        : 'Hi Maya, could you schedule a quick appointment next Tuesday morning and confirm calendar availability?';
    const updated={...email,messages:[...email.messages,{id:`follow-up-${Date.now()}`,role:'external',author:email.name,body:sample,time:new Date().toISOString()}],unread:true,completed:false,waiting:false,override:false,handoff:null,group:'review',summary:'Analyzing the latest message…',reason:'New follow-up received; reassessing responsibility.',confidence:0,actionItems:[]};
    setBusyId(id);
    setEmails(current=>current.map(e=>e.id===id?updated:e));
    try {
      const result=await classify(updated);
      saveAnalysis(id,result);
      showToast(`New follow-up → ${responsibilities[result.group].label} (${result.aiSource==='live'?'live AI':'demo'})`);
    } finally {setBusyId(null);}
  };

  // Real AI drafts are requested explicitly. The server holds the API key;
  // the user must still review and approve before a demo message is appended.
  const onDraft = async id => {
    if (busyId) return;
    const email = emails.find(e=>e.id===id);
    if (!email) return;
    setBusyId(id);
    const previousDraft = email.draft;
    try {
      const response = await fetch('/api/draft', {
        method:'POST',headers:{'Content-Type':'application/json','X-Relay-Request':'1'},
        body:JSON.stringify({email}),
      });
      if (!response.ok) throw new Error('Draft API unavailable');
      const data=await response.json();
      if (!data.result || typeof data.result.draft !== 'string' || !data.result.draft.trim()) throw new Error('Invalid draft');
      setEmails(current=>current.map(e=>e.id===id && e.draft===previousDraft
        ? {...e,...data.result} : e));
      showToast(data.mode==='live' ? 'GroqCloud generated a draft. Review it before sending.' : 'Rule-based draft prepared for review.');
    } catch {
      setEmails(current=>current.map(e=>e.id===id && e.draft===previousDraft
        ? {...e,draft:draftReply(e),draftSource:'demo'} : e));
      showToast('AI service unavailable; using a rule-based draft.');
    } finally {setBusyId(null);}
  };

  // This is a demo-only send, requiring an editable draft and an explicit click.
  // It never contacts a real email provider.
  const onSendDraft = id => {
    const original = emails.find(e => e.id === id);
    if (!String(original?.draft || '').trim()) {
      showToast('Write or generate a reply before sending.');
      return;
    }
    setEmails(current => current.map(e => {
      if (e.id !== id || !String(e.draft || '').trim()) return e;
      const requiresClientDecision = e.group === 'client';
      return {
        ...e,
        messages: [...e.messages, {
          id: `demo-reply-${Date.now()}`,
          role: 'assistant',
          author: 'Maya (Assistant)',
          body: e.draft.trim(),
          time: new Date().toISOString(),
        }],
        draft: '',
        unread: false,
        completed: false,
        waiting: !requiresClientDecision,
        // Sending an acknowledgment does not replace the client's own approval.
        group: requiresClientDecision ? 'client' : 'none',
        reason: requiresClientDecision
          ? 'Maya sent a demo acknowledgment, but Alex still needs to make the personal decision.'
          : 'Maya sent an approved demo reply; this conversation is waiting for a response.',
        actionItems: requiresClientDecision
          ? ['Ask Alex to review the request and reply personally.']
          : ['Wait for the sender to respond.'],
        confidence: 100,
        override: true,
        ...(e.handoff?.status === 'delegated' ? {
          handoff: {status:'replied',actor:'Maya (Assistant)',at:new Date().toISOString(),note:'Sent a reviewed demo reply.'},
          handoffHistory:[...(e.handoffHistory || []),{id:`${e.id}-replied-${Date.now()}`,action:'replied',actor:'Maya (Assistant)',at:new Date().toISOString(),note:'Approved demo reply sent.'}],
        } : {}),
      };
    }));
    // Keep the thread visible even for Client to Reply acknowledgements, which
    // remain client-owned and must not incorrectly switch to Waiting.
    setFilter(current => ['assistant','client','review'].includes(current) ? 'all' : current);
    showToast('Maya’s approved reply was added to this thread (demo only; no real email sent).');
  };
  const signIn = async details => {
    const result=details.mode==='signup' ? await registerAccount(details) : await signInAccount(details);
    setSession(result.user);
    setClientMode(false);
    showToast(`Signed in as ${result.user.name}`);
  };
  const connect = async providerName => {
    const {user}=await connectAccount(providerName);
    setSession(user);
    showToast(`${providerName} sample inbox ready — no real mailbox accessed`);
  };
  const reconnect = async () => {
    try {
      const {user}=await disconnectAccount();
      setSession(user);setShowSettings(false);
    } catch(error) {showToast(error.message);}
  };
  const signOut = async () => {
    try {await signOutAccount();} catch {showToast('Could not sign out; check your API server.');return;}
    setShowSettings(false);setClientMode(false);setCopilotOpen(false);setSelected(null);
    setSession(null);
  };
  const reset = async () => {
    if (!window.confirm('Reset every demo conversation for both accounts, including follow-ups and drafts?')) return;
    try {const result=await workspaceRequest('/reset',{method:'POST',body:{confirm:'RESET SAMPLE INBOX'}});applyList(result.emails);}
    catch(error){showToast(error.message);return;}
    setFilter('overview');setSearch('');setSelected('m1');
    showToast('Demo inbox restored to original conversations');
  };
  const onResetThread = id => {
    if (busyId) return;
    const original = sampleEmails.find(e=>e.id===id);
    if (!window.confirm(original
      ? 'Reset this conversation? Simulated follow-ups and sent demo replies will be removed.'
      : 'Remove this simulated email from the demo inbox?')) return;
    if (original) {
      setEmails(current => current.map(e=>e.id===id
        ? withSuggestedReply({...original, messages:original.messages.map(m=>({...m}))}) : e));
      setFilter('all'); setSearch(''); setSelected(id);
      showToast('Conversation restored to its original example');
    } else {
      setEmails(current=>current.filter(e=>e.id!==id));
      setSelected(null);setFilter('all');setSearch('');
      showToast('Simulated email removed');
    }
  };

  const simulateIncoming = async () => {
    if(busyId)return;
    const newCount=emails.filter(e=>e.id.startsWith('new-')).length;
    const incoming=createIncomingEmail(newCount);
    setBusyId(incoming.id);
    setEmails(current=>[incoming,...current]);
    setFilter('all');setSearch('');setSelected(incoming.id);
    try {
      const result=await classify(incoming);
      saveAnalysis(incoming.id,result);
      showToast(`Incoming email → ${responsibilities[result.group].label} (${result.aiSource==='live'?'live AI':'demo'})`);
    } finally {setBusyId(null);}
  };

  const active = emails.filter(e=>!e.archived&&!e.completed);
  const stats = {
    total:active.length,
    unread:active.filter(e=>e.unread).length,
    assistant:active.filter(e=>e.group==='assistant'&&!e.waiting).length,
    client:active.filter(e=>e.group==='client'&&!e.waiting).length,
    review:active.filter(e=>e.group==='review'&&!e.waiting).length,
    waiting:active.filter(e=>e.waiting).length,
    delegated:active.filter(isDelegatedToAssistant).length,
  };
  const filtered = useMemo(() => emails.filter(e=>{
    if(filter==='archived'){if(!e.archived)return false;}
    else if(filter==='completed'){if(!e.completed||e.archived)return false;}
    else {if(e.archived||e.completed)return false;}
    // Today intentionally contains actionable conversations only. Use All conversations
    // for newsletters and threads already awaiting a response.
    if(filter==='overview'&&(e.waiting || !['assistant','client','review'].includes(e.group)))return false;
    if(filter==='assistant'&&(e.group!=='assistant'||e.waiting))return false;
    if(filter==='delegated'&&!isDelegatedToAssistant(e))return false;
    if(filter==='client'&&(e.group!=='client'||e.waiting))return false;
    if(filter==='none'&&(e.group!=='none'||e.waiting))return false;
    if(filter==='review'&&(e.group!=='review'||e.waiting))return false;
    if(filter==='important'&&!e.importance)return false;
    if(filter==='waiting'&&!e.waiting)return false;
    if(filter==='meetings'&&!e.tags.includes('Meetings'))return false;
    if(filter==='followups'&&!isFollowUpConversation(e))return false;
    if(search){const needle=search.toLowerCase().trim();if(!`${e.name} ${e.email} ${e.subject} ${e.messages.map(m=>m.body).join(' ')}`.toLowerCase().includes(needle))return false;}
    return true;
  }).sort((a,b)=>{
    // Today is a triage view: unresolved requests are more useful than newest-first spam.
    if(filter==='overview'){
      const score=e=>(e.group==='review'?4:0)+(e.unread?2:0)+(e.importance?1:0);
      if(score(b)!==score(a))return score(b)-score(a);
    }
    return new Date(latestTime(b))-new Date(latestTime(a));
  }),[emails,filter,search]);
  // The desktop reader opens the first matching email automatically; mobile stays
  // on the list until a conversation is explicitly selected.
  const opened = filtered.find(e=>e.id===selected) || filtered[0] || null;
  const openFromCopilot = id => {
    const email = emails.find(e=>e.id===id);
    if (!email) return;
    setFilter(email.archived ? 'archived' : email.completed ? 'completed' : 'all');
    setSearch('');setSelected(id);
    if (email.unread) onUpdate(id,{unread:false});
    setCopilotOpen(false);
  };
  const openFromRadar = id => {
    const target=emails.find(e=>e.id===id);
    if(!target)return;
    setFilter(target.archived?'archived':target.completed?'completed':'all');
    setSearch('');setSelected(id);
    if(target.unread)onUpdate(id,{unread:false});
  };
  const welcomeDate = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  const goToQueue = next => {setFilter(next);setSearch('');setSelected(null);};
  const queueCards = [
    {id:'assistant',label:'My queue',value:stats.assistant,detail:'Ready for Maya',icon:UserRoundCheck,tone:'teal'},
    {id:'client',label:'Needs Alex',value:stats.client,detail:'Waiting for a decision',icon:CircleAlert,tone:'peach'},
    {id:'review',label:'Needs review',value:stats.review,detail:'Unclear responsibility',icon:ShieldCheck,tone:'violet'},
    {id:'waiting',label:'Waiting for reply',value:stats.waiting,detail:'Already responded',icon:Clock3,tone:'blue'},
  ];

  if (authLoading) return <main className="auth-page" style={{display:'grid',placeItems:'center',minHeight:'100vh'}}>Checking your secure session…</main>;
  if (!session || (session.role==='assistant' && !provider)) return <><AuthFlow session={session} onAuthenticate={signIn} onConnect={connect} onSignOut={signOut}/>{toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}</>;
  if (session.role==='client' && !session.workspaceId) return <WorkspaceJoin session={session} onJoin={user=>{setSession(user);showToast('Shared workspace connected.');}} onSwitchToAssistant={user=>{setSession(user);showToast('Assistant workspace created. Choose a sample mailbox.');}} onSignOut={signOut}/>;
  if (!session.workspaceId) return <WorkspaceRecovery session={session} onRecovered={setSession} onSignOut={signOut}/>;
  if (!inboxLoaded) return <main className="auth-page" style={{display:'grid',placeItems:'center',minHeight:'100vh',padding:24}}>
    <div className="auth-card" role="status" style={{maxWidth:460,padding:28}}><h2>{syncStatus==='error'||syncStatus==='offline'?'Inbox temporarily unavailable':'Loading your shared inbox…'}</h2>
      <p>{syncStatus==='error'||syncStatus==='offline'?'The workspace could not load. Check that the Relay API and MongoDB are available, then retry.':'Connecting securely to the shared workspace.'}</p>
      {(syncStatus==='error'||syncStatus==='offline')&&<div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="auth-submit" onClick={()=>refresh(true).catch(error=>showToast(error.message))}>Retry inbox connection</button><button type="button" onClick={signOut}>Sign out</button></div>}
    </div></main>;
  if (session.role==='client') return <><ClientWorkspace session={session} emails={emails} selected={selected} setSelected={setSelected} onUpdate={onUpdate} onHandoff={onHandoff} showToast={showToast} onBack={signOut} backLabel="Sign out"/>{toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}</>;

  return <div className="app-shell clarity-app">
    <Sidebar filter={filter} setFilter={goToQueue} emails={emails} connectedProvider={provider} onSettings={()=>setShowSettings(true)} open={mobileMenu} setOpen={setMobileMenu}/>
    <div className="main-area">
      <header className="topbar clarity-topbar">
        <div className="topbar-left">
          <button className="mobile-menu-button" onClick={()=>setMobileMenu(true)} aria-label="Open menu"><Menu size={21}/></button>
          <span className="breadcrumb-workspace">Northstar Studio</span><ChevronRight size={15}/>
          <span className="breadcrumb-current">{filterNames[filter]}</span>
        </div>
        <div className="topbar-right"><span className="sync-dot"/><span className="topbar-status">Shared sample inbox · {syncStatus==='synced'?'Synced':syncStatus==='saving'?'Saving…':'Offline'} · {aiMode==='live'?'GroqCloud':'Demo AI'}</span><span className="topbar-divider"/>
          <button className="avatar-profile" onClick={()=>setShowSettings(true)} title="Account and connection settings" aria-label="Account settings">{session.name.charAt(0).toUpperCase()}</button>
        </div>
      </header>
      <main className="dashboard-scroller">
        <div className="dashboard-inner clarity-dashboard">
          <div className="clarity-pagehead">
            <div className="clarity-pagehead-copy">
              <div className="eyebrow">{filter==='overview' ? welcomeDate.toUpperCase() : 'INBOX / '+filterNames[filter].toUpperCase()}</div>
              <h1>{filter==='overview'?'Your priorities':filterNames[filter]}</h1>
              <p>{filter==='overview' ? 'Start with the conversations that need a decision or a reply.' : `${filtered.length} conversation${filtered.length===1?'':'s'} in this view.`}</p>
            </div>
            <div className="clarity-header-actions">
              <button className="primary-button clarity-ask" onClick={()=>setCopilotOpen(true)}><Sparkles size={19}/> Ask Relay</button>
              
              <div className="clarity-demo-wrap">
                <button className="secondary-button clarity-demo-toggle" onClick={()=>setDemoToolsOpen(v=>!v)} aria-expanded={demoToolsOpen} aria-controls="relay-demo-tools">Demo tools <ChevronDown size={16}/></button>
                {demoToolsOpen && <div id="relay-demo-tools" className="clarity-demo-menu">
                  <p>Testing tools · no real emails are sent</p>
                  <button onClick={()=>{setDemoToolsOpen(false);simulateIncoming();}} disabled={!!busyId}><Plus size={17}/>{busyId?'Classifying…':'Simulate incoming email'}</button>
                  <button onClick={()=>{setDemoToolsOpen(false);setShowSettings(true);}}><Settings2 size={17}/> Workspace settings &amp; reset</button>
                </div>}
              </div>
            </div>
          </div>
          {filter==='overview' && <div className="clarity-queue-cards" aria-label="Action queues">
            {queueCards.map(item=><button type="button" key={item.id} className={`clarity-queue-card clarity-queue-${item.tone}`} onClick={()=>goToQueue(item.id)}>
              <span className="clarity-queue-top"><item.icon size={20}/><ArrowRight size={17}/></span>
              <span className="clarity-queue-number">{item.value}</span>
              <strong>{item.label}</strong><small>{item.detail}</small>
            </button>)}
          </div>}
          {(filter==='overview'||filter==='followups') && <FollowUpRadar emails={emails} expanded={filter==='followups'} onViewAll={()=>goToQueue('followups')} onOpen={openFromRadar}/>}
          <section className="inbox-workspace clarity-inbox" aria-label="Email conversations">
            <div className="inbox-header clarity-inbox-header">
              <div><div className="section-overline">{filter==='overview'?'FOCUS LIST':'CONVERSATION LIST'}</div>
                <h2>{filter==='overview'?'Needs attention':filterNames[filter]} <span className="inbox-count">{filtered.length}</span></h2>
              </div>
              <div className="clarity-inbox-hint">{filter==='overview'?'Review first, then respond':'Select an email to see its next step'}</div>
            </div>
            <div className="inbox-layout">
              <div className={`mail-list-pane ${selected&&opened?'detail-is-open':''}`}>
                <div className="mail-controls"><div className="search-wrap"><Search size={18}/><input value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}} placeholder="Search sender, subject, or message" aria-label="Search conversations"/>{search&&<button onClick={()=>setSearch('')} aria-label="Clear search"><X size={15}/></button>}</div>
                  <div className="filter-dropdown"><Filter size={17}/><select value={filter} onChange={e=>goToQueue(e.target.value)} aria-label="Filter conversations">
                    <option value="overview">Today · Needs attention</option><option value="followups">Follow-up Radar</option><option value="all">All conversations</option><option value="assistant">My queue</option><option value="client">Needs Alex</option><option value="review">Needs review</option><option value="waiting">Waiting for reply</option><option value="delegated">Delegated to me</option><option value="meetings">Meetings</option><option value="important">Important</option><option value="none">No reply needed</option><option value="completed">Completed</option><option value="archived">Archived</option>
                  </select><ChevronDown size={14}/></div>
                </div>
                <div className="mail-list-head"><span>{filter==='overview'?'Priority conversations':filterNames[filter]}</span><span>{filtered.length} threads</span></div>
                <div className="mail-list">{filtered.length?filtered.map(e=><MailRow key={e.id} email={e} active={opened?.id===e.id} onClick={()=>{setSelected(e.id);if(e.unread)onUpdate(e.id,{unread:false});}}/>):
                  <div className="mail-list-zero"><CheckCircle2 size={30}/><h3>{filter==='overview'?'All clear for now':'No conversations here'}</h3><p>{search?'Try another search.':'Choose another queue to find more conversations.'}</p><button onClick={()=>{goToQueue('all');}}>Show all conversations</button></div>}
                </div>
              </div>
              <div className={`mail-detail-pane ${selected&&opened?'mobile-show-detail':''}`}>
                <EmailDetail draftMode={aiMode} email={opened} onClose={()=>setSelected(null)} onUpdate={onUpdate} onAnalyze={onAnalyze} onFollowUp={onFollowUp} onDraft={onDraft} onSendDraft={onSendDraft} onResetThread={onResetThread} onHandoff={onHandoff} showToast={showToast} busy={Boolean(opened&&busyId===opened.id)}/>
              </div>
            </div>
          </section>
          <footer className="dashboard-footer"><span><ShieldCheck size={14}/> Shared sample inbox · simulated connection and sending</span><span>AI results are suggestions; people make final decisions.</span></footer>
        </div>
      </main>
    </div>
    {copilotOpen&&<InboxCopilot emails={emails} selectedId={selected} onClose={()=>setCopilotOpen(false)} onOpenThread={openFromCopilot}/>}
    {showSettings&&<SettingsDialog session={session} syncStatus={syncStatus} onReconnect={reconnect} onSignOut={signOut} onReset={reset} onClose={()=>setShowSettings(false)}/>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}
