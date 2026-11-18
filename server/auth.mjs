import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, mkdir, writeFile, rename, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(scryptCb);
const COOKIE = 'relay_sid';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const providers = new Set(['Gmail','Outlook','Demo Workspace']);
const defaultFile = fileURLToPath(new URL('./data/auth.json', import.meta.url));
const cleanEmail = value => String(value || '').trim().toLowerCase();
const validEmail = email => email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hashToken = token => createHash('sha256').update(token).digest('hex');
const publicUser = user => user && ({id:user.id,email:user.email,name:user.name,role:user.role,workspaceId:user.workspaceId||null,connection:user.connection||null,createdAt:user.createdAt});
const fail = (status,message) => Object.assign(new Error(message),{status});

function readCookie(header) {
  const part=String(header||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${COOKIE}=`));
  return part?.slice(COOKIE.length+1)||null;
}
function setCookie(res,token,{secure=false,clear=false}={}) {
  const items=[`${COOKIE}=${clear?'':token}`,'Path=/','HttpOnly','SameSite=Strict',`Max-Age=${clear?0:Math.floor(MAX_AGE/1000)}`];
  if(secure)items.push('Secure');
  res.setHeader('Set-Cookie',items.join('; '));
}

export function createAuthService({file=defaultFile,now=()=>Date.now(),secure=process.env.NODE_ENV==='production',mongoUri=process.env.MONGODB_URI,dbName=process.env.MONGODB_DB||'relay'}={}) {
  let state={users:[],sessions:[],invites:[]};
  let writeQueue=Promise.resolve();
  const attempts=new Map();
  let ready;
  let mongoCollection=null;

  const init=async()=>{
    try {
      let raw;
      if (mongoUri) {
        let MongoClient;
        try {({MongoClient}=await import('mongodb'));}
        catch {throw new Error('MONGODB_URI is set but mongodb is missing. Run npm install mongodb.');}
        const client=new MongoClient(mongoUri,{serverSelectionTimeoutMS:10000,maxPoolSize:5});
        await client.connect();
        mongoCollection=client.db(dbName).collection('auth_state');
        raw=await mongoCollection.findOne({_id:'main'});
        if(!raw){raw={users:[],sessions:[],invites:[]};await mongoCollection.insertOne({_id:'main',...raw});}
      } else raw=JSON.parse(await readFile(file,'utf8'));
      if(!Array.isArray(raw.users)||!Array.isArray(raw.sessions))throw new Error('Invalid auth store');
      state=raw;
      state.invites=Array.isArray(state.invites)?state.invites:[];
      // Migration: existing assistant accounts get their own isolated workspace.
      let migrated=false;
      for(const user of state.users){if(user.role==='assistant'&&!user.workspaceId){user.workspaceId=randomBytes(16).toString('hex');migrated=true;}}
      if(migrated)await save();
    } catch(error) {
      if(error.code!=='ENOENT') throw error;
      await mkdir(path.dirname(file),{recursive:true,mode:0o700});
      await save();
    }
  };
  function save() {
    const snapshot=JSON.stringify(state,null,2);
    const doWrite=async()=>{
      if (mongoCollection) {
        const {users,sessions,invites}=JSON.parse(snapshot);
        await mongoCollection.updateOne({_id:'main'},{$set:{users,sessions,invites}},{upsert:true});
        return;
      }
      await mkdir(path.dirname(file),{recursive:true,mode:0o700});
      const temp=`${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
      await writeFile(temp,snapshot,{encoding:'utf8',mode:0o600});
      await rename(temp,file);
      await chmod(file,0o600);
    };
    const task=writeQueue.then(doWrite);
    writeQueue=task.catch(()=>{});
    return task;
  }
  ready=init();
  const ensureReady=()=>ready;

  function throttle(ip) {
    const key=String(ip||'unknown');
    const t=now();
    const item=attempts.get(key);
    if(!item||t-item.start>10*60*1000) {attempts.set(key,{start:t,count:1});return;}
    item.count++;
    if(item.count>12)throw fail(429,'Too many attempts. Try again later.');
  }
  async function digest(password,salt){return scrypt(password,Buffer.from(salt,'hex'),64);}
  function expireSessions() {state.sessions=state.sessions.filter(s=>s.expires>now());}
  function userForToken(token) {
    if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
    const record=state.sessions.find(s=>s.hash===hashToken(token)&&s.expires>now());
    return record&&state.users.find(u=>u.id===record.userId)||null;
  }
  // A legacy assistant account may have been saved before workspace IDs existed.
  // Repair it on authenticated access instead of trapping the user in onboarding.
  async function ensureAssistantWorkspace(user) {
    if (user?.role === 'assistant' && (typeof user.workspaceId !== 'string' || !user.workspaceId.trim())) {
      user.workspaceId = randomBytes(16).toString('hex');
      await save();
    }
    return user;
  }
  async function establish(user) {
    await ensureAssistantWorkspace(user);
    expireSessions();
    const token=randomBytes(32).toString('base64url');
    state.sessions.push({hash:hashToken(token),userId:user.id,expires:now()+MAX_AGE});
    await save();
    return {user:publicUser(user),token};
  }
  async function signup({name,email,password,role}={}) {
    await ensureReady();
    const cleanedEmail=cleanEmail(email);
    const cleanedName=String(name||'').trim();
    if(!validEmail(cleanedEmail))throw fail(400,'Enter a valid email address.');
    if(cleanedName.length<2||cleanedName.length>80)throw fail(400,'Name must be 2–80 characters.');
    if(!['assistant','client'].includes(role))throw fail(400,'Choose an assistant or client role.');
    if(typeof password!=='string'||password.length<10||password.length>128)throw fail(400,'Password must be 10–128 characters.');
    if(state.users.some(u=>u.email===cleanedEmail))throw fail(409,'An account with that email already exists.');
    const salt=randomBytes(16).toString('hex');
    const passwordHash=(await digest(password,salt)).toString('hex');
    // Another signup may have completed while scrypt was running.
    if(state.users.some(u=>u.email===cleanedEmail))throw fail(409,'An account with that email already exists.');
    const user={id:randomBytes(16).toString('hex'),name:cleanedName,email:cleanedEmail,role,workspaceId:role==='assistant'?randomBytes(16).toString('hex'):null,salt,passwordHash,connection:null,createdAt:new Date(now()).toISOString()};
    state.users.push(user);
    return establish(user);
  }
  async function login({email,password}={}) {
    await ensureReady();
    const user=state.users.find(u=>u.email===cleanEmail(email));
    // Scrypt even for unknown accounts to limit account enumeration/timing clues.
    const salt=user?.salt||'00000000000000000000000000000000';
    const computed=await digest(typeof password==='string'?password:'',salt);
    const saved=user?Buffer.from(user.passwordHash,'hex'):Buffer.alloc(64);
    if(!user||saved.length!==computed.length||!timingSafeEqual(saved,computed))throw fail(401,'Incorrect email or password.');
    return establish(user);
  }
  async function getSession(token) {await ensureReady();return publicUser(await ensureAssistantWorkspace(userForToken(token)));}
  async function logout(token) {
    await ensureReady();
    const hash=hashToken(token||'');
    state.sessions=state.sessions.filter(s=>s.hash!==hash);
    await save();
  }
  async function setConnection(token,provider) {
    await ensureReady();
    const user=userForToken(token);
    if(!user)throw fail(401,'Sign in first.');
    if(user.role!=='assistant')throw fail(403,'Only assistants can connect a sample mailbox.');
    await ensureAssistantWorkspace(user);
    if(!providers.has(provider))throw fail(400,'Unknown provider.');
    const time=new Date(now()).toISOString();
    user.connection={provider,address:'maya@northstar.demo',simulated:true,status:'connected',connectedAt:time,lastSyncedAt:time};
    await save();
    return publicUser(user);
  }
  async function disconnect(token) {
    await ensureReady();
    const user=userForToken(token);
    if(!user)throw fail(401,'Sign in first.');
    user.connection=null;
    await save();
    return publicUser(user);
  }

  async function createInvite(token) {
    await ensureReady();
    const user=userForToken(token);
    if(!user)throw fail(401,'Sign in first.');
    if(user.role!=='assistant'||!user.workspaceId)throw fail(403,'Only the workspace assistant can invite a client.');
    const code=randomBytes(24).toString('base64url');
    const expires=now()+24*60*60*1000;
    state.invites=state.invites.filter(i=>i.expires>now() && !i.usedAt);
    state.invites.push({hash:hashToken(code),workspaceId:user.workspaceId,expires,createdBy:user.id});
    await save();
    return {code,expiresAt:new Date(expires).toISOString()};
  }
  // A client who has not joined anyone's workspace can explicitly choose
  // the assistant experience instead. Linked clients must never be promoted
  // because that would change permissions inside an existing workspace.
  async function switchToAssistant(token) {
    await ensureReady();
    const user=userForToken(token);
    if(!user)throw fail(401,'Sign in first.');
    if(user.role!=='client'||user.workspaceId)
      throw fail(409,'Only an unlinked client account can switch to the assistant role.');
    user.role='assistant';
    user.workspaceId=randomBytes(16).toString('hex');
    user.connection=null;
    await save();
    return publicUser(user);
  }

  async function joinWorkspace(token,code) {
    await ensureReady();
    const user=userForToken(token);
    if(!user)throw fail(401,'Sign in first.');
    if(user.role!=='client')throw fail(403,'Only client accounts may join an invited workspace.');
    if(user.workspaceId)throw fail(409,'This client is already linked to a workspace.');
    if(typeof code!=='string'||!(/^[A-Za-z0-9_-]{32}$/.test(code)))throw fail(400,'Enter a valid invitation code.');
    const invitation=state.invites.find(i=>i.hash===hashToken(code)&&i.expires>now()&&!i.usedAt);
    if(!invitation)throw fail(400,'Invitation invalid, expired, or already used.');
    if(state.users.some(u=>u.role==='client'&&u.workspaceId===invitation.workspaceId))throw fail(409,'This sample workspace already has a linked client.');
    user.workspaceId=invitation.workspaceId;
    invitation.usedAt=now();
    await save();
    return publicUser(user);
  }

  function tokenFromRequest(req){return readCookie(req.headers.cookie);}
  function requireMutation(req) {
    // Custom header prevents cross-origin form submissions; no permissive CORS is configured.
    if(req.headers['x-relay-request']!=='1')throw fail(403,'Invalid request origin.');
  }
  async function route(req,res,pathname,send,readJSON) {
    if(!pathname.startsWith('/api/auth/'))return false;
    try {
      await ensureReady();
      if(req.method==='GET'&&pathname==='/api/auth/me') {
        send(res,200,{user:await getSession(tokenFromRequest(req))});return true;
      }
      if(req.method!=='POST') {send(res,405,{error:'Method not allowed'});return true;}
      requireMutation(req);
      if(['/api/auth/signup','/api/auth/login'].includes(pathname)) {
        throttle(req.socket.remoteAddress);
        const data=await readJSON(req,16_000);
        const result=pathname.endsWith('signup')?await signup(data):await login(data);
        setCookie(res,result.token,{secure});send(res,200,{user:result.user});return true;
      }
      if(pathname==='/api/auth/logout') {
        await logout(tokenFromRequest(req));
        setCookie(res,'',{secure,clear:true});send(res,200,{ok:true});return true;
      }
      if(pathname==='/api/auth/ensure-assistant-workspace') {
        const user=userForToken(tokenFromRequest(req));
        if(!user)throw fail(401,'Sign in first.');
        if(user.role!=='assistant')throw fail(403,'Only assistant accounts can repair their own workspace.');
        await ensureAssistantWorkspace(user);
        send(res,200,{user:publicUser(user)});return true;
      }
      if(pathname==='/api/auth/switch-to-assistant') {
        const user=await switchToAssistant(tokenFromRequest(req));
        send(res,200,{user});return true;
      }
      if(pathname==='/api/auth/connect'||pathname==='/api/auth/disconnect') {
        const token=tokenFromRequest(req);
        const user=pathname.endsWith('disconnect')?await disconnect(token):await setConnection(token,(await readJSON(req,16_000)).provider);
        send(res,200,{user});return true;
      }
      send(res,404,{error:'Not found'});return true;
    } catch(error) {send(res,error.status||500,{error:error.status?error.message:'Could not complete authentication request.'});return true;}
  }
  return {ready,signup,login,getSession,logout,setConnection,disconnect,switchToAssistant,createInvite,joinWorkspace,route,tokenFromRequest};
}
