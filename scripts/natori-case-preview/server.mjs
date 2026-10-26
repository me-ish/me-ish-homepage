import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]??'/tmp/natori-case-preview');
const port=Number(process.argv[3]??4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Local port required');
const data=JSON.parse(readFileSync(resolve(root,'fixtures.bundle.json'),'utf8'));
const assets=new Map(['/','/index.html','/app.js','/styles.css'].map(path=>[path,readFileSync(resolve(root,path==='/'?'index.html':path.slice(1)))]));
const server=createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const url=new URL(req.url??'/',`http://127.0.0.1:${port}`);
  if(url.pathname==='/fixtures.json'){
    const mode=url.searchParams.get('mode');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(mode==='failed'){res.writeHead(503);res.end(JSON.stringify({error:'synthetic_read_failed'}));return;}
    res.end(JSON.stringify(mode==='partial'?data.partial:data.normal));return;
  }
  const asset=assets.get(url.pathname);
  if(!asset){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
  res.end(req.method==='HEAD'?undefined:asset);
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Synthetic case preview: http://127.0.0.1:${port}\n`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
