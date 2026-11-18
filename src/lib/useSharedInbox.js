/** Shared inbox with server-owned persistence, debounced edits and cross-device polling.
 * Every edit carries the conversation revision; stale edits are rejected rather
 * than silently overwriting a recent client handoff.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { workspaceRequest } from './workspaceClient.js';

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const byId=list=>new Map(list.map(email=>[email.id,email]));
export function useSharedInbox(session,transform=e=>e,notify=()=>{}){
  const [emails,setView]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [syncStatus,setStatus]=useState('connecting');
  const viewRef=useRef([]);
  const baseRef=useRef(new Map());
  const dirtyRef=useRef(new Set());
  const timerRef=useRef(null);
  const sendingRef=useRef(false);
  const notifyRef=useRef(notify);
  notifyRef.current=notify;
  const role=session?.role;
  const workspaceId=session?.workspaceId;
  const userId=session?.id;

  const applyList=useCallback((list)=>{
    const serverList=list.map(e=>structuredClone(e));
    baseRef.current=byId(serverList);
    const view=serverList.map(transform);
    viewRef.current=view;setView(view);
    dirtyRef.current.clear();setStatus('synced');setLoaded(true);
  },[transform]);

  const refresh=useCallback(async(force=false)=>{
    if(!workspaceId)return;
    if((dirtyRef.current.size||sendingRef.current)&&!force)return;
    const result=await workspaceRequest('/state');
    if(result.linked&&(!dirtyRef.current.size&&!sendingRef.current||force))applyList(result.emails);
  },[workspaceId,userId,applyList]);

  useEffect(()=>{
    if(timerRef.current)clearTimeout(timerRef.current);
    dirtyRef.current.clear();baseRef.current=new Map();viewRef.current=[];setView([]);
    setLoaded(!workspaceId);setStatus(workspaceId?'connecting':'unlinked');
    if(!workspaceId)return;
    let active=true;
    workspaceRequest('/state').then(result=>{if(active&&result.linked)applyList(result.emails);})
      .catch(error=>{if(active){setStatus('error');notifyRef.current(error.message);}});
    return ()=>{active=false;if(timerRef.current)clearTimeout(timerRef.current);};
  },[workspaceId,userId,role,applyList]);

  const flush=useCallback(async()=>{
    if(sendingRef.current||!workspaceId||!dirtyRef.current.size)return;
    sendingRef.current=true;setStatus('saving');
    try {
      while(dirtyRef.current.size){
        const id=dirtyRef.current.values().next().value;
        dirtyRef.current.delete(id);
        const old=baseRef.current.get(id);
        const current=viewRef.current.find(e=>e.id===id);
        if(equal(old,current))continue;
        let result;
        if(!current){
          if(!old)continue;
          await workspaceRequest(`/thread/${encodeURIComponent(id)}`,{method:'DELETE',body:{}});
          baseRef.current.delete(id);continue;
        }
        if(!old){
          result=await workspaceRequest('/thread',{method:'POST',body:{email:current}});
        } else if(role==='client'){
          // Client edits are limited to read-status changes; all actual handoffs
          // are performed through the dedicated, role-checked server endpoint.
          result=await workspaceRequest(`/thread/${encodeURIComponent(id)}`,{method:'PATCH',body:{revision:old._rev,patch:{unread:current.unread}}});
        } else {
          result=await workspaceRequest(`/thread/${encodeURIComponent(id)}`,{method:'PATCH',body:{revision:old._rev,email:current}});
        }
        baseRef.current.set(id,result.email);
        // If the user typed more while the request was in flight, preserve that
        // edit but advance its revision so the next write is not rejected.
        const inView=viewRef.current.find(e=>e.id===id);
        if(inView){
          const next=viewRef.current.map(e=>e.id===id?{...e,_rev:result.email._rev}:e);
          viewRef.current=next;setView(next);
          if(!equal({...inView,_rev:result.email._rev},transform(result.email)))dirtyRef.current.add(id);
        }
      }
      setStatus('synced');
    }catch(error){
      setStatus('error');notifyRef.current(error.status===409?'A conversation changed in another session. Reloading the latest copy.':error.message);
      // Do not force an out-of-date local copy over a newer server version.
      dirtyRef.current.clear();
      try{const state=await workspaceRequest('/state');applyList(state.emails);}catch{ /* Preserve local UI until connectivity returns. */ }
    }finally{sendingRef.current=false;}
  },[workspaceId,role,applyList,transform]);

  const setEmails=useCallback(updater=>{
    const previous=viewRef.current;
    const next=typeof updater==='function'?updater(previous):updater;
    if(!Array.isArray(next))return;
    const before=byId(previous),after=byId(next);
    for(const id of new Set([...before.keys(),...after.keys()])){
      if(!equal(before.get(id),after.get(id)))dirtyRef.current.add(id);
    }
    viewRef.current=next;setView(next);
    if(!workspaceId)return;
    setStatus('saving');
    if(timerRef.current)clearTimeout(timerRef.current);
    timerRef.current=setTimeout(()=>{void flush();},550);
  },[workspaceId,flush]);

  const applyRemoteThread=useCallback(email=>{
    baseRef.current.set(email.id,email);
    dirtyRef.current.delete(email.id);
    const next=viewRef.current.map(e=>e.id===email.id?transform(email):e);
    viewRef.current=next;setView(next);setStatus('synced');
  },[transform]);

  useEffect(()=>{
    if(!workspaceId)return;
    const ticker=setInterval(()=>{if(!dirtyRef.current.size&&!sendingRef.current)refresh().catch(()=>setStatus('offline'));},4000);
    return ()=>clearInterval(ticker);
  },[workspaceId,userId,refresh]);
  return {emails,setEmails,refresh,loaded,syncStatus,applyRemoteThread,applyList};
}
