import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {buildSync} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {config,resultPath,root} from './common.mjs';
const admin=createClient(config.api,config.service,{auth:{persistSession:false,autoRefreshToken:false}});
const password=randomBytes(24).toString('hex'),users=[];
for(const label of ['teacher','other']) {
  const email=label+'@sec01.invalid';const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ok(!created.error&&created.data.user,'Synthetic user creation failed');
  const client=createClient(config.api,config.anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const session=await client.auth.signInWithPassword({email,password});assert.ok(!session.error&&session.data.session,'Synthetic login failed');
  users.push({id:created.data.user.id,email,session:session.data.session});
}
const code=buildSync({stdin:{contents:`import {defaultPortfolioContent} from './src/features/natori/constants/portfolioContent';module.exports=defaultPortfolioContent;`,resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false,tsconfig:root+'tsconfig.json'}).outputFiles[0].text;
const context={module:{exports:{}}};runInNewContext(code,context);const content=JSON.parse(JSON.stringify(context.module.exports));
await new Promise(r=>setTimeout(r,1000));
const projects=[];
for(let i=0;i<users.length;i++) {
  const inserted=await admin.from('natori_projects').insert({user_id:users[i].id,title:'Synthetic private project '+i,client_name:'Fixture only',type:'illustration',due_date:'2026-12-31'}).select('id').single();assert.ok(!inserted.error&&inserted.data,'Synthetic project creation failed');projects.push(inserted.data.id);
}
const image=await sharp({create:{width:32,height:32,channels:4,background:'#336699'}}).webp().toBuffer();writeFileSync(resultPath('image.webp'),image);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=32x32:d=0.3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart',resultPath('video.mp4')]);
const legacy=await admin.storage.from('natori-portfolio').upload('project-thumbs/'+projects[0]+'.webp',image,{contentType:'image/webp',upsert:false});
if(legacy.error)console.error('Synthetic Storage setup status:',legacy.error.statusCode,legacy.error.message);
assert.ok(!legacy.error,'Synthetic legacy upload failed');
writeFileSync(resultPath('runtime.json'),JSON.stringify({...config,users,projects}),{mode:0o600});
content.heroImage='/sec01-fixture-gallery.webp';content.heroImages=[content.heroImage];content.aboutImage=content.heroImage;
content.works=[{...content.works[0],id:'legacy-public',title:'Public gallery fixture',image:content.heroImage,published:true}];
writeFileSync(resultPath('content.json'),JSON.stringify(content));
console.log('Prepared synthetic Auth/users/images/video; no customer data');
