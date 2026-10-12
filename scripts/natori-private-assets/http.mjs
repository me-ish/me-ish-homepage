import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {config,resultPath} from './common.mjs';
const admin=createClient(config.api,config.service,{auth:{persistSession:false,autoRefreshToken:false}}),results=[];
const record=name=>{results.push({name,status:'pass'});console.log('PASS '+name);};
const cookie=user=>'sb-127-auth-token=base64-'+Buffer.from(JSON.stringify(user.session)).toString('base64url');
const manager={Cookie:cookie(config.users[0]),'x-requested-with':'me-ish'},other={Cookie:cookie(config.users[1]),'x-requested-with':'me-ish'};
const api=async(path,init={})=>{
  let url=new URL(path,config.app);
  for(let n=0;n<5;n++){
    assert.equal(url.origin,config.app,'External application redirect refused');
    const r=await fetch(url,{...init,redirect:'manual'});
    if(![301,302,303,307,308].includes(r.status))return r;
    const next=new URL(r.headers.get('location'),url);
    console.log('Local redirect',r.status,url.pathname,next.pathname);
    assert.equal(next.origin,config.app,'External application redirect refused');url=next;
  }
  throw Error('Local application redirect loop');
},json=async(path,init={})=>{const r=await api(path,init);return {status:r.status,data:await r.json()};};
const clone=v=>JSON.parse(JSON.stringify(v));
const body=value=>({method:'PUT',headers:{...manager,'Content-Type':'application/json'},body:JSON.stringify(value)});
for(let i=0;i<180;i++){try{if((await api('/api/natori/portfolio/content')).ok)break;}catch{}if(i===179)throw Error('Next not ready');await new Promise(r=>setTimeout(r,500));}
for(const headers of [{},other])assert.equal((await api('/api/natori/admin/portfolio-content',{headers})).status,401);
record('anonymous and unrelated Auth user cannot load full editor content');
let state=await json('/api/natori/admin/portfolio-content',{headers:manager});assert.equal(state.status,200);
const base=JSON.parse(readFileSync(resultPath('content.json')));let saved=await json('/api/natori/portfolio/content',body({content:base,expectedRevision:state.data.revision}));assert.equal(saved.status,200);state=saved;
async function upload(projectId){const form=new FormData();form.set('file',new Blob([readFileSync(resultPath('image.webp'))],{type:'image/webp'}),'fixture.webp');if(projectId)form.set('projectId',projectId);return json(projectId?'/api/natori/admin/project-thumbs':'/api/natori/portfolio/upload',{method:'POST',headers:manager,body:form});}
const thumb=await upload(config.projects[0]);assert.equal(thumb.status,200);assert.ok(thumb.data.url.startsWith('/api/natori/admin/project-thumbs/'));
assert.equal((await api(thumb.data.url)).status,401);assert.equal((await api(thumb.data.url,{headers:other})).status,401);assert.equal((await api(thumb.data.url,{headers:manager})).status,200);
assert.equal((await upload(config.projects[1])).status,500);
record('private project thumbnails require manager authorization and target-owner scope');
const legacyURL=config.api+'/storage/v1/object/public/natori-portfolio/project-thumbs/'+config.projects[0]+'.webp';assert.equal((await fetch(legacyURL)).status,200);
record('legacy public thumbnail URL remains a qualified migration/CDN gate; gallery bucket preserved');
const uploaded=await upload();assert.equal(uploaded.status,200);const imageURL=uploaded.data.url;assert.ok(imageURL.startsWith('/api/natori/admin/portfolio-assets/'));
const publicURL=imageURL.replace('/admin/portfolio-assets/','/portfolio/assets/');
assert.equal((await api(imageURL)).status,401);assert.equal((await api(imageURL,{headers:manager})).status,200);assert.equal((await api(publicURL)).status,404);
const assetId=imageURL.split('/').at(-1).split('.')[0];const meta=await admin.from('natori_portfolio_assets').select('path').eq('id',assetId).single();assert.ok(!meta.error);
assert.notEqual((await fetch(config.api+'/storage/v1/object/public/natori-management-assets/'+meta.data.path)).status,200);
record('upload-before-save is private at both direct Storage and application URLs');
const privateWork={...base.works[0],id:'private-work',title:'PRIVATE_TITLE_CANARY',image:imageURL,published:false,relatedLinks:[{id:'private-link',kind:'usage',label:'PRIVATE_LINK_CANARY',href:'https://private.invalid/PRIVATE_LINK_CANARY'}]};
const content={...base,works:[...base.works,privateWork],heroImages:[imageURL,base.heroImage],heroImage:imageURL,aboutImage:imageURL,plans:base.plans.map((p,i)=>i===0?{...p,sampleWorkId:privateWork.id}:p),processVideo:{url:'https://youtu.be/abcdefghijk',caption:'PRIVATE_VIDEO_CANARY',published:false}};
saved=await json('/api/natori/portfolio/content',body({content,expectedRevision:state.data.revision}));assert.equal(saved.status,200);state=saved;
for(const path of ['/api/natori/portfolio/content','/ja/natori/portfolio','/ja/natori/works','/ja/natori/portfolio/contact']) {
  const r=await api(path),text=await r.text();assert.equal(r.status,200);assert.ok(!text.includes('PRIVATE_')&&!text.includes(assetId),path+' leaked private markers');
}
const rsc=await api('/ja/natori/portfolio?_rsc=sec01',{headers:{RSC:'1'}});assert.equal(rsc.status,200);assert.ok((rsc.headers.get('content-type')??'').includes('text/x-component'));const rscText=await rsc.text();assert.ok(!rscText.includes('PRIVATE_')&&!rscText.includes(assetId));
record('public API/HTML/RSC/contact/showcase omit private work, URL, links and video markers');
const editor=await json('/api/natori/admin/portfolio-content',{headers:manager});assert.ok(JSON.stringify(editor.data).includes('PRIVATE_TITLE_CANARY'));
assert.equal((await api(publicURL)).status,404);
content.works[1].published=true;content.heroImage=base.heroImage;content.heroImages=[base.heroImage];content.aboutImage=base.heroImage;
saved=await json('/api/natori/portfolio/content',body({content,expectedRevision:state.data.revision}));assert.equal(saved.status,200);state=saved;
let image=await api(publicURL);assert.equal(image.status,200);assert.ok(image.headers.get('cache-control').includes('no-store'));assert.ok(Buffer.from(await image.arrayBuffer()).equals(readFileSync(resultPath('image.webp'))));
assert.equal((await api('/_next/image?url='+encodeURIComponent(publicURL)+'&w=640&q=75')).status,400);
record('published new image is readable only through no-store origin; optimizer cache bypass blocked');
const versions=await Promise.all(['A','B'].map(label=>json('/api/natori/portfolio/content',body({content:{...content,artistName:'Concurrent '+label},expectedRevision:state.data.revision}))));assert.deepEqual(versions.map(v=>v.status).sort(),[200,409]);state=versions.find(v=>v.status===200);
record('two concurrent saves commit once; stale request receives conflict without overwriting');
const current=await json('/api/natori/admin/portfolio-content',{headers:manager});current.data.content.works[1].published=false;
saved=await json('/api/natori/portfolio/content',body({content:current.data.content,expectedRevision:current.data.revision}));assert.equal(saved.status,200);state=saved;assert.equal((await api(publicURL)).status,404);assert.equal((await api(imageURL,{headers:manager})).status,200);
record('publish-to-unpublish closes the new known URL while manager access remains');
const og=await api('/og/natori-portfolio.png');assert.equal(og.status,200);assert.ok(og.headers.get('cache-control').includes('no-store'));
assert.equal((await api('/_next/image?url='+encodeURIComponent('/og/natori-portfolio.png')+'&w=640&q=75')).status,400);
record('OG uses public projection and cannot be retained by the application optimizer');
const video=readFileSync(resultPath('video.mp4'));const prep=await json('/api/natori/portfolio/video-upload',{method:'POST',headers:{...manager,'Content-Type':'application/json'},body:JSON.stringify({sizeBytes:video.length,contentType:'video/mp4'})});assert.equal(prep.status,200);
assert.equal(prep.data.bucket,'natori-management-assets');const videoUpload=await admin.storage.from(prep.data.bucket).uploadToSignedUrl(prep.data.path,prep.data.token,video,{contentType:'video/mp4',cacheControl:'0'});assert.ok(!videoUpload.error);
let latest=await json('/api/natori/admin/portfolio-content',{headers:manager});const unfinished={...latest.data.content,processVideo:{url:prep.data.url,published:true}};
assert.equal((await json('/api/natori/portfolio/content',body({content:unfinished,expectedRevision:latest.data.revision}))).status,400);
const finalized=await json('/api/natori/portfolio/video-upload/finalize',{method:'POST',headers:{...manager,'Content-Type':'application/json'},body:JSON.stringify({assetId:prep.data.assetId})});assert.equal(finalized.status,200);
saved=await json('/api/natori/portfolio/content',body({content:unfinished,expectedRevision:latest.data.revision}));assert.equal(saved.status,200);state=saved;
const videoURL=prep.data.url.replace('/admin/portfolio-assets/','/portfolio/assets/');const ranged=await api(videoURL,{headers:{Range:'bytes=0-15'}});assert.equal(ranged.status,206);assert.equal((await ranged.arrayBuffer()).byteLength,16);assert.ok(ranged.headers.get('cache-control').includes('no-store'));
record('signed video upload stays private until verified; published video supports authorized streaming/ranges');
execFileSync('docker',['exec',config.container,'psql','-X','-q','-U','postgres','-c',"DROP FUNCTION public.natori_save_portfolio_content(bigint,jsonb); NOTIFY pgrst,'reload schema';"]);await new Promise(r=>setTimeout(r,500));
const before=await admin.from('natori_portfolio_content').select('content,revision').eq('id','main').single();
assert.equal((await json('/api/natori/portfolio/content',body({content:{...before.data.content,artistName:'FAILED_SAVE_CANARY'},expectedRevision:before.data.revision}))).status,500);
const after=await admin.from('natori_portfolio_content').select('content,revision').eq('id','main').single();assert.deepEqual(before.data,after.data);
record('real save RPC failure leaves content and publication state unchanged');
writeFileSync(resultPath('results.json'),JSON.stringify({syntheticOnly:true,engine:'GoTrue/PostgREST/PostgreSQL/StorageAPI and real Next HTTP; origin-only, no CDN/production claim',results,legacyURLs:'remain until separate reviewed migration/retirement',count:results.length},null,2));
