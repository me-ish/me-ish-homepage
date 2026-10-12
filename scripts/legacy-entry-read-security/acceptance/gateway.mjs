import http from 'node:http';
import { config } from './common.mjs';
const upstreams = { auth: config.authOrigin, rest: config.restOrigin };
for (const origin of Object.values(upstreams)) {
  const u = new URL(origin);
  if (u.protocol !== 'http:' || !/^172\.[0-9]+\.[0-9]+\.[0-9]+$/.test(u.hostname)) throw new Error('Dedicated Docker bridge origin required');
}
http.createServer((req, res) => {
  const path = req.url;
  let target, rewritten;
  const headers = { ...req.headers };
  if (path.startsWith('/auth/v1/')) { target=upstreams.auth; rewritten=path.slice(8); }
  else if (path.startsWith('/rest/v1/')) { target=upstreams.rest; rewritten=path.slice(8); }
  else if (path.startsWith('/graphql/v1')) {
    target=upstreams.rest; rewritten='/rpc/graphql';
    headers['content-profile']='graphql_public'; headers['accept-profile']='graphql_public';
  } else { res.writeHead(404); return res.end(); }
  // Set the path on a fixed origin; an absolute or // path cannot redirect upstream.
  const u=new URL(target);
  const index=rewritten.indexOf('?');
  u.pathname=index<0?rewritten:rewritten.slice(0,index);
  u.search=index<0?'':rewritten.slice(index);
  const outgoing=http.request(u,{method:req.method,headers},response=>{
    res.writeHead(response.statusCode,response.headers);response.pipe(res);
  });
  outgoing.on('error',()=>{res.writeHead(502);res.end('isolated upstream unavailable');});
  req.pipe(outgoing);
}).listen(new URL(config.api).port,'127.0.0.1',()=>console.log('Isolated gateway ready'));
