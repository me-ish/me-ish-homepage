# Executed only by the existing network-none disposable verifier, with its SQL helpers.
sql((ROOT / "scripts/natori-case-production-upgrade/current-flow.sql").read_text())
if PRODUCTION_VARIANTS:
    check('forward 17 preserves all pre-existing synthetic business fields', snapshot(shapes) == current_before)
check("current-flow forward SQL installs without optional mail foundation 54",
      sql("select to_regclass('natori_case_production_mail_connections') is null") == "t")
check("new current operations stay server-only and direct writes are denied",
      sql("select relrowsecurity and not has_table_privilege('service_role',oid,'INSERT') and not has_table_privilege('service_role',oid,'UPDATE') and not has_table_privilege('anon',oid,'SELECT') from pg_class where oid='natori_case_current_operations'::regclass") == "t")
current_owner = str(uuid.uuid4())
sql(f"insert into auth.users(id) values('{current_owner}')")

def current_case():
    project, quote = str(uuid.uuid4()), str(uuid.uuid4())
    sql(f"""insert into natori_projects(id,user_id,title,client_name,client_email,status,type,amount,due_date)
     values('{project}','{current_owner}','Synthetic current flow','Synthetic','current@example.invalid','quoted','illustration',12000,'2026-12-01');
     insert into natori_quotes(id,project_id,user_id,version,amount,accepted_at,created_at,issued_at,expires_at,title,client_name,to_email,subject,body_snapshot,token_hash)
     values('{quote}','{project}','{current_owner}',1,12000,now(),now()-interval '1 hour',now()-interval '1 hour',now()+interval '30 days','Synthetic current flow','Synthetic','current@example.invalid','Synthetic subject','Synthetic body',repeat(md5('{quote}'),2));
     update natori_projects set active_quote_id='{quote}',quote_accepted_at=(select accepted_at from natori_quotes where id='{quote}'),quote_accepted_amount=12000,
      quoted_amount=12000,payment_quote_id='{quote}',payment_link_id='plink_{project}',payment_link_url='https://example.invalid/{project}',payment_link_status='sent' where id='{project}';""")
    return project, quote

def claim(project, op, revision=None, request_hash="a" * 64):
    rev = revision or sql(f"select natori_case_work_revision_v1('{project}')")
    return json.loads(sql(service(f"select natori_case_current_claim_v1('{current_owner}','{project}','{op}','payment','{rev}','{request_hash}')")))

def step(project, op, action, payload):
    return sql(service(f"select natori_case_current_step_v1('{current_owner}','{project}','{op}','{action}',{lit(json.dumps(payload))}::jsonb)"))

