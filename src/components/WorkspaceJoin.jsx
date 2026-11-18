import { useState } from 'react';
import { ArrowRight, Link2, LockKeyhole, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { joinSharedWorkspace } from '../lib/workspaceClient.js';
import { switchToAssistantAccount } from '../lib/authClient.js';
import '../workspace.css';
export default function WorkspaceJoin({session,onJoin,onSignOut,onSwitchToAssistant}){
  const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(event){
    event.preventDefault();setError('');setBusy(true);
    try {const result=await joinSharedWorkspace(code.trim());onJoin(result.user);}
    catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  async function becomeAssistant(){
    if(busy)return;
    if(!window.confirm('Use this account as an Assistant instead? This will create your own workspace. To test the Client view later, register another account.'))return;
    setError('');setBusy(true);
    try {const {user}=await switchToAssistantAccount();onSwitchToAssistant(user);}
    catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  return <main className="workspace-join-page"><div className="workspace-join-card">
    <div className="auth-wordmark"><span className="auth-wordmark-icon"><Mail size={22}/></span>relay<span>.</span></div>
    <span className="workspace-eyebrow"><Link2 size={17}/> CONNECT YOUR WORKSPACE</span>
    <h1>Join your assistant's workspace.</h1>
    <p>Hi {session.name}. Your client account is ready. Ask your assistant to create an invitation in <b>Account &amp; connection</b>, then enter the code below.</p>
    <form onSubmit={submit}><label htmlFor="workspace-invite-code">One-time invitation code</label>
      <input id="workspace-invite-code" type="text" autoComplete="off" spellCheck={false} placeholder="Paste the invitation code" value={code} onChange={e=>setCode(e.target.value)} required maxLength={50}/>
      {error&&<p role="alert" className="workspace-join-error">{error}</p>}
      <button className="primary-button" disabled={busy||!code.trim()}>{busy?'Joining…':'Connect to shared inbox'} <ArrowRight size={17}/></button></form>
    <div className="workspace-join-note"><ShieldCheck size={19}/> Client accounts can only see their approval requests and handoff history. Invitation codes expire after 24 hours and can only be used once.</div>
    <div className="workspace-role-switch"><p>Trying to access Relay's main assistant dashboard instead?</p><button type="button" disabled={busy} onClick={becomeAssistant}>Use this account as an assistant <ArrowRight size={16}/></button><small>This creates your own workspace. You will need a separate Client account to test invitations.</small></div>
    <button className="workspace-signout" onClick={onSignOut}><LogOut size={16}/> Sign out</button>
  </div></main>;
}
