import {readFileSync} from 'node:fs';
const [owner,mode]=process.argv.slice(2);
if(!owner||!['begin','upload','finish'].includes(mode))throw new Error('Fixture boundary required');
async function main(){
 const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));if(!/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin))throw new Error('Destination rejected');
 const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8'));
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,NATORI_OWNER_USER_ID:owner,NATORI_PUBLIC_INTAKE_V2:'1',NATORI_ACCEPTANCE_OUTBOX_ENABLED:'1',NATORI_NOTIFICATION_SENDING_ENABLED:'0',RESEND_API_KEY:'',ADMIN_API_TOKEN:''});
 const direct=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(u.origin!==origin)throw new Error('Destination rejected');const response=await direct(input,init);
  if(response.ok&&((mode==='begin'&&u.pathname.endsWith('/rpc/natori_intake_begin_v1'))||(mode==='finish'&&u.pathname.endsWith('/rpc/natori_intake_finish_v1'))||(mode==='upload'&&u.pathname.includes('/storage/v1/object/natori-inquiry-refs/')))){
   console.log('BOUNDARY_REACHED');await new Promise(()=>{});
  }return response;};
 const input=JSON.parse(readFileSync(0,'utf8'));const {submitPublicIntakeOperation}=await import('../../src/features/natori/server/publicIntakeOperationService');
 await submitPublicIntakeOperation(input.operationId,input.canonical,(input.files??[]).map((file:{bytes:string;name:string;type:string})=>new File([Buffer.from(file.bytes,'base64')],file.name,{type:file.type})));throw new Error('Boundary missed');
}
main().catch(()=>{console.log('HELPER_FAILED');process.exitCode=1;});
