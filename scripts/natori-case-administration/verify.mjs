import { spawnSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { root } from "../natori-case-local-auth/prepare.mjs";
import { seed } from "../natori-case-payment/fixture.mjs";
const out = resolve(process.argv[2] ?? "");
assert(out.startsWith("/workspace/") || out.startsWith("/tmp/"));
mkdirSync(out);
const run = "meish-case-admin-" + randomBytes(5).toString("hex"),
  name = run + "-db";
const report = {
  run,
  scope:
    "50 formal business migrations; synthetic data; Auth/Storage catalog fixture; no providers",
  checks: [],
  removed: false,
};
const call = (args, input) =>
  spawnSync(
    "/usr/local/bin/docker",
    ["--host", "unix:///var/run/docker.sock", ...args],
    {
      input,
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 16 * 1024 * 1024,
      env: { PATH: process.env.PATH, LANG: "C.UTF-8" },
    },
  );
const docker = (args, input) => {
  const r = call(args, input);
  if (r.status !== 0)
    throw Error(r.stderr || r.error?.message || "docker failed");
  return r.stdout.trim();
};
const raw = (s) =>
  call(
    [
      "exec",
      "-i",
      name,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
    ],
    s,
  );
const sql = (s) => {
  const r = raw(s);
  if (r.status !== 0) throw Error(r.stderr);
  return r.stdout.trim();
};
const lit = (v) => "'" + String(v).replaceAll("'", "''") + "'",
  json = (v) => lit(JSON.stringify(v)) + "::jsonb";
const check = (label, fn) => {
  fn();
  report.checks.push(label);
  console.log(label);
};
const owner = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  actor = { kind: "auth-user", userId: owner };
const revision = (id) => sql(`select natori_case_work_revision_v1('${id}')`);
const request = (
  id,
  command,
  input = {},
  op = randomUUID(),
  rev = id ? revision(id) : null,
) => ({ id, command, input, op, rev });
const statement = (r, user = owner) =>
  `set role service_role;select natori_case_admin_command_v1('${user}','${r.op}',${r.id ? lit(r.id) : "null"},${lit(r.command)},${r.rev ? lit(r.rev) : "null"},${json(r.input)},${json(actor)});reset role;`;
const execute = (r, user = owner) => JSON.parse(sql(statement(r, user)));
const create = (title) =>
  request(null, "create", {
    mode: "manual",
    project: {
      title,
      client_name: "架空依頼者",
      client_email: "client@example.invalid",
      type: "illustration",
      status: "inquiry",
      amount: 12000,
      delivery_plan: "normal",
      start_date: "2026-10-22",
      due_date: "2026-12-01",
      note: "合成案件",
      next_action: "相談内容を確認する",
    },
    tasks: [],
  });
try {
  docker([
    "run",
    "--detach",
    "--pull",
    "never",
    "--network",
    "none",
    "--name",
    name,
    "--label",
    "meish.admin=" + run,
    "--memory",
    "512m",
    "--cpus",
    "1",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,nosuid,nodev,size=256m",
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f",
    "postgres",
    "-c",
    "listen_addresses=127.0.0.1",
  ]);
  let ready = false;
  for (let n = 0; n < 80; n++) {
    if (raw("select 1").status === 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready);
  const inspect = JSON.parse(docker(["inspect", name]))[0];
  assert.equal(inspect.HostConfig.NetworkMode, "none");
  assert.deepEqual(inspect.HostConfig.PortBindings ?? {}, {});
  assert(inspect.Mounts.every((m) => m.Type === "tmpfs"));
  sql(
    "create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;",
  );
  sql(
    readFileSync(
      root + "/scripts/legacy-entry-read-security/fresh-bootstrap.sql",
      "utf8",
    ),
  );
  const migrations = JSON.parse(
    readFileSync(root + "/supabase/baseline/manifest.json", "utf8"),
  ).activeMigrations;
  for (const file of migrations.slice(0, -1))
    sql(readFileSync(root + "/" + file, "utf8"));
  sql(`insert into auth.users(id) values('${owner}'),('${other}');`);
  const fixture = seed(owner, other);
  sql(fixture.sql);
  const before = sql(
    "select md5(jsonb_agg(to_jsonb(p) order by id)::text) from natori_projects p",
  );
  sql(readFileSync(root + "/" + migrations.at(-1), "utf8"));
  check(
    `normal ${migrations.length-1}→${migrations.length} forward upgrade preserves all existing projects; no backfill`,
    () =>
      assert.equal(
        sql(
          "select md5(jsonb_agg(to_jsonb(p) order by id)::text) from natori_projects p",
        ),
        before,
      ),
  );
  const first = create("合成管理案件"),
    created = execute(first),
    id = created.projectId;
  check(
    "new registration uses one explicit operation, saves origin separately, and replays the same project",
    () => {
      assert.equal(created.result, "applied");
      assert.equal(execute(first).projectId, id);
      assert.equal(
        sql(`select count(*) from natori_projects where title='合成管理案件'`),
        "1",
      );
      assert.equal(
        sql(
          `select data->>'origin' from natori_case_work_records where project_id='${id}'`,
        ),
        "manual",
      );
    },
  );
  check("same operation with different contents is rejected", () =>
    assert.equal(
      execute({
        ...first,
        input: {
          ...first.input,
          project: { ...first.input.project, title: "別入力" },
        },
      }).result,
      "conflict",
    ),
  );
  check("another owner cannot read a project or operation receipt", () => {
    assert.equal(
      sql(`select natori_case_admin_read_v1('${other}','${id}') is null`),
      "t",
    );
    assert.equal(
      sql(
        `select natori_case_admin_lookup_v1('${other}','${first.op}') is null`,
      ),
      "t",
    );
    assert.equal(
      execute(request(id, "close", { reason: "別owner" }), other).result,
      "not_found",
    );
  });
  const patch = {
    title: "基本編集後",
    client_name: "架空依頼者",
    amount: 12000,
    delivery_plan: "normal",
    start_date: "2026-10-22",
    due_date: "2026-12-02",
    note: "編集確認",
  };
  const detail = request(id, "details", { patch });
  execute(detail);
  check(
    "basic edit is atomic and same operation cannot overwrite a later edit",
    () => {
      sql(`update natori_projects set title='別タブ更新' where id='${id}'`);
      assert.equal(execute(detail).replayed, true);
      assert.equal(
        sql(`select title from natori_projects where id='${id}'`),
        "別タブ更新",
      );
    },
  );
  check(
    "confirmation revision rejects a changed amount before manual payment",
    () => {
      const r = request(id, "manual-payment");
      sql(`update natori_projects set amount=13000 where id='${id}'`);
      assert.equal(execute(r).result, "stale");
      assert.equal(
        sql(
          `select payment_confirmed_at is null from natori_projects where id='${id}'`,
        ),
        "t",
      );
    },
  );
  const manual = request(id, "manual-payment");
  check(
    "manual payment reuses the formal manual ledger exactly once and does not create Stripe evidence",
    () => {
      assert.equal(execute(manual).result, "applied");
      execute(manual);
      assert.equal(
        sql(
          `select count(*) from natori_payment_transactions where project_id='${id}' and status='manual' and amount=13000`,
        ),
        "1",
      );
      assert.equal(
        sql(
          `select stripe_payment_session_id is null from natori_projects where id='${id}'`,
        ),
        "t",
      );
    },
  );
  check("manual payment cannot settle unresolved provider facts", () => {
    const target = fixture.ids[0];
    sql(`update natori_projects set amount=amount+1 where id='${target}'`);
    assert.equal(
      execute(request(target, "manual-payment")).result,
      "payment_review",
    );
  });
  const lifecycle = execute(create("見送り保管合成")).projectId,
    close = request(lifecycle, "close", { reason: "記録する理由" });
  check("close replay does not append the reason twice", () => {
    assert.equal(execute(close).result, "applied");
    execute(close);
    assert.equal(
      sql(
        `select array_length(string_to_array(note,'記録する理由'),1) from natori_projects where id='${lifecycle}'`,
      ),
      "2",
    );
  });
  check(
    "archive and restore retain closed state; reopen is a separate operation",
    () => {
      assert.equal(execute(request(lifecycle, "archive")).result, "applied");
      assert.equal(execute(request(lifecycle, "restore")).result, "applied");
      assert.equal(
        sql(`select status from natori_projects where id='${lifecycle}'`),
        "closed",
      );
      assert.equal(execute(request(lifecycle, "reopen")).result, "applied");
      assert.equal(
        sql(`select status from natori_projects where id='${lifecycle}'`),
        "inquiry",
      );
    },
  );
  const parallel = create("並列登録合成");
  const concurrently = () =>
    new Promise((done, reject) => {
      const p = spawn(
        "/usr/local/bin/docker",
        [
          "exec",
          "-i",
          name,
          "psql",
          "-X",
          "-qAt",
          "-v",
          "ON_ERROR_STOP=1",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let output = "",
        error = "";
      p.stdout.on("data", (v) => (output += v));
      p.stderr.on("data", (v) => (error += v));
      p.on("error", reject);
      p.on("exit", (code) =>
        code === 0 ? done(JSON.parse(output)) : reject(Error(error)),
      );
      p.stdin.end(statement(parallel));
    });
  const concurrent = await Promise.all([concurrently(), concurrently()]);
  check(
    "parallel same-operation registration serializes to one project",
    () => {
      assert.equal(concurrent[0].projectId, concurrent[1].projectId);
      assert.equal(
        sql(`select count(*) from natori_projects where title='並列登録合成'`),
        "1",
      );
    },
  );
  check(
    "same operation survives a legitimate operator change without reapplying",
    () => {
      const changed = statement(first).replace(
        JSON.stringify(actor),
        JSON.stringify({ kind: "shared-key" }),
      );
      assert.equal(JSON.parse(sql(changed)).projectId, id);
    },
  );
  const target = fixture.ids[1],
    quote = sql(
      `select active_quote_id from natori_projects where id='${target}'`,
    );
  const payload = {
    from: "Local <mail@example.invalid>",
    to: ["reply@example.invalid"],
    reply_to: "reply@example.invalid",
    subject: "合成通知",
    text: "合成本文",
    headers: { "X-Meish-Template": "fixture" },
  };
  const notice = (status = "pending", extra = "") => {
    const jid = randomUUID();
    sql(
      `insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,status ${extra ? "," + extra.split("=")[0] : ""}) select '${jid}','case-admin/${jid}',p.id,q.id,'quote_accept_artist',jsonb_build_object('title',p.title,'clientName',p.client_name,'amount',q.amount,'acceptedAt',q.accepted_at),'${status}' ${extra ? "," + extra.slice(extra.indexOf("=") + 1) : ""} from natori_projects p join natori_quotes q on q.id=p.active_quote_id where p.id='${target}'`,
    );
    return jid;
  };
  let job = notice();
  const retry = request(target, "retry-notice", {
    notificationId: job,
    previewHash: "a".repeat(64),
    payload,
  });
  check(
    "legitimate generic initial notice freezes its reviewed payload before recovery",
    () => {
      const r = execute(retry);
      assert.equal(r.result, "queued");
      assert.equal(r.notificationId, job);
      assert.equal(
        sql(
          `select payload->>'text' from natori_notification_jobs where id='${job}'`,
        ),
        "合成本文",
      );
    },
  );
  check(
    "receipt replay precedes later state or payload changes and never queues again",
    () => {
      const replay = JSON.parse(
        sql(
          `set role service_role;select natori_case_admin_replay_v1('${owner}','${retry.op}','${target}','retry-notice','${retry.rev}',${json({ ...retry.input, payload: null })});reset role;`,
        ),
      );
      assert.equal(replay.replayed, true);
      assert.equal(replay.notificationId, job);
      assert.equal(
        execute({ ...retry, input: { ...retry.input, payload: null } })
          .replayed,
        true,
      );
    },
  );
  check(
    "recovered notification refuses sending after the confirmed case identity changes",
    () => {
      sql(
        `update natori_projects set title=title||'更新' where id='${target}'`,
      );
      assert.notEqual(
        raw(
          `select * from natori_notification_claim_v1('${job}',gen_random_uuid())`,
        ).status,
        0,
      );
    },
  );
  const unknown = notice("unknown");
  check("unknown outcomes cannot obtain a replacement provider request", () => {
    assert.equal(
      execute(
        request(target, "retry-notice", {
          notificationId: unknown,
          previewHash: "a".repeat(64),
          payload,
        }),
      ).result,
      "notice_review",
    );
    assert.equal(
      sql(
        `select count(*) from natori_notification_jobs where notification_key='case-admin/${unknown}'`,
      ),
      "1",
    );
  });
  const failed = notice("failed"),
    recover = request(target, "retry-notice", {
      notificationId: failed,
      previewHash: "a".repeat(64),
      payload,
    });
  check(
    "definite failure creates one next attempt; old source attempt cannot create another",
    () => {
      const r = execute(recover);
      assert.equal(r.result, "queued");
      assert.notEqual(r.notificationId, failed);
      assert.equal(
        execute(
          request(target, "retry-notice", {
            notificationId: failed,
            previewHash: "a".repeat(64),
            payload,
          }),
        ).result,
        "notice_review",
      );
      assert.equal(
        sql(
          `select count(*) from natori_notification_jobs where notification_key='case-admin/${failed}'`,
        ),
        "2",
      );
    },
  );
  check(
    "more than 200 notices explicitly reports partial history without disabling case administration",
    () => {
      sql(
        `insert into natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,status,sent_at,provider_id) select 'admin-many/'||g,'${target}','${quote}','quote_accept_artist','{}'::jsonb,'sent',now(),'synthetic' from generate_series(1,205) g`,
      );
      const v = JSON.parse(
        sql(`select natori_case_admin_read_v1('${owner}','${target}')`),
      );
      assert.equal(v.complete, false);
      assert.equal(v.notices.length, 200);
      assert(
        v.notices.some((n) => n.id === unknown),
        "older unresolved series cannot be hidden behind successful history",
      );
      assert.equal(v.project.id, target);
      assert.match(v.revision, /^[a-f0-9]{64}$/);
    },
  );
  const agreed = execute(create("旧承諾の合成")).projectId;
  check(
    "legacy project acceptance without matching authoritative quote cannot be manually settled or repriced",
    () => {
      sql(
        `update natori_projects set quote_accepted_at=now(),quote_accepted_amount=12000 where id='${agreed}'`,
      );
      assert.equal(
        execute(request(agreed, "manual-payment")).result,
        "payment_review",
      );
      assert.equal(
        execute(
          request(agreed, "details", { patch: { ...patch, amount: 15000 } }),
        ).result,
        "agreement_locked",
      );
    },
  );
  const qp = execute(create("期限境界合成")).projectId,
    qid = randomUUID(),
    qjob = randomUUID();
  sql(`insert into natori_quotes(id,project_id,user_id,version,amount,expires_at,issued_at,title,client_name,to_email,subject,body_snapshot,token_hash) values('${qid}','${qp}','${owner}',1,12000,clock_timestamp()+interval '3 seconds',clock_timestamp(),'期限境界','合成依頼者','synthetic@example.invalid','合成','合成',repeat('a',64));update natori_projects set active_quote_id='${qid}' where id='${qp}';
 insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,payload) select '${qjob}','expiry/${qjob}',p.id,'${qid}','quote_issue_client','{}',jsonb_build_object('format','natori-delivery-aes256gcm-v1','ciphertext','synthetic','expiresAt',q.expires_at,'caseWorkGuard',natori_case_work_metadata_v1(p.id)) from natori_projects p join natori_quotes q on q.id=p.active_quote_id where p.id='${qp}'`);
  const locker = spawn(
    "/usr/local/bin/docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let lockerError = "";
  locker.stderr.on("data", (v) => (lockerError += v));
  const lockedDone = new Promise((done, reject) =>
    locker.on("exit", (code) =>
      code === 0 ? done() : reject(Error(lockerError)),
    ),
  );
  locker.stdin.end(
    `begin;select id from natori_projects where id='${qp}' for update;select pg_sleep(3.4);commit;`,
  );
  let locked = false;
  for (let n = 0; n < 50; n++) {
    if (
      sql(
        `select exists(select 1 from pg_locks where relation='natori_projects'::regclass and mode='RowShareLock' and pid<>pg_backend_pid())`,
      ) === "t"
    ) {
      locked = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  assert(locked);
  assert.equal(
    sql(
      `select expires_at>clock_timestamp() from natori_quotes where id='${qid}'`,
    ),
    "t",
    "quote must still be valid when the waiting sender begins",
  );
  const expiredClaim = raw(
    `select * from natori_notification_claim_v1('${qjob}',gen_random_uuid())`,
  );
  await lockedDone;
  check(
    "sender waits for another transaction then rejects a quote that expired while waiting",
    () => {
      assert.notEqual(expiredClaim.status, 0);
      assert.match(expiredClaim.stderr, /case_admin_quote_requires_review/);
      assert.equal(
        sql(`select status from natori_notification_jobs where id='${qjob}'`),
        "pending",
      );
    },
  );
  check("new quote cannot bypass an unresolved old quote notice", () => {
    const result = raw(
      `select * from natori_case_issue_quote_v1('${owner}',${json({ projectId: qp, idempotencyKey: randomUUID() })},'{}','${revision(qp)}')`,
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /notification_recovery_required/);
  });
  const reviewId = randomUUID();
  sql(`insert into natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,status) values('${reviewId}','payment/platform/false/event-evt_missing/payment_review_artist','${target}','payment_review_artist','{"reviewReason":"session_missing"}','failed');
 insert into natori_stripe_event_inbox(event_id,account_scope,livemode,event_type,request,owner_id,project_id,status,result,notification_ids) values('evt_missing','platform',false,'checkout.session.completed','{}','${owner}','${target}','needs_review','session_missing',ARRAY['${reviewId}'::uuid]);`);
  const matches = (jid) =>
    sql(
      `select natori_case_admin_notice_target_v1(p,j) from natori_projects p join natori_notification_jobs j on j.project_id=p.id where j.id='${jid}'`,
    );
  check(
    "session-less review is bound to its precise event rather than rejected for two null session IDs",
    () => assert.equal(matches(reviewId), "t"),
  );
  sql(
    `update natori_stripe_event_inbox set status='completed' where event_id='evt_missing';insert into natori_stripe_event_inbox(event_id,account_scope,livemode,event_type,request,owner_id,project_id,status,result) values('evt_other','platform',false,'checkout.session.completed','{"sessionId":"cs_other"}','${owner}','${target}','needs_review','session_missing');`,
  );
  check(
    "another unresolved event does not make an already resolved review eligible again",
    () => assert.equal(matches(reviewId), "f"),
  );
  const paidOnly = execute(create("既知入金のみの合成")).projectId;
  sql(
    `update natori_projects set paid_at=clock_timestamp(),paid_amount=12000 where id='${paidOnly}'`,
  );
  check(
    "independent paid facts also block a second manual payment and repricing",
    () => {
      assert.equal(
        execute(request(paidOnly, "manual-payment")).result,
        "payment_review",
      );
      assert.equal(
        execute(
          request(paidOnly, "details", { patch: { ...patch, amount: 13000 } }),
        ).result,
        "agreement_locked",
      );
      assert.equal(
        sql(
          `select count(*) from natori_payment_transactions where project_id='${paidOnly}'`,
        ),
        "0",
      );
    },
  );
  check(
    "new quote cannot overwrite paid-only facts even through a direct API/RPC request",
    () => {
      const r = raw(
        `select * from natori_case_issue_quote_v1('${owner}',${json({ projectId: paidOnly, idempotencyKey: randomUUID() })},'{}','${revision(paidOnly)}')`,
      );
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /project_already_paid/);
      assert.equal(
        sql(`select amount from natori_projects where id='${paidOnly}'`),
        "12000",
      );
      assert.equal(
        sql(
          `select count(*) from natori_quotes where project_id='${paidOnly}'`,
        ),
        "0",
      );
    },
  );
  check(
    "legacy acceptance is exposed explicitly without inventing an internal quote",
    () => {
      const v = JSON.parse(
        sql(`select natori_case_admin_read_v1('${owner}','${agreed}')`),
      );
      assert(v.acceptance.at);
      assert.equal(v.acceptance.amount, 12000);
      assert.equal(v.quote, null);
    },
  );
  const ctxId=execute(create("原依頼と参考資料の合成案件")).projectId;
  const context=()=>JSON.parse(sql(`set role service_role;select natori_case_context_read_v1('${owner}','${ctxId}');reset role;`));
  const contextRequest=(command,input,op=randomUUID(),rev=context().revision)=>({command,input:{command,...input},op,rev});
  const contextExec=(v,user=owner)=>JSON.parse(sql(`set role service_role;select natori_case_context_command_v1('${user}','${v.op}','${ctxId}',${lit(v.command)},${lit(v.rev)},${json(v.input)},${json(actor)});reset role;`));
  check("context read and planning are owner scoped and expose no client capability",()=>{
    assert.equal(sql(`select natori_case_context_read_v1('${other}','${ctxId}') is null`),'t');
    const plans=JSON.parse(sql(`select natori_case_planning_read_v1('${other}')`));assert(!plans.some(p=>p.id===ctxId));
    assert.equal(context().project.id,ctxId);assert(!JSON.stringify(plans).includes('token'));
  });
  check("memo save and same-ID replay preserve original request and every lifecycle fact",()=>{
    const v=contextRequest('intake-memo',{text:'担当が原回答を確認する'}),before=sql(`select to_jsonb(p)-'next_action'-'mutation_revision'-'updated_at' from natori_projects p where id='${ctxId}'`);
    assert.equal(contextExec(v).result,'applied');assert.equal(contextExec(v).replayed,true);
    assert.equal(sql(`select to_jsonb(p)-'next_action'-'mutation_revision'-'updated_at' from natori_projects p where id='${ctxId}'`),before);
  });
  const add=contextRequest('reference-link',{mode:'add',linkId:null,url:'https://example.invalid/ref',normalizedUrl:'https://example.invalid/ref',label:'合成資料'});
  check("reference add replays once and invalidates an earlier confirmation",()=>{
    const stale=contextRequest('intake-memo',{text:'古い確認'});assert.equal(contextExec(add).result,'applied');assert.equal(contextExec(add).replayed,true);
    assert.equal(context().links.length,1);assert.equal(contextExec(stale).result,'stale');assert.equal(contextExec(add,other).result,'not_found');
  });
  check("reference edit/delete bind the exact row and replay does not restore a deleted link",()=>{
    const id=context().links[0].id,edit=contextRequest('reference-link',{mode:'edit',linkId:id,url:'https://example.invalid/edited',normalizedUrl:'https://example.invalid/edited',label:'更新'});
    assert.equal(contextExec(edit).result,'applied');
    const remove=contextRequest('reference-link',{mode:'remove',linkId:id,url:'',label:null});assert.equal(contextExec(remove).result,'applied');
    assert.equal(contextExec(edit).replayed,true);assert.equal(context().links.length,0);
  });
  check("context service-only ACLs, INVOKER/search_path and pure read transaction",()=>{
    assert.equal(sql(`select bool_and(not prosecdef and proconfig=ARRAY['search_path=""']::text[] and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute') and has_function_privilege('service_role',oid,'execute')) from pg_proc where proname in ('natori_case_context_read_v1','natori_case_context_revision_v1','natori_case_planning_read_v1','natori_case_context_command_v1')`),'t');
    sql(`begin read only;set local role service_role;select natori_case_context_read_v1('${owner}','${ctxId}');select natori_case_planning_read_v1('${owner}');rollback;`);
  });
  check(
    "functions are INVOKER with empty search_path and service-only EXECUTE; operation table has RLS",
    () => {
      assert.equal(
        sql(
          `select bool_and(not prosecdef and proconfig=ARRAY['search_path=""']::text[] and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute') and has_function_privilege('service_role',oid,'execute')) from pg_proc where proname in ('natori_case_admin_read_v1','natori_case_admin_lookup_v1','natori_case_admin_replay_v1','natori_case_admin_command_v1','natori_case_issue_quote_v1','natori_case_renotify_quote_v1')`,
        ),
        "t",
      );
      assert.equal(
        sql(
          `select relrowsecurity and not has_table_privilege('authenticated',oid,'select') from pg_class where oid='natori_case_admin_operations'::regclass`,
        ),
        "t",
      );
    },
  );
  check("operation history is immutable", () =>
    assert.notEqual(
      raw(`update natori_case_admin_operations set command='x'`).status,
      0,
    ),
  );
  await (await import("../natori-case-history/verify-sql.mjs")).checkHistorySql({sql,raw,owner,other,check,out});
  await (await import("../natori-case-continuity/verify-sql.mjs")).checkContinuitySql({sql,raw,owner,other,check,name});
  report.success = true;
} catch (e) {
  report.success = false;
  report.error = e.message;
  console.error(e.message);
  process.exitCode = 1;
} finally {
  try {
    const info = JSON.parse(docker(["inspect", name]))[0];
    assert.equal(info.Config.Labels["meish.admin"], run);
    docker(["rm", "--force", name]);
    report.removed = true;
  } catch (e) {
    report.cleanupError = e.message;
    process.exitCode = 1;
  }
  writeFileSync(out + "/results.json", JSON.stringify(report, null, 2));
}
