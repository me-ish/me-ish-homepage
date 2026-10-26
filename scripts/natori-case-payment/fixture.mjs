import {readFileSync} from 'node:fs';
import {root} from '../natori-case-local-auth/prepare.mjs';
export function schema(){
 let s=readFileSync(root+'/scripts/natori-case-app-read/fixture-schema.sql','utf8');
 s=s.split('\n').filter(line=>!/^create table natori_(payment_link_attempts|payment_link_operations|payment_link_stops|notification_jobs|order_mail_logs)\(/.test(line)).join('\n');
 s=s.replace('create table natori_quotes(id uuid,','create table natori_quotes(id uuid primary key,');
 s+=`\nalter table public.natori_projects add column quoted_amount bigint,add column client_email text,add column payment_quote_id uuid,add column next_action text,add column note text;
 alter table public.natori_quotes add column title text,add column client_name text,add column to_email text,add column subject text,add column body_snapshot text,add column token_hash text;
 -- Writer dependency ACL in this synthetic fixture, not a service permission change.
 grant update on public.natori_projects,public.natori_quotes to service_role;
`;
 // Exact existing outbox/writer migrations; no historical replay repairs or copied production rows.
 s+=readFileSync(root+'/supabase/migrations/20260927073530_natori_acceptance_notifications.sql','utf8');
 const baseline=readFileSync(root+'/supabase/migrations/20260723111730_etorie_baseline.sql','utf8'),start=baseline.indexOf('create table public.natori_order_mail_logs ('),end=baseline.indexOf('create table public.natori_inquiry_reference_files',start);
 if(start<0||end<=start)throw Error('mail fixture boundary changed');
 s+=baseline.slice(start,end)+`alter table public.natori_order_mail_logs enable row level security;grant select on public.natori_order_mail_logs to service_role;`;
 s+=readFileSync(root+'/supabase/migrations/20261001161401_natori_payment_link_generations.sql','utf8');
 s+=readFileSync(root+'/supabase/migrations/20261021032000_natori_case_payment_workspace.sql','utf8');
 s+=readFileSync(root+'/supabase/migrations/20261021100000_natori_case_payment_receipt_retirement.sql','utf8');
 s+=readFileSync(root+'/supabase/migrations/20261023010000_natori_case_system_hold.sql','utf8');
 return s;
}
export function seed(owner,other){
 const ids=Array.from({length:16},(_,i)=>`a0000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 return {ids,titles:ids.map((_,i)=>`架空の支払案件${i+1}`),sql:'begin;\n'+ids.map((id,i)=>{
 const q=`b0000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,o=i===10?other:owner;
 return `INSERT INTO public.natori_projects(id,user_id,title,client_name,client_email,status,type,amount,due_date,created_at,updated_at)
 VALUES('${id}','${o}','架空の支払案件${i+1}','架空依頼者','client${i+1}@example.invalid','quoted','illustration',12000,'2026-11-12',now(),now());
 INSERT INTO public.natori_quotes(id,project_id,user_id,version,amount,accepted_at,created_at,expires_at,issued_at,title,client_name,to_email,subject,body_snapshot,token_hash) VALUES('${q}','${id}','${o}',2,12000,now(),now(),now()+interval '30 days',now(),'架空の支払案件${i+1}','架空依頼者','client${i+1}@example.invalid','合成見積','合成本文',repeat(md5('${q}'),2));
 UPDATE public.natori_projects SET active_quote_id='${q}',quote_accepted_at=now(),quote_accepted_amount=12000 WHERE id='${id}';`;
 }).join('\n')+'\ncommit;'};
}
