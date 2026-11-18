import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { serveBuiltFrontend } from '../server/staticAssets.mjs';

test('production static handler serves built app and protects API paths/assets',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'relay-static-'));
  await mkdir(path.join(root,'assets'));
  await writeFile(path.join(root,'index.html'),'<h1>Relay</h1>');
  await writeFile(path.join(root,'assets','app.js'),'export const ready = true;');
  const server=http.createServer(async(req,res)=>{
    const routed=await serveBuiltFrontend(req,res,new URL(req.url,'http://localhost').pathname,{root});
    if(!routed){res.writeHead(418);res.end('API unaffected');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const origin=`http://127.0.0.1:${server.address().port}`;
    const homepage=await fetch(origin);assert.equal(homepage.status,200);
    assert.match(await homepage.text(),/Relay/);
    const route=await fetch(origin+'/mailbox/anything');assert.equal(route.status,200);
    const js=await fetch(origin+'/assets/app.js');assert.equal(js.status,200);
    assert.match(js.headers.get('content-type'),/javascript/);
    const missing=await fetch(origin+'/assets/no.js');assert.equal(missing.status,404);
    const api=await fetch(origin+'/api/health');assert.equal(api.status,418);
    const secret=await fetch(origin+'/.env');assert.equal(secret.status,404);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
