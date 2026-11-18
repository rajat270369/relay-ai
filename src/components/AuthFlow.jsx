import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, CircleCheckBig, Clock3,
  Inbox, LockKeyhole, Mail, RefreshCw, ShieldCheck, Sparkles,
  UserRound, UserRoundCheck, WandSparkles,
} from 'lucide-react';

const providers = [
  {name:'Gmail',mark:'G',desc:'Google Mail · simulated authorization'},
  {name:'Outlook',mark:'O',desc:'Microsoft Outlook · simulated authorization'},
];

function ProductPreview() {
  return <div className="auth-preview" aria-hidden="true">
    <div className="auth-preview-heading"><span className="auth-preview-mark"><Mail size={16}/></span><b>Inbox intelligence</b><span className="auth-preview-pulse"/></div>
    <div className="auth-preview-stat"><span>Needs your attention</span><strong>04 <small>conversations</small></strong></div>
    <div className="auth-preview-row"><span className="auth-preview-icon purple"><UserRoundCheck size={19}/></span><div><b>Client approval</b><small>Review by Alex</small></div><em>Client</em></div>
    <div className="auth-preview-row"><span className="auth-preview-icon green"><Clock3 size={19}/></span><div><b>Calendar request</b><small>Coordinated by Maya</small></div><em>Assistant</em></div>
    <div className="auth-preview-row"><span className="auth-preview-icon gray"><CircleCheckBig size={19}/></span><div><b>Weekly digest</b><small>No response needed</small></div><em>No reply</em></div>
    <div className="auth-preview-insight"><Sparkles size={18}/><span><b>Relay understands the handoff.</b> Know who should respond, without the clutter.</span></div>
  </div>;
}

