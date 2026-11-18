/** Workspace data is owned by the server, never by browser localStorage.
 * Local JSON persistence works immediately for a single Node process.
 * Set MONGODB_URI to use MongoDB Atlas for durable deployment storage.
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleEmails } from '../src/data/sampleEmails.js';

const defaultFile=fileURLToPath(new URL('./data/workspaces.json', import.meta.url));
const clone = value => structuredClone(value);
const seed = id => ({_id:id,revision:1,updatedAt:new Date().toISOString(),emails:clone(sampleEmails).map(e=>({...e,_rev:1}))});
export class WorkspaceConflict extends Error {constructor(message='Conversation was changed elsewhere; reload to see the latest version.'){super(message);this.status=409;}}

export async function createWorkspaceStore({file=defaultFile,mongoUri=process.env.MONGODB_URI,dbName=process.env.MONGODB_DB||'relay'}={}){
  if(mongoUri){
    let MongoClient;
    try {({MongoClient}=await import('mongodb'));}
    catch {throw new Error('MONGODB_URI is set but the mongodb package is missing. Run npm install mongodb.');}
    const client=new MongoClient(mongoUri,{serverSelectionTimeoutMS:10000,maxPoolSize:5});
    await client.connect();
    const collection=client.db(dbName).collection('workspaces');
    return {
      mode:'mongodb',
      async get(id){
        await collection.updateOne({_id:id},{$setOnInsert:(()=>{const {_id,...record}=seed(id);return record;})()},{upsert:true});
        return clone(await collection.findOne({_id:id}));
      },
      async mutate(id,fn){
        for(let tries=0;tries<5;tries++){
          const current=await this.get(id);
          const next=fn(clone(current));
          next._id=id;next.revision=current.revision+1;next.updatedAt=new Date().toISOString();
          const r=await collection.replaceOne({_id:id,revision:current.revision},next);
          if(r.modifiedCount===1)return clone(next);
        }
        throw new WorkspaceConflict('The workspace changed at the same time; try again.');
      },
      close:()=>client.close(),
    };
  }
  let state={};
  try {state=JSON.parse(await readFile(file,'utf8'));if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('Invalid workspace store');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  let queue=Promise.resolve();
  async function persist(){
    await mkdir(path.dirname(file),{recursive:true,mode:0o700});
    const temp=`${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temp,JSON.stringify(state,null,2),{mode:0o600});await rename(temp,file);
  }
  const serialized=fn=>{
    const task=queue.then(fn);
    queue=task.catch(()=>{});
    return task;
  };
  return {
    mode:'file',
    get:id=>serialized(async()=>{
      if(!state[id]){state[id]=seed(id);await persist();}
      return clone(state[id]);
    }),
    mutate:(id,fn)=>serialized(async()=>{
      if(!state[id])state[id]=seed(id);
      const next=fn(clone(state[id]));
      next._id=id;next.revision=state[id].revision+1;next.updatedAt=new Date().toISOString();
      state[id]=next;await persist();return clone(next);
    }),
    close:async()=>{},
  };
}
