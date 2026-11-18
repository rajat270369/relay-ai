import 'dotenv/config';
import express from 'express';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleEmails, createIncomingEmail } from '../src/data/sampleEmails.js';
import { classify, createDraft, aiMode } from './ai.js';

const app = express();
const here = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.DATA_FILE || join(here, 'data', 'emails.json');
const PORT = Number(process.env.PORT || 3001);
app.disable('x-powered-by');
app.use(express.json({ limit:'64kb' }));

// Demo-only file storage: no real accounts, authentication or shared-client isolation.
async function readEmails() {
  try {
    const value = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    if (!Array.isArray(value)) throw new Error('Unexpected email data');
    return value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await saveEmails(sampleEmails);
    return structuredClone(sampleEmails);
  }
}
async function saveEmails(emails) {
  await mkdir(dirname(DATA_FILE), { recursive:true });
  const tmp = DATA_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify(emails, null, 2), 'utf8');
  await rename(tmp, DATA_FILE);
}
// Serialize writes, avoiding lost changes when requests arrive together.
let writeQueue = Promise.resolve();
function mutate(operation) {
  const work = writeQueue.then(async () => {
    const emails = await readEmails();
    const result = await operation(emails);
    await saveEmails(emails);
    return result;
  });
  writeQueue = work.catch(()=>{});
  return work;
}
function getEmail(emails, id) {
  const email = emails.find(item=>item.id===id);
  if (!email) {const e = new Error('Conversation not found');e.status=404;throw e;}
  return email;
}
function replaceEmail(emails, value) {
  const index = emails.findIndex(item=>item.id===value.id);
  emails[index] = value;
  return value;
}
const UPDATABLE = new Set(['group','reason','confidence','override','importance','unread','waiting','archived','completed','draft']);
const GROUPS = new Set(['assistant','client','none','review']);

app.get('/api/health', (req,res)=>res.json({ok:true, aiMode:aiMode(), storage:'demo-file'}));
app.get('/api/emails', async (req,res,next)=>{try {res.json({emails:await readEmails()});}catch(e){next(e);}});
app.patch('/api/emails/:id',async (req,res,next)=>{
  try {
    const patch = req.body || {};
    const keys=Object.keys(patch);
    if (keys.length===0 || keys.some(k=>!UPDATABLE.has(k)) || (patch.group!==undefined && !GROUPS.has(patch.group))) {
      return res.status(400).json({error:'Invalid update fields'});
    }
    const booleanFields = ['override','importance','unread','waiting','archived','completed'];
    if (booleanFields.some(k=> k in patch && typeof patch[k]!=='boolean')) return res.status(400).json({error:'Invalid field types'});
    if (['reason','draft'].some(k=>k in patch && (typeof patch[k]!=='string'||patch[k].length>8000))) return res.status(400).json({error:'Invalid field types'});
    if ('confidence' in patch && (!Number.isFinite(patch.confidence)||patch.confidence<0||patch.confidence>100)) return res.status(400).json({error:'Invalid confidence'});
    const email = await mutate(async emails=>{
      const e=getEmail(emails,req.params.id);
      return replaceEmail(emails,{...e,...Object.fromEntries(keys.map(k=>[k,patch[k]]))});
    });
    res.json({email});
  }catch(e){next(e);}
});
app.post('/api/emails/:id/analyze',async (req,res,next)=>{
  try {
    const email=await mutate(async emails=>{
      const e=getEmail(emails,req.params.id);
      return replaceEmail(emails,{...e,...await classify(e),override:false});
    });
    res.json({email});
  }catch(e){next(e);}
});
app.post('/api/emails/:id/draft',async (req,res,next)=>{
  try {
    const email=await mutate(async emails=>{
      const e=getEmail(emails,req.params.id);
      return replaceEmail(emails,{...e,...await createDraft(e)});
    });
    res.json({email});
  }catch(e){next(e);}
});
app.post('/api/emails/:id/follow-up',async (req,res,next)=>{
  try {
    const email=await mutate(async emails=>{
      const e=getEmail(emails,req.params.id);
      const sample=e.group==='assistant'
        ? 'Hi Alex, a new development: I now need your personal approval on the final terms before we proceed. Please confirm your decision.'
        : e.group==='client'
          ? 'Hi Maya, thanks for reviewing. Could you schedule a short meeting next week to discuss the next steps? Please coordinate available times.'
          : 'Hi Maya, could you schedule a quick appointment next Tuesday morning and confirm calendar availability?';
      const updated={...e,messages:[...e.messages,{id:`follow-up-${Date.now()}`,role:'external',author:e.name,body:sample,time:new Date().toISOString()}],unread:true,completed:false,waiting:false};
      return replaceEmail(emails,{...updated,...await classify(updated),override:false});
    });
    res.json({email});
  }catch(e){next(e);}
});
app.post('/api/emails/incoming',async (req,res,next)=>{
  try {
    const email=await mutate(async emails=>{
      const incoming=createIncomingEmail(emails.filter(e=>e.id.startsWith('new-')).length);
      const updated={...incoming,...await classify(incoming)};
      emails.unshift(updated);
      return updated;
    });
    res.status(201).json({email});
  }catch(e){next(e);}
});
app.post('/api/emails/reset',async (req,res,next)=>{
  try {const emails=await mutate(async current=>{current.splice(0,current.length,...structuredClone(sampleEmails));return current;});res.json({emails});}catch(e){next(e);}
});
app.use('/api', (req,res)=>res.status(404).json({error:'API route not found'}));

// In production, Express serves the Vite build and API from the same Render web service.
if (process.env.NODE_ENV === 'production') {
  const dist=resolve(here,'../dist');
  app.use(express.static(dist));
  app.get('*',(req,res)=>res.sendFile(join(dist,'index.html')));
}
app.use((error,req,res,next)=>{
  console.error('[Server]',error.message);
  res.status(error.status||500).json({error:error.status===404?error.message:'Request failed; try again.'});
});
app.listen(PORT, '0.0.0.0',()=>console.log(`Relay API running on http://localhost:${PORT} (${aiMode()} AI)`));