cp, cq = current_case()
op = str(uuid.uuid4())
check("stale confirmation cannot claim current operation", claim(cp, op, "0" * 64)["result"] == "workspace_confirmation_stale")
check("current operation claims once", claim(cp, op)["result"] == "claimed")
check("same operation is lookup-only and changed payload conflicts", claim(cp, op)["result"] == "existing" and claim(cp, op, request_hash="b" * 64)["result"] == "conflict")
check("a second operation cannot overlap a current send", claim(cp, str(uuid.uuid4()))["result"] == "busy")
mail = {"quoteId": cq, "to": "current@example.invalid", "amount": 12000, "subject": "Synthetic subject", "body": "Synthetic body", "link": "https://example.invalid/" + cp, "kind": "payment"}
check("mail start binds current quote/recipient/link and persists exactly one pending log", step(cp, op, "mail_start", mail) == "true")
denied = raw(service(f"select natori_case_current_step_v1('{current_owner}','{cp}','{op}','mail_start',{lit(json.dumps(mail))}::jsonb)"))
check("duplicate mail start is refused", denied.returncode != 0 and "current_mail_already_started" in denied.stderr)
check("pending send has no success time or extended deadline", sql(f"select count(*)=1 and bool_and(sent_at is null and status='pending') from natori_order_mail_logs where project_id='{cp}'") == "t")
step(cp, op, "unknown", {})
check("unknown current operation closes other outbound entry points",sql(service(f"select natori_case_outbound_blocked_v1('{cp}',null,null)"))=="t")
review=json.loads(sql(service(f"select natori_case_system_review_v1('{current_owner}')")))
check("fresh stop/resume review includes unresolved current operations",any(r["kind"]=="current-operation" and r["id"]==op and r["unresolved"] for r in review["records"]))
check("unknown is retained and a new send stays blocked", claim(cp, str(uuid.uuid4()))["result"] == "busy")
cp2, cq2 = current_case()
op2 = str(uuid.uuid4())
sql(f"insert into natori_order_mail_logs(request_id,project_id,quote_id,kind,to_email,amount,link_url,subject,body_snapshot,status,sent_at) values(gen_random_uuid(),'{cp2}','{cq2}','payment','current@example.invalid',12000,'https://example.invalid/{cp2}','Synthetic','Synthetic','sent',now()-interval '10 days')")
old_sent = sql(f"select max(sent_at)::text from natori_order_mail_logs where project_id='{cp2}'")
check("a completed earlier send allows a newly confirmed resend", claim(cp2, op2)["result"] == "claimed")
expiry_id = str(uuid.uuid4())
check("expiry cannot race the confirmed resend", sql(service(f"select natori_case_current_expiry_v1('{current_owner}','{cp2}','{expiry_id}','claim','plink_{cp2}',{lit(old_sent)},clock_timestamp())")) == "f")
mail2 = {**mail, "quoteId": cq2, "link": "https://example.invalid/" + cp2}
step(cp2, op2, "mail_start", mail2)
sql(service(f"select natori_case_system_control_v2('{current_owner}','hold',0,'{{\"kind\":\"auth-user\",\"userId\":\"{current_owner}\"}}'::jsonb,null,false)"))
check("already-started send can record its known success while the system is held", step(cp2, op2, "mail_accepted", {"providerId": "synthetic-provider-id"}) == "true")
check("successful resend resets the actual latest-sent + seven-day basis", sql(f"select max(sent_at)>{lit(old_sent)}::timestamptz and max(sent_at)+interval '7 days'>clock_timestamp()+interval '6 days' from natori_order_mail_logs where project_id='{cp2}' and status='sent'") == "t")
check("known result is retained while held", json.loads(step(cp2, op2, "finish", {"response": {"kind": "ok"}}))["status"] == "completed")
denied = raw(service(f"select natori_case_current_claim_v1('{current_owner}','{cp2}','{uuid.uuid4()}','payment',public.natori_case_work_revision_v1('{cp2}'),'{"a" * 64}')"))
check("new send stays closed while held", denied.returncode != 0 and "natori_system_held" in denied.stderr)
paid = json.loads(sql(service(f"select natori_case_current_payment_fact_v1('{cp2}','cs_synthetic_current_success',12000,'{cq2}',null)")))
again = json.loads(sql(service(f"select natori_case_current_payment_fact_v1('{cp2}','cs_synthetic_current_success',12000,'{cq2}',null)")))
check("existing payment RPC records fact during hold with one ledger entry and duplicate prevention", paid[0]["result"] == "received" and again[0]["result"] == "already-paid" and sql(f"select count(*) from natori_payment_transactions where project_id='{cp2}'") == "1")
check("current flow does not weaken old sender admission", sql(service(f"select natori_case_system_admit_v1('{current_owner}','legacy-sender')")) == "f")
check("L7 full dependency image remains consistent after the forward change", sql("select natori_case_guard.check_contract('current_flow')") == "")
REPORT["currentFlow"] = {"providers": "test doubles / synthetic result values only", "mailRequests": 0, "paymentRequests": 0, "sql": "current-flow.sql", "status": "passed"}
# Independent quote issuance/renotification uses the established draft/quote RPC.
current_owner=str(uuid.uuid4());sql(f"insert into auth.users(id) values('{current_owner}')")
qp=str(uuid.uuid4());qi=str(uuid.uuid4())
terms={"deliverables":"Synthetic illustration","scope":"full_body","scopeNote":"","usage":"Synthetic","commercialUse":"no","publication":"Synthetic","dueDate":"2099-12-01"}
items=[{"id":"synthetic-item","kind":"manual","labelSnapshot":"Synthetic","quantity":1,"unitAmount":12000,"amount":12000,"automatic":False,"presetItemId":None,"sourceFields":[],"ruleId":None,"note":None}]
pricing={"schemaVersion":1,"projectTypeSnapshot":"illustration","currency":"JPY","total":12000,"items":items,"reviewItems":[],"reviewResolutions":[],"agreedTerms":terms}
sql(f"insert into natori_projects(id,user_id,title,client_name,client_email,status,type,due_date) values('{qp}','{current_owner}','Synthetic','Synthetic','previous@example.invalid','estimating','illustration','2099-11-01');insert into natori_estimate_drafts(project_id,user_id,agreed_terms,items) values('{qp}','{current_owner}',{lit(json.dumps(terms))},{lit(json.dumps(items))})")
check("confirmed quote issue uses one scoped operation",json.loads(sql(service(f"select natori_case_current_claim_v1('{current_owner}','{qp}','{qi}','quote_issue',natori_case_work_revision_v1('{qp}'),'{"c"*64}')")))["result"]=="claimed")
step(qp,qi,"start",{"effect":"quote"})
issued=json.loads(step(qp,qi,"issue_quote",{"p_user_id":current_owner,"p_project_id":qp,"p_title":"Synthetic","p_client_name":"Synthetic","p_to_email":"current@example.invalid","p_amount":12000,"p_subject":"Synthetic","p_body_snapshot":"Synthetic","p_token_hash":"d"*64,"p_expires_at":sql("select now()+interval '14 days'"),"p_request_snapshot":None,"p_pricing_snapshot":pricing,"p_idempotency_key":qi,"p_expected_revision":1}))[0]
check("original quote/draft RPC issues version one",issued["version"]==1 and issued["reused"]==False)
step(qp,qi,"record",{"effect":"quote"})
check("own issued recipient and agreed due-date changes are accepted but not other edits",sql(f"select expected->>'email'='current@example.invalid' and expected->>'dueDate'='2099-12-01' from natori_case_current_operations where project_id='{qp}'")=="t")
qm={"quoteId":issued["quote_id"],"to":"current@example.invalid","amount":12000,"subject":"Synthetic","body":"Synthetic","kind":"estimate"}
step(qp,qi,"mail_start",qm);step(qp,qi,"mail_accepted",{"providerId":"synthetic-quote-provider"});step(qp,qi,"finish",{"response":{"kind":"ok","version":1}})
qn=str(uuid.uuid4());check("same issued version can be explicitly reconfirmed for renotification",json.loads(sql(service(f"select natori_case_current_claim_v1('{current_owner}','{qp}','{qn}','quote_renotify',natori_case_work_revision_v1('{qp}'),'{"e"*64}')")))["result"]=="claimed")
expires=sql(f"select expires_at from natori_quotes where id='{issued['quote_id']}'")
step(qp,qn,"quote_access",{"quoteId":issued["quote_id"],"tokenHash":"f"*64,"expiresAt":expires})
step(qp,qn,"mail_start",qm);step(qp,qn,"mail_accepted",{"providerId":"synthetic-renotify-provider"});step(qp,qn,"finish",{"response":{"kind":"ok","version":1}})
check("renotification does not create another version or acceptance",sql(f"select count(*)=1 and bool_and(accepted_at is null) from natori_quotes where project_id='{qp}'")=="t")
# Existing paid/accepted quotes remain re-notifiable, without changing facts.
sql(service("select natori_accept_quote(repeat('d',64))"))
sql(f"update natori_projects set payment_quote_id='{issued['quote_id']}',quoted_amount=12000 where id='{qp}'")
sql(service(f"select natori_case_current_payment_fact_v1('{qp}','cs_synthetic_paid_quote',12000,'{issued['quote_id']}',null)"))
paid_before=sql(f"select payment_confirmed_at::text from natori_projects where id='{qp}'")
qn2=str(uuid.uuid4())
check("paid accepted quote still permits same-version renotification",json.loads(sql(service(f"select natori_case_current_claim_v1('{current_owner}','{qp}','{qn2}','quote_renotify',natori_case_work_revision_v1('{qp}'),'{"f"*64}')")))["result"]=="claimed")
step(qp,qn2,"quote_access",{"quoteId":issued["quote_id"],"tokenHash":"a"*64,"expiresAt":sql("select now()+interval '14 days'")})
step(qp,qn2,"mail_start",qm);step(qp,qn2,"mail_accepted",{"providerId":"synthetic-paid-renotify"});step(qp,qn2,"finish",{"response":{"kind":"ok","version":1}})
check("paid renotification preserves payment timestamp and accepted version",sql(f"select payment_confirmed_at::text from natori_projects where id='{qp}'")==paid_before and sql(f"select count(*)=1 and bool_and(accepted_at is not null) from natori_quotes where project_id='{qp}'")=="t")
check("new quote issue remains forbidden after acceptance/payment",json.loads(sql(service(f"select natori_case_current_claim_v1('{current_owner}','{qp}','{uuid.uuid4()}','quote_issue',natori_case_work_revision_v1('{qp}'),'{"a"*64}')")))["result"]=="invalid_state")
closed_project=str(uuid.uuid4());sql(f"insert into natori_projects(id,user_id,title,client_name,status,type) values('{closed_project}','{current_owner}','Synthetic closed','Synthetic','closed','illustration')")
check("closed case refuses even same-version renotification",json.loads(sql(service(f"select natori_case_current_claim_v1('{current_owner}','{closed_project}','{uuid.uuid4()}','quote_renotify',natori_case_work_revision_v1('{closed_project}'),'{"a"*64}')")))["result"]=="invalid_state")
# A provider result received during a hold is persisted before any new mail.
lp,lq=current_case();li=str(uuid.uuid4());claim(lp,li)
sql(f"update natori_projects set payment_link_status='issuing' where id='{lp}'")
step(lp,li,"start",{"effect":"price"});step(lp,li,"record",{"effect":"price","result":{"id":"price_synthetic"}});step(lp,li,"start",{"effect":"link"})
sql(service(f"select natori_case_system_control_v2('{current_owner}','hold',0,'{{\"kind\":\"auth-user\",\"userId\":\"{current_owner}\"}}',null,false)"))
step(lp,li,"record",{"effect":"link","result":{"id":"plink_synthetic_held","url":"https://example.invalid/held","quoteId":lq,"amount":12000}})
check("known link ID/URL survive a hold before projection and before email",sql(f"select o.evidence->'link'->>'id'='plink_synthetic_held' and p.payment_link_id='plink_synthetic_held' from natori_case_current_operations o join natori_projects p on p.id=o.project_id where o.id='{li}'")=="t")
check("held operation cannot start a new email",raw(service(f"select natori_case_current_step_v1('{current_owner}','{lp}','{li}','mail_start',{lit(json.dumps({**mail,'quoteId':lq,'link':'https://example.invalid/held'}))})")).returncode!=0)
check("no email success or seven-day expiry was inferred for the in-flight link",sql(f"select count(*)=0 from natori_order_mail_logs where project_id='{lp}'")=="t")
