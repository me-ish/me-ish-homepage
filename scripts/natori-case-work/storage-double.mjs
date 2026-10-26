// Test-only HTTP Storage boundary, in-memory synthetic bytes. Not Supabase Storage acceptance.
import {randomUUID,createHash} from 'node:crypto';
export function storageDouble(){
 const objects=new Map(),uploads=new Map(),downloads=new Map(),resumable=new Map();
 const body=async req=>{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>2*1024*1024)throw Error('synthetic fixture size exceeded');chunks.push(c);}return Buffer.concat(chunks);};
 const token=key=>'synthetic.'+Buffer.from(JSON.stringify({url:key,upsert:false,exp:Math.floor(Date.now()/1000)+7200})).toString('base64url')+'.local-only';
 const metadata=o=>({name:o.path.split('/').at(-1),id:o.id,updated_at:o.at,created_at:o.at,metadata:{size:o.bytes.length,mimetype:o.type,eTag:o.etag}});
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost:4193'),path=decodeURIComponent(url.pathname.slice('/storage/v1'.length));
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  try{
   res.setHeader('Access-Control-Expose-Headers','Location,Upload-Offset,Upload-Length,Tus-Resumable');
   if(path.startsWith('/upload/resumable')){
    const signature=req.headers['x-signature'],signed=uploads.get(signature);if(!signed)return json(403,{message:'synthetic upload signature required'});
    const save=o=>{if(o.bytes.length===o.length)objects.set(o.key,{id:randomUUID(),path:o.key,bytes:o.bytes,type:o.type,at:new Date().toISOString(),etag:createHash('sha256').update(o.bytes).digest('hex')});};
    if(req.method==='POST'&&['/upload/resumable','/upload/resumable/sign'].includes(path)){
     const meta=Object.fromEntries((req.headers['upload-metadata']??'').split(',').map(s=>{const[k,v]=s.trim().split(' ');return[k,Buffer.from(v??'','base64').toString()];}));
     if(signed!==meta.bucketName+'/'+meta.objectName||objects.has(signed))return json(409,{message:'synthetic upload conflict'});
     const id=randomUUID(),o={key:signed,type:meta.contentType,length:Number(req.headers['upload-length']),bytes:await body(req)};resumable.set(id,o);save(o);
     res.writeHead(201,{Location:'http://localhost:4193/storage/v1/upload/resumable/'+id,'Upload-Offset':o.bytes.length,'Tus-Resumable':'1.0.0'});return res.end();
    }
    const o=resumable.get(path.split('/').at(-1));if(!o||o.key!==signed)return json(404,{message:'synthetic upload absent'});
    if(req.method==='HEAD'){res.writeHead(200,{'Upload-Offset':o.bytes.length,'Upload-Length':o.length,'Tus-Resumable':'1.0.0'});return res.end();}
    if(req.method==='PATCH'){if(Number(req.headers['upload-offset'])!==o.bytes.length)return json(409,{message:'offset conflict'});o.bytes=Buffer.concat([o.bytes,await body(req)]);save(o);res.writeHead(204,{'Upload-Offset':o.bytes.length,'Tus-Resumable':'1.0.0'});return res.end();}
    return json(405,{message:'synthetic TUS method disabled'});
   }
   if(req.method==='POST'&&path.startsWith('/object/upload/sign/')){const key=path.slice('/object/upload/sign/'.length),t=token(key);uploads.set(t,key);return json(200,{url:`/object/upload/sign/${key}?token=${t}`,token:t});}
   if(req.method==='PUT'&&path.startsWith('/object/upload/sign/')){
    const key=path.slice('/object/upload/sign/'.length);if(uploads.get(url.searchParams.get('token'))!==key||objects.has(key))return json(409,{statusCode:'409',message:'signed synthetic upload denied'});
    const raw=await body(req),boundary=req.headers['content-type']?.match(/boundary=(.+)$/)?.[1];let bytes=raw,type=req.headers['content-type'];
    if(boundary){const part=raw.toString('latin1').split('--'+boundary).find(p=>/filename=/.test(p));if(!part)return json(400,{message:'missing file'});const i=part.indexOf('\r\n\r\n');bytes=Buffer.from(part.slice(i+4,-2),'latin1');type=part.match(/content-type: ([^\r\n]+)/i)?.[1];}
    objects.set(key,{id:randomUUID(),path:key,bytes,type,at:new Date().toISOString(),etag:createHash('sha256').update(bytes).digest('hex')});return json(200,{Key:key});
   }
   if(req.method==='POST'&&path.startsWith('/object/list/')){const bucket=path.slice('/object/list/'.length),input=JSON.parse((await body(req)).toString());return json(200,[...objects.entries()].filter(([key,o])=>key.startsWith(bucket+'/'+input.prefix+'/')&&(!input.search||o.path.split('/').at(-1).includes(input.search))).map(([,o])=>metadata(o)));}
   if(req.method==='DELETE'&&/^\/object\/[^/]+$/.test(path)){const bucket=path.slice('/object/'.length),input=JSON.parse((await body(req)).toString());return json(200,(input.prefixes??[]).map(p=>{const key=bucket+'/'+p,o=objects.get(key);objects.delete(key);return {name:p,id:o?.id??randomUUID()};}));}
   if(req.method==='POST'&&path.startsWith('/object/sign/')){const key=path.slice('/object/sign/'.length);if(!objects.has(key))return json(404,{statusCode:'404',message:'not found'});const t=randomUUID();downloads.set(t,key);return json(200,{signedURL:`/object/sign/${key}?token=${t}`});}
   if(req.method==='GET'&&path.startsWith('/object/info/')){const key=path.slice('/object/info/'.length).replace(/^authenticated\//,''),o=objects.get(key);return o?json(200,{id:o.id,name:o.path,size:o.bytes.length,content_type:o.type,updated_at:o.at}):json(404,{statusCode:'404',message:'not found'});}
   if(req.method==='GET'&&path.startsWith('/object/')){const signed=path.startsWith('/object/sign/'),key=path.slice(signed?'/object/sign/'.length:path.startsWith('/object/authenticated/')?'/object/authenticated/'.length:'/object/'.length),o=objects.get(key);if(!o||signed&&downloads.get(url.searchParams.get('token'))!==key)return json(404,{statusCode:'404',message:'not found'});if(req.headers.range){res.writeHead(206,{'Content-Type':o.type,'Content-Range':`bytes 0-0/${o.bytes.length}`,'Content-Length':1});return res.end(o.bytes.subarray(0,1));}res.writeHead(200,{'Content-Type':o.type,'Content-Length':o.bytes.length});return res.end(o.bytes);}
   return json(405,{message:'Storage operation not in synthetic fixture'});
  }catch{return json(500,{message:'synthetic Storage boundary failed'});}
 };
}
