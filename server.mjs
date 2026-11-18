import http from 'node:http';
import { analyzeEmail, draftReply } from './src/lib/demoAI.js';
import { answerInboxQuestion } from './src/lib/inboxCopilot.js';
import { liveConfig, safeThread, groqClassify, groqDraft, groqAsk } from './server/groqAI.mjs';
import { createAuthService } from './server/auth.mjs';
import { createWorkspaceStore } from './server/workspaceStore.mjs';
import { createWorkspaceAPI } from './server/workspaceAPI.mjs';
import { serveBuiltFrontend } from './server/staticAssets.mjs';

// Load server-side configuration without requiring a package.json script change.
// Node 22+ supports process.loadEnvFile(). Missing .env is fine for demo mode.
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(new URL('./.env', import.meta.url)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const port=Number(process.env.PORT||process.env.API_PORT||8787);
const host=process.env.HOST||((process.env.NODE_ENV==='production'||process.env.PORT)?'0.0.0.0':'127.0.0.1');
const config=liveConfig();
const auth=createAuthService();
const store=await createWorkspaceStore();

function send(res,status,value) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(value));
}
async function readJSON(req,maxBytes=180_000) {
  let raw='';
  for await(const chunk of req){raw+=chunk.toString();if(raw.length>maxBytes)throw new Error('Request is too large.');}
  try{return JSON.parse(raw||'{}');}catch{throw new Error('Invalid JSON request');}
}
function demoAnalysis(email){return {...analyzeEmail(email),aiSource:'demo'};}
function demoDraft(email){return {draft:draftReply(email),draftSource:'demo'};}
const limits=new Map();
function allowRequest(req) {
  const address=req.socket.remoteAddress||'local';
  const now=Date.now();
  const item=limits.get(address);
  if(!item||now-item.since>60000){limits.set(address,{since:now,count:1});return true;}
  item.count++;
  return item.count<=50;
}

const workspaceRoute=createWorkspaceAPI({auth,store,send,readJSON});
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url||'/', 'http://localhost').pathname;
  if(await auth.route(req,res,pathname,send,readJSON))return;
  if(await workspaceRoute(req,res,pathname))return;
  if(req.method==='GET'&&pathname==='/api/health')
    return send(res,200,{status:'online',aiMode:config?'live':'demo',provider:config?.provider||null,model:config?.model||null});
  if(await serveBuiltFrontend(req,res,pathname))return;
  if(req.method!=='POST'||!['/api/analyze','/api/draft','/api/ask'].includes(pathname))
    return send(res,404,{error:'Not found'});
  // Do not expose paid/free API quota to unauthenticated visitors.
  const requester=await auth.getSession(auth.tokenFromRequest(req));
  if(!requester)return send(res,401,{error:'Sign in to use Relay AI.'});
  if(req.headers['x-relay-request']!=='1')return send(res,403,{error:'Invalid request origin.'});
  if(!allowRequest(req))return send(res,429,{error:'Please slow down and retry in a minute.'});
  let data;
  try{data=await readJSON(req);}catch(error){return send(res,400,{error:error.message});}
  try {
    if(pathname==='/api/ask') {
      const question=String(data.question||'').trim().slice(0,240);
      const emails=Array.isArray(data.emails)?data.emails:[];
      if(!question||emails.length>50)return send(res,400,{error:'Question or inbox input invalid'});
      if(!config)return send(res,200,{answer:answerInboxQuestion(question,emails,data.selectedId),mode:'demo'});
      try{return send(res,200,{answer:await groqAsk(question,emails,data.selectedId),mode:'live'});}
      catch(error){console.warn('[Relay AI] Inbox answer fallback:',error.message);
        return send(res,200,{answer:answerInboxQuestion(question,emails,data.selectedId),mode:'demo',fallback:true});}
    }
    const email=data.email;
    if(!safeThread(email))return send(res,400,{error:'A conversation with messages is required.'});
    if(pathname==='/api/draft') {
      if(!config)return send(res,200,{result:demoDraft(email),mode:'demo'});
      try{return send(res,200,{result:await groqDraft(email),mode:'live'});}
      catch(error){console.warn('[Relay AI] Reply draft fallback:',error.message);
        return send(res,200,{result:demoDraft(email),mode:'demo',fallback:true});}
    }
    if(!config)return send(res,200,{analysis:demoAnalysis(email),mode:'demo'});
    try{return send(res,200,{analysis:await groqClassify(email),mode:'live'});}
    catch(error){console.warn('[Relay AI] Classifier fallback:',error.message);
      return send(res,200,{analysis:demoAnalysis(email),mode:'demo',fallback:true});}
  }catch(error){return send(res,400,{error:error.message||'Invalid request'});}
});
await auth.ready; // Refuse to start if the authentication store cannot be loaded.
server.listen(port,host,()=>{
  console.log(`Relay AI API http://${host}:${server.address().port} (${config?`GroqCloud ${config.model} · demo fallback`:'demo fallback'}; workspace: ${store.mode})`);
});
