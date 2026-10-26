const tableMap={project_intake:'natori_intake_operations',financial_quotes:'natori_quotes',financial_drafts:'natori_estimate_drafts',financial_links:'natori_payment_link_attempts',financial_payments:'natori_payment_transactions',financial_inbox:'natori_stripe_event_inbox',financial_refunds:'natori_refund_ledger',financial_notifications:'natori_notification_jobs',financial_legacy_notices:'natori_order_mail_logs',financial_quote_operations:'natori_quote_issue_operations',financial_link_operations:'natori_payment_link_operations',financial_link_stops:'natori_payment_link_stops',financial_delivery_operations:'natori_delivery_operations',financial_consultation_operations:'natori_consultation_operations',lifecycle_tasks:'natori_project_tasks',lifecycle_files:'natori_delivery_files',lifecycle_roughs:'natori_talk_roughs',lifecycle_rough_acknowledgements:'natori_rough_ok_acknowledgements',lifecycle_releases:'natori_delivery_releases',lifecycle_extensions:'natori_delivery_extensions',lifecycle_consultation:'natori_consultation_messages'};
export const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function seedSql(input,owner,other) {
 const envelopes=JSON.parse(JSON.stringify(input).replaceAll('22222222-2222-4222-8222-222222222222',owner));
 const insert=(table,row)=>`INSERT INTO public.${table} SELECT (jsonb_populate_record(NULL::public.${table},${literal(JSON.stringify(row))}::jsonb)).*;`;
 const titles=['森の表紙イラスト','星の立ち絵','雲のアイコン','小さな庭の挿絵','月のプロフィール画像','雨上がりのラフ','窓辺のポスター','光のカードイラスト'];
 const records=[];
 for(const [index,e] of envelopes.entries()){
  const p={...e.project,title:titles[index],client_name:`架空依頼者${index+1}`,due_date:index===3?null:'2026-11-12'};
  if(index===6){p.payment_link_id='plink_synthetic';p.payment_link_url='https://synthetic.invalid/never-opened';}
  records.push(insert('natori_projects',p));
  for(const [section,table] of Object.entries(tableMap))for(const projected of e.sections[section]?.rows??[]){
   const row={...projected};if(table.endsWith('_operations'))row.operation_id=row.id;
   if(section==='financial_links'){row.link_id=p.payment_link_id;row.link_url=p.payment_link_url;}
   if(section==='financial_payments')row.stripe_currency=row.currency;
   if(section==='lifecycle_files'){row.content_type='image/webp';row.storage_path='synthetic/'+row.id;row.file_name='synthetic.webp';}
   if(section==='lifecycle_releases')row.manifest=row.manifest_files.map(f=>({id:f.id,path:'synthetic/'+f.id,fileName:'synthetic.webp',sizeBytes:f.size_bytes,contentType:'image/webp',storageVersion:f.storage_version}));
   if(section==='lifecycle_rough_acknowledgements')row.rough_id=row.id;
   records.push(insert(table,row));
  }
 }
 records.push(insert('natori_projects',{...envelopes[0].project,id:'99999999-9999-4999-8999-999999999999',user_id:other,title:'他ownerの架空案件',client_name:'表示禁止の架空依頼者'}));
 for(let n=0;n<201;n++)records.push(insert('natori_consultation_messages',{id:`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,project_id:envelopes[2].project.id,sender:'client',created_at:'2026-10-19T04:00:00Z'}));
 return {sql:records.join('\n'),ids:envelopes.map(e=>e.project.id),titles};
}
