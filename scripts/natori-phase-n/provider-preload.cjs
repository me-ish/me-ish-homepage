// Test-only preload for the disposable Next child process. Not imported by product code.
if(process.env.PHASE_N_BROWSER!=='ephemeral')throw new Error('EPHEMERAL_REQUIRED');
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(!/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin??''))throw new Error('DESTINATION_REJECTED');
const direct=globalThis.fetch;
globalThis.fetch=(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.href==='https://api.resend.com/emails')return direct('http://127.0.0.1:3101/emails',init);
  if(![origin,'http://localhost:3000','http://127.0.0.1:3000'].includes(url.origin)||url.username||url.password)return Promise.reject(new Error('DESTINATION_REJECTED'));
  return direct(input,init);
};