export default function AuthFlow({ session, onAuthenticate, onConnect, onSignOut }) {
  const [mode,setMode] = useState('signin');
  const [role,setRole] = useState('assistant');
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [provider,setProvider] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(()=>{setError('');},[mode,role,provider]);
  const connectionStep = Boolean(session && session.role==='assistant' && !session.connection);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);setError('');
    try {
      await onAuthenticate({mode,email,password,...(mode==='signup'?{name,role}:{})});
      setPassword('');
    } catch(cause) {setError(cause?.message||'Unable to sign in. Please try again.');}
    finally {setBusy(false);}
  }
  async function approveConnection(value=provider) {
    if (!value||busy) return;
    setBusy(true);setError('');
    try {await onConnect(value);} catch(cause){setError(cause?.message||'Unable to set up the demo mailbox.');}
    finally {setBusy(false);}
  }

  return <main className="auth-page">
    <div className="auth-shell">
      <section className="auth-main">
        <div className="auth-wordmark"><span className="auth-wordmark-icon"><Mail size={23}/></span>relay<span>.</span></div>
        <div className="auth-content">
          <div className="auth-eyebrow"><Sparkles size={17}/> THE INTELLIGENT INBOX</div>
          <h1>{connectionStep ? <>One connection.<br/><span>Total clarity.</span></> : <>Email, simplified.<br/><span>Decisions, clearer.</span></>}</h1>
          <p className="auth-lede">{connectionStep
            ? 'Choose a fictional sample mailbox. Your Relay account is real, but no external email provider is accessed.'
            : 'Sign in securely to your Relay account and explore intelligent email triage and thoughtful handoffs.'}</p>
          <div className="auth-feature-list">
            <span><CheckCircle2 size={18}/> Understand who needs to reply</span>
            <span><CheckCircle2 size={18}/> Keep approvals with the client</span>
            <span><CheckCircle2 size={18}/> Turn crowded threads into clear next steps</span>
          </div>
          <div className="auth-card">
            {connectionStep ? <>
              <div className="auth-card-heading"><div><span className="auth-step-label">STEP 02 / DEMO MAILBOX</span><h2>{provider ? 'Review sample connection' : 'Choose a demo email provider'}</h2><p>Signed in as {session.name} · {session.email}</p></div><ShieldCheck size={22}/></div>
              {!provider ? <>
                <div className="auth-provider-list">
                  {providers.map(item=><button type="button" key={item.name} className="auth-provider-button" onClick={()=>setProvider(item.name)}><span className={`auth-provider-mark ${item.name.toLowerCase()}`}>{item.mark}</span><span><b>{item.name} sample inbox</b><small>{item.desc}</small></span><ArrowRight size={19}/></button>)}
                </div>
                <button type="button" disabled={busy} className="auth-demo-link" onClick={()=>approveConnection('Demo Workspace')}>Use sample workspace instead <ArrowRight size={16}/></button>
              </> : <>
                <div className="auth-consent">
                  <div className="auth-consent-brand"><span className={`auth-provider-mark ${provider.toLowerCase()}`}>{provider==='Gmail'?'G':'O'}</span><div><b>{provider} sample connection</b><small>Simulation only · No real OAuth request</small></div></div>
                  <div className="auth-consent-subtitle">Relay will demonstrate how it could:</div>
                  <div className="auth-consent-item"><Inbox size={18}/> Load fictional sample conversations</div>
                  <div className="auth-consent-item"><WandSparkles size={18}/> Organize requests and suggest responses</div>
                  <div className="auth-consent-item"><UserRoundCheck size={18}/> Coordinate sample actions between assistant and client</div>
                  <p><LockKeyhole size={15}/> No Gmail or Outlook permissions are requested. Mailbox connection and sending remain simulated.</p>
                </div>
                <div className="auth-card-actions"><button className="auth-back-button" onClick={()=>setProvider(null)} disabled={busy}><ArrowLeft size={17}/> Back</button><button className="auth-submit" onClick={()=>approveConnection()} disabled={busy}>{busy?<><RefreshCw className="auth-spin" size={18}/> Connecting…</>:<><Check size={18}/> Enter sample inbox</>}</button></div>
              </>}
              {error&&<p className="auth-error" role="alert">{error}</p>}
              <div className="auth-card-foot"><button onClick={onSignOut}>Sign out of Relay</button></div>
            </> : <>
              <div className="auth-card-heading"><div><span className="auth-step-label">STEP 01 / SECURE ACCOUNT</span><h2>Welcome to Relay</h2><p>{mode==='signup'?'Create your account with a password.':'Sign in to your existing Relay account.'}</p></div><ShieldCheck size={22}/></div>
              <div className="auth-tab-row" role="tablist" aria-label="Account mode"><button role="tab" type="button" aria-selected={mode==='signin'} className={mode==='signin'?'active':''} onClick={()=>setMode('signin')}>Sign in</button><button role="tab" type="button" aria-selected={mode==='signup'} className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Create account</button></div>
              {mode==='signup'&&<div className="auth-role-choices" role="group" aria-label="Choose account role">
                <button type="button" className={role==='assistant'?'selected':''} onClick={()=>setRole('assistant')}><UserRoundCheck size={18}/><span><b>Assistant</b><small>Manage inbox</small></span></button>
                <button type="button" className={role==='client'?'selected':''} onClick={()=>setRole('client')}><UserRound size={18}/><span><b>Client</b><small>Review decisions</small></span></button>
              </div>}
              <form onSubmit={submit} className="auth-identity-form">
                {mode==='signup'&&<label>Display name<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" placeholder="Your name"/></label>}
                <label>Email address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" maxLength={160} required autoComplete="username" placeholder="you@example.com"/></label>
                <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required minLength={mode==='signup'?10:1} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} placeholder={mode==='signup'?'At least 10 characters':'Your password'}/></label>
                {error&&<p className="auth-error" role="alert">{error}</p>}
                <button className="auth-submit" type="submit" disabled={busy}>{busy?'Working…':mode==='signup'?'Create secure account':'Sign in to Relay'} <ArrowRight size={18}/></button>
              </form>
              <p className="auth-inline-note"><LockKeyhole size={15}/> Accounts use password hashing and server sessions. The inbox contains fictional sample data, not your real emails.</p>
            </>}
          </div>
        </div>
        <div className="auth-legal">RELAY / AUTHENTICATED PROTOTYPE <span>·</span> Fictional messages only</div>
      </section>
      <aside className="auth-aside"><div className="auth-aside-glow glow-one"/><div className="auth-aside-glow glow-two"/><div className="auth-aside-inner"><div className="auth-aside-overline"><Sparkles size={16}/> THINK BEYOND THE INBOX</div><h2>A calmer way<br/>to stay in sync.</h2><p>Bring clarity to every handoff. Give the right person the right conversation at the right time.</p><ProductPreview/><div className="auth-aside-footer"><span className="auth-aside-dot"/> INTELLIGENT TRIAGE, HUMAN CONTROL</div></div></aside>
    </div>
  </main>;
}
