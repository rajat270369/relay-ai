/** Serve Vite's compiled frontend from the same origin as the API.
 * This makes a single Render Web Service sufficient for the internship demo.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff',
  '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8',
  '.map':'application/json; charset=utf-8',
};

export async function serveBuiltFrontend(req,res,pathname,{root=dist}={}) {
  if (!['GET','HEAD'].includes(req.method)||pathname.startsWith('/api/')) return false;
  let safePath;
  try {safePath = decodeURIComponent(pathname);}
  catch {res.writeHead(400);res.end('Invalid URL');return true;}
  // Never serve dotfiles, server sources, .env, or files outside dist.
  if (safePath.split('/').includes('..')||safePath.split('/').some(segment=>segment.startsWith('.'))){
    res.writeHead(404);res.end('Not found');return true;
  }
  const base = resolve(root);
  const requested = resolve(base,'.'+(safePath.startsWith('/')?safePath:'/'+safePath));
  if(requested!==base&&!requested.startsWith(base+sep)) {res.writeHead(404);res.end('Not found');return true;}
  let asset = requested;
  let metadata;
  try {metadata=await stat(asset);}catch{metadata=null;}
  if(!metadata?.isFile()){
    // SPA fallback for normal routes, never return HTML in place of a missing asset.
    if(extname(safePath)||safePath.startsWith('/assets/')) {res.writeHead(404);res.end('Not found');return true;}
    asset=resolve(base,'index.html');
  }
  let bytes;
  try {bytes=await readFile(asset);}catch(error){
    res.writeHead(error.code==='ENOENT'?503:500,{'Content-Type':'text/plain; charset=utf-8'});
    res.end(error.code==='ENOENT'?'Frontend not built. Run npm run build.':'Frontend unavailable.');return true;
  }
  res.writeHead(200,{
    'Content-Type':mime[extname(asset)]||'application/octet-stream',
    'Content-Length':bytes.length,
    'Cache-Control':asset.endsWith('index.html')?'no-cache':'public, max-age=3600',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin',
  });
  res.end(req.method==='HEAD'?undefined:bytes);
  return true;
}
