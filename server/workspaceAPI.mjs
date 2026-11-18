/** Role-authorized workspace endpoints. The server (not a browser tab) owns the
 * current copy of every conversation and validates all handoff transitions.
 */
import { applyHandoffAction } from '../src/lib/handoff.js';
import { sampleEmails } from '../src/data/sampleEmails.js';
import { WorkspaceConflict } from './workspaceStore.mjs';

const error=(status,message)=>Object.assign(new Error(message),{status});
const validThread=e=>e && typeof e==='object' && typeof e.id==='string' && /^[A-Za-z0-9_-]{1,90}$/.test(e.id)
  && typeof e.subject==='string' && e.subject.length<=500 && typeof e.name==='string' && e.name.length<=200
  && Array.isArray(e.messages) && e.messages.length<=120 && e.messages.every(m=>typeof m.body==='string'&&m.body.length<=20000)
  && JSON.stringify(e).length<=120000;
const visible=(emails,role)=>role==='client' ? emails.filter(e=>e.group==='client'||Boolean(e.handoff?.status)) : emails;
const threadRev=e=>Number.isInteger(e?._rev)?e._rev:1;

export function createWorkspaceAPI({auth,store,send,readJSON}) {
  return async function route(req,res,pathname){
    if(!pathname.startsWith('/api/workspace'))return false;
    try {
      const user=await auth.getSession(auth.tokenFromRequest(req));
      if(!user)throw error(401,'Sign in to access your shared workspace.');
      const mutation=req.method!=='GET';
      if(mutation&&req.headers['x-relay-request']!=='1')throw error(403,'Invalid request origin.');
      if(req.method==='POST'&&pathname==='/api/workspace/invite'){
        const result=await auth.createInvite(auth.tokenFromRequest(req));
        send(res,200,result);return true;
      }
      if(req.method==='POST'&&pathname==='/api/workspace/join'){
        const data=await readJSON(req,2000);
        const linkedUser=await auth.joinWorkspace(auth.tokenFromRequest(req),data.code);
        send(res,200,{user:linkedUser});return true;
      }
      if(!user.workspaceId){
        if(req.method==='GET'&&pathname==='/api/workspace/state'){send(res,200,{linked:false,emails:[],mode:store.mode});return true;}
        throw error(403,'Join an assistant workspace using an invitation code.');
      }
      if(req.method==='GET'&&pathname==='/api/workspace/state'){
        const state=await store.get(user.workspaceId);
        send(res,200,{linked:true,emails:visible(state.emails,user.role),mode:store.mode,revision:state.revision,updatedAt:state.updatedAt});return true;
      }
      if(req.method==='POST'&&pathname==='/api/workspace/handoff'){
        const {id,action,note,revision}=await readJSON(req,3000);
        if(!id||!action)throw error(400,'Conversation and action are required.');
        if(!['delegate','handled','recall','reopen','return'].includes(action))throw error(400,'Unknown handoff action.');
        if((user.role==='client'&&action==='return')||(user.role==='assistant'&&action!=='return'))throw error(403,'This action is unavailable for your role.');
        let updated;
        await store.mutate(user.workspaceId,state=>{
          const index=state.emails.findIndex(e=>e.id===id);
          if(index<0)throw error(404,'Conversation not found.');
          const existing=state.emails[index];
          if(threadRev(existing)!==revision)throw new WorkspaceConflict();
          updated={...applyHandoffAction(existing,action,{note}),_rev:threadRev(existing)+1};
          state.emails[index]=updated;return state;
        });
        send(res,200,{email:updated});return true;
      }
      if(req.method==='PATCH'&&pathname.startsWith('/api/workspace/thread/')){
        const id=decodeURIComponent(pathname.slice('/api/workspace/thread/'.length));
        const data=await readJSON(req,130000);
        let result;
        await store.mutate(user.workspaceId,state=>{
          const index=state.emails.findIndex(e=>e.id===id);
          if(index<0)throw error(404,'Conversation not found.');
          const old=state.emails[index];
          if(threadRev(old)!==data.revision)throw new WorkspaceConflict();
          if(user.role==='client'){
            // Clients may mark their visible requests as read, but cannot edit
            // assignment, conversation text, or send on behalf of assistants.
            if(old.group!=='client'||Object.keys(data.patch||{}).some(k=>k!=='unread')||typeof data.patch?.unread!=='boolean')
              throw error(403,'Client accounts can only update read status here.');
            result={...old,unread:data.patch.unread,_rev:threadRev(old)+1};
          } else {
            if(!validThread(data.email)||data.email.id!==id)throw error(400,'Invalid conversation payload.');
            result={...data.email,_rev:threadRev(old)+1};
          }
          state.emails[index]=result;return state;
        });
        send(res,200,{email:result});return true;
      }
      if(req.method==='POST'&&pathname==='/api/workspace/thread'){
        if(user.role!=='assistant')throw error(403,'Only an assistant can add new sample conversations.');
        const data=await readJSON(req,130000);
        if(!validThread(data.email))throw error(400,'Invalid conversation payload.');
        const next={...data.email,_rev:1};
        await store.mutate(user.workspaceId,state=>{
          if(state.emails.some(e=>e.id===next.id))throw error(409,'A conversation with that ID already exists.');
          state.emails.unshift(next);return state;
        });
        send(res,201,{email:next});return true;
      }
      if(req.method==='DELETE'&&pathname.startsWith('/api/workspace/thread/')){
        if(user.role!=='assistant')throw error(403,'Only an assistant can remove sample conversations.');
        const id=decodeURIComponent(pathname.slice('/api/workspace/thread/'.length));
        await store.mutate(user.workspaceId,state=>{
          if(!state.emails.some(e=>e.id===id))throw error(404,'Conversation not found.');
          state.emails=state.emails.filter(e=>e.id!==id);return state;
        });
        send(res,200,{ok:true});return true;
      }
      if(req.method==='POST'&&pathname==='/api/workspace/reset'){
        if(user.role!=='assistant')throw error(403,'Only an assistant can reset the sample inbox.');
        const data=await readJSON(req,1000);
        if(data.confirm!=='RESET SAMPLE INBOX')throw error(400,'Explicit reset confirmation is required.');
        const next=await store.mutate(user.workspaceId,state=>{
          state.emails=structuredClone(sampleEmails).map(e=>({...e,_rev:1}));return state;
        });
        send(res,200,{emails:next.emails});return true;
      }
      throw error(404,'Workspace endpoint not found.');
    }catch(cause){
      send(res,cause.status||500,{error:cause.status?cause.message:'Workspace request failed.'});return true;
    }
  };
}
