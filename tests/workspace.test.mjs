import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAuthService } from '../server/auth.mjs';
import { createWorkspaceStore } from '../server/workspaceStore.mjs';
import { createWorkspaceAPI } from '../server/workspaceAPI.mjs';

async function setup(t){
  const dir=await mkdtemp(path.join(os.tmpdir(),'relay-workspaces-'));
  const auth=createAuthService({file:path.join(dir,'auth.json')});await auth.ready;
  const store=await createWorkspaceStore({file:path.join(dir,'workspaces.json'),mongoUri:''});
  const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  const readJSON=async req=>{let s='';for await(const c of req)s+=c;return JSON.parse(s||'{}');};
  const wr=createWorkspaceAPI({auth,store,send,readJSON});
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost').pathname;
    if(await auth.route(req,res,url,send,readJSON))return;
    if(await wr(req,res,url))return;
    send(res,404,{error:'Not found'});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await store.close();await rm(dir,{recursive:true,force:true});});
  const url=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,{method='GET',body,cookie}={})=>{
    const response=await fetch(url+path,{method,headers:{...(method==='GET'?{}:{'X-Relay-Request':'1','Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  return {call,auth,store};
}

test('linked assistant and client see one durable inbox; outsiders cannot read it',async t=>{
  const {call,store}=await setup(t);
  const maya=await call('/api/auth/signup',{method:'POST',body:{name:'Maya',email:'maya@example.com',password:'StrongPassword1!',role:'assistant'}});
  const alex=await call('/api/auth/signup',{method:'POST',body:{name:'Alex',email:'alex@example.com',password:'StrongPassword1!',role:'client'}});
  assert.equal(maya.status,200);assert.equal(alex.status,200);
  const outsider=await call('/api/workspace/state');assert.equal(outsider.status,401);
  const unlinked=await call('/api/workspace/state',{cookie:alex.cookie});assert.equal(unlinked.data.linked,false);
  const invite=await call('/api/workspace/invite',{method:'POST',cookie:maya.cookie,body:{}});
  assert.equal(invite.status,200);assert.ok(invite.data.code.length>30);
  const joined=await call('/api/workspace/join',{method:'POST',cookie:alex.cookie,body:{code:invite.data.code}});
  assert.equal(joined.status,200);assert.equal(joined.data.user.workspaceId,maya.data.user.workspaceId);
  assert.equal((await call('/api/workspace/join',{method:'POST',cookie:alex.cookie,body:{code:invite.data.code}})).status,409);
  const assistantState=(await call('/api/workspace/state',{cookie:maya.cookie})).data;
  const clientState=(await call('/api/workspace/state',{cookie:alex.cookie})).data;
  assert.ok(assistantState.emails.length>clientState.emails.length);
  const target=clientState.emails.find(e=>e.group==='client');assert.ok(target);
  const denied=await call(`/api/workspace/thread/${target.id}`,{method:'PATCH',cookie:alex.cookie,body:{revision:target._rev,email:{...target,group:'assistant'}}});
  assert.equal(denied.status,403);
  const delegated=await call('/api/workspace/handoff',{method:'POST',cookie:alex.cookie,body:{id:target.id,action:'delegate',note:'Coordinate only',revision:target._rev}});
  assert.equal(delegated.status,200);assert.equal(delegated.data.email.group,'assistant');
  const after=(await call('/api/workspace/state',{cookie:maya.cookie})).data;
  assert.equal(after.emails.find(e=>e.id===target.id).handoff.status,'delegated');
  const stale=await call('/api/workspace/handoff',{method:'POST',cookie:alex.cookie,body:{id:target.id,action:'recall',revision:target._rev}});
  assert.equal(stale.status,409);
  const returnEmail=after.emails.find(e=>e.id===target.id);
  const returned=await call('/api/workspace/handoff',{method:'POST',cookie:maya.cookie,body:{id:target.id,action:'return',revision:returnEmail._rev}});
  assert.equal(returned.status,200);assert.equal(returned.data.email.group,'client');
  const again=(await call('/api/workspace/state',{cookie:alex.cookie})).data;
  assert.ok(again.emails.some(e=>e.id===target.id&&e.group==='client'));
  const persisted=await store.get(maya.data.user.workspaceId);
  assert.equal(persisted.emails.find(e=>e.id===target.id).handoff.status,'return');
});

test('only assistants can change messages, reset demo or issue invitations',async t=>{
  const {call}=await setup(t);
  const maya=await call('/api/auth/signup',{method:'POST',body:{name:'Maya',email:'maya2@example.com',password:'StrongPassword1!',role:'assistant'}});
  const alex=await call('/api/auth/signup',{method:'POST',body:{name:'Alex',email:'alex2@example.com',password:'StrongPassword1!',role:'client'}});
  const state=(await call('/api/workspace/state',{cookie:maya.cookie})).data;
  const email=state.emails[0];
  assert.equal((await call('/api/workspace/invite',{method:'POST',cookie:alex.cookie,body:{}})).status,403);
  assert.equal((await call('/api/workspace/reset',{method:'POST',cookie:alex.cookie,body:{confirm:'RESET SAMPLE INBOX'}})).status,403);
  const updated=await call(`/api/workspace/thread/${email.id}`,{method:'PATCH',cookie:maya.cookie,body:{revision:email._rev,email:{...email,unread:!email.unread}}});
  assert.equal(updated.status,200);assert.equal(updated.data.email._rev,2);
  const bad=await call(`/api/workspace/thread/${email.id}`,{method:'PATCH',cookie:maya.cookie,body:{revision:email._rev,email:{...email,importance:true}}});
  assert.equal(bad.status,409);
});

test('workspace conversations survive reopening a server-owned JSON store',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'relay-persist-'));
  const file=path.join(dir,'workspace.json');
  t.after(async()=>rm(dir,{recursive:true,force:true}));
  const first=await createWorkspaceStore({file,mongoUri:''});
  const starting=await first.get('workspace-persistent');
  await first.mutate('workspace-persistent',state=>{
    state.emails[0].subject='Updated from the assistant session';
    state.emails[0]._rev+=1;
    return state;
  });
  await first.close();
  const reopened=await createWorkspaceStore({file,mongoUri:''});
  const saved=await reopened.get('workspace-persistent');
  assert.equal(saved.emails[0].subject,'Updated from the assistant session');
  assert.equal(saved.emails[0]._rev,starting.emails[0]._rev+1);
  await reopened.close();
});


test('unlinked client can intentionally become an assistant, without affecting linked accounts',async t=>{
  const {call}=await setup(t);
  const user=await call('/api/auth/signup',{method:'POST',body:{name:'Blue Box',email:'blue@example.com',password:'StrongPassword1!',role:'client'}});
  assert.equal(user.status,200);
  assert.equal(user.data.user.workspaceId,null);
  const switched=await call('/api/auth/switch-to-assistant',{method:'POST',cookie:user.cookie,body:{}});
  assert.equal(switched.status,200);
  assert.equal(switched.data.user.role,'assistant');
  assert.ok(switched.data.user.workspaceId);
  assert.equal((await call('/api/auth/me',{cookie:user.cookie})).data.user.role,'assistant');
  assert.equal((await call('/api/workspace/state',{cookie:user.cookie})).status,200);
  const rejected=await call('/api/auth/switch-to-assistant',{method:'POST',cookie:user.cookie,body:{}});
  assert.equal(rejected.status,409);
});

test('a client already linked to an assistant cannot switch roles',async t=>{
  const {call}=await setup(t);
  const a=await call('/api/auth/signup',{method:'POST',body:{name:'Maya',email:'maya3@example.com',password:'StrongPassword1!',role:'assistant'}});
  const c=await call('/api/auth/signup',{method:'POST',body:{name:'Alex',email:'alex3@example.com',password:'StrongPassword1!',role:'client'}});
  const invite=await call('/api/workspace/invite',{method:'POST',cookie:a.cookie,body:{}});
  assert.equal((await call('/api/workspace/join',{method:'POST',cookie:c.cookie,body:{code:invite.data.code}})).status,200);
  const switched=await call('/api/auth/switch-to-assistant',{method:'POST',cookie:c.cookie,body:{}});
  assert.equal(switched.status,409);
  assert.equal((await call('/api/auth/me',{cookie:c.cookie})).data.user.role,'client');
});


test('assistant workspace recovery endpoint is idempotent and rejects client accounts',async t=>{
  const {call}=await setup(t);
  const assistant=await call('/api/auth/signup',{method:'POST',body:{name:'Legacy Assistant',email:'legacy@example.com',password:'StrongPassword1!',role:'assistant'}});
  const client=await call('/api/auth/signup',{method:'POST',body:{name:'Unlinked Client',email:'client-role@example.com',password:'StrongPassword1!',role:'client'}});
  assert.equal(assistant.status,200);
  const first=await call('/api/auth/ensure-assistant-workspace',{method:'POST',cookie:assistant.cookie,body:{}});
  const second=await call('/api/auth/ensure-assistant-workspace',{method:'POST',cookie:assistant.cookie,body:{}});
  assert.equal(first.status,200);
  assert.equal(first.data.user.workspaceId,assistant.data.user.workspaceId);
  assert.equal(second.data.user.workspaceId,first.data.user.workspaceId);
  assert.equal((await call('/api/auth/ensure-assistant-workspace',{method:'POST',cookie:client.cookie,body:{}})).status,403);
  assert.equal((await call('/api/auth/ensure-assistant-workspace',{method:'POST',body:{}})).status,401);
});


test('client-to-assistant conversion connects mailbox and loads workspace without a redirect loop',async t=>{
  const {call}=await setup(t);
  const signedUp=await call('/api/auth/signup',{method:'POST',body:{name:'Blue Box',email:'blue-box-flow@example.com',password:'StrongPassword1!',role:'client'}});
  const converted=await call('/api/auth/switch-to-assistant',{method:'POST',cookie:signedUp.cookie,body:{}});
  assert.equal(converted.status,200);
  assert.equal(converted.data.user.role,'assistant');
  assert.ok(converted.data.user.workspaceId);
  const connected=await call('/api/auth/connect',{method:'POST',cookie:signedUp.cookie,body:{provider:'Gmail'}});
  assert.equal(connected.status,200);
  assert.equal(connected.data.user.workspaceId,converted.data.user.workspaceId);
  const session=await call('/api/auth/me',{cookie:signedUp.cookie});
  assert.equal(session.data.user.workspaceId,converted.data.user.workspaceId);
  const inbox=await call('/api/workspace/state',{cookie:signedUp.cookie});
  assert.equal(inbox.status,200);
  assert.equal(inbox.data.linked,true);
  assert.ok(inbox.data.emails.length>0);
});
