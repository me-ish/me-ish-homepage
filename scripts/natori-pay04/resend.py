"""Q01 regression checks on the same socket-only, synthetic PAY-04 PostgreSQL."""
import hashlib
import json
import uuid


def run(pay, send_notice, notice_of, extend_sql):
    lit, sql, value, check = pay.literal, pay.sql, pay.value, pay.check

    def operation(label):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, 'q01/' + label))

    def token(label):
        return hashlib.sha256(('q01/' + label).encode()).hexdigest()

    def effective(pid):
        return value(f"select greatest(r.expires_at,coalesce((select max(x.new_expires_at) from public.natori_delivery_extensions x where x.release_id=r.id),r.expires_at)) from public.natori_delivery_releases r where r.project_id={lit(pid)}")

    def counts(pid):
        return json.loads(value(f"select jsonb_build_array("
            f"(select count(*) from public.natori_delivery_access a join public.natori_delivery_releases r on r.id=a.release_id where r.project_id={lit(pid)}),"
            f"(select count(*) from public.natori_notification_jobs where project_id={lit(pid)} and purpose='delivery_issue_client'),"
            f"(select count(*) from public.natori_delivery_operations where project_id={lit(pid)}),"
            f"(select count(*) from public.natori_delivery_extensions where project_id={lit(pid)}))::text"))

    def stored_access(pid):
        return json.loads(value(f"select coalesce(jsonb_object_agg(a.token_hash,a.expires_at),'{{}}'::jsonb)::text "
            f"from public.natori_delivery_access a join public.natori_delivery_releases r on r.id=a.release_id where r.project_id={lit(pid)}"))

    def issue(pid, manifest, label, expiry=None, **kwargs):
        return pay.issue_sql(pid, manifest, token(label), operation(label),
                             expires=lit(expiry or effective(pid)) + '::timestamptz', **kwargs)

    def call(statement):
        return json.loads(value(statement))

    def ready(label, expiry="clock_timestamp()+interval '3 days'"):
        pid, manifest, old, _, rid = pay.issued('q01-' + label, expires=expiry)
        send_notice(notice_of(pid))
        return pid, manifest, old, rid

    # Ordinary issuance still works without extension rows.
    p0, m0, _, _ = ready('no-extension')
    original0 = pay.release(p0)
    check('q01_resend_without_extension_succeeds', call(issue(p0, m0, 'no-extension'))['result'] == 'issued')
    check('q01_no_extension_keeps_original_release', pay.release(p0) == original0)

    pid, manifest, old, rid = ready('expired', "clock_timestamp()+interval '1 second'")
    value('select 1 from pg_sleep(1.1)')
    original = pay.release(pid)
    evidence_fields = ('id','user_id','status','title','client_name','client_email','delivery_token_hash',
        'delivery_token_expires_at','delivery_accepted_at','payment_confirmed_at','paid_at','paid_amount','completed_at')
    def project_evidence():
        state = pay.state(pid)
        return {key: state.get(key) for key in evidence_fields}

    original_project = project_evidence()
    before = counts(pid)
    check('q01_effectively_expired_resend_rejected', call(issue(pid, manifest, 'expired-before-extension'))['result'] == 'expired')
    check('q01_expired_resend_writes_nothing', counts(pid) == before)

    extended = call(extend_sql(pid, manifest, token('extension-1'), operation('extension-1'), "clock_timestamp()+interval '10 days'"))
    assert extended['result'] == 'extended'
    first_expiry = effective(pid)
    before = counts(pid)
    # The extension itself is pending: stale expiry must produce the dedicated
    # race result rather than a generic request-content conflict.
    check('q01_stale_expiry_detected_while_extension_notice_pending',
          call(issue(pid, manifest, 'stale-pending', original['expires_at']))['result'] == 'expiry-changed')
    check('q01_pending_extension_race_writes_nothing', counts(pid) == before)
    check('q01_current_expiry_does_not_bypass_unresolved_extension_notice',
          call(issue(pid, manifest, 'current-pending'))['result'] == 'conflict')
    check('q01_unresolved_notice_guard_writes_nothing', counts(pid) == before)
    send_notice(extended['notification_id'])

    previous_access = stored_access(pid)
    resend = call(issue(pid, manifest, 'extended-resend'))
    check('q01_extended_resend_succeeds', resend['result'] == 'issued' and resend['release_id'] == rid)
    check('q01_resend_adds_exactly_one_access_notice_operation', counts(pid) == [before[0]+1,before[1]+1,before[2]+1,before[3]])
    current_access = stored_access(pid)
    check('q01_resend_preserves_all_previous_access_expiries', all(current_access.get(k) == v for k,v in previous_access.items()))
    check('q01_new_access_uses_exact_effective_expiry', value(f"select expires_at=(select max(new_expires_at) from public.natori_delivery_extensions where release_id={lit(rid)}) from public.natori_delivery_access where token_hash={lit(token('extended-resend'))}") == 't')
    check('q01_original_release_and_project_evidence_unchanged', pay.release(pid) == original
          and project_evidence() == original_project)
    check('q01_expired_old_link_not_revived', pay.accept(old, rid, manifest)['result'] == 'expired')

    # A committed response is deliberately discarded, then replayed. The op lookup
    # wins even if this retry carries a stale expiry/new candidate token.
    before = counts(pid)
    again = call(issue(pid, manifest, 'extended-resend', original['expires_at']))
    check('q01_response_loss_retry_returns_same_notice', again['notification_id'] == resend['notification_id'] and counts(pid) == before)

    notice = resend['notification_id']
    payload_before = value(f"select payload::text from public.natori_notification_jobs where id={lit(notice)}")
    claim = operation('unknown-claim')
    assert value(f"select count(*) from public.natori_notification_claim_v1({lit(notice)},{lit(claim)},true)") == '1'
    assert value(f"select count(*) from public.natori_notification_start_v1({lit(notice)},{lit(claim)},{lit(payload_before)}::jsonb)") == '1'
    assert value(f"select public.natori_notification_finish_v1({lit(notice)},{lit(claim)},'unknown',null,'provider_unknown')") == 't'
    joined = call(issue(pid, manifest, 'same-request-new-operation'))
    check('q01_unknown_notice_reused_across_operation_ids', joined['notification_id'] == notice and counts(pid) == [before[0],before[1],before[2]+1,before[3]])
    check('q01_unknown_notice_payload_and_identity_unchanged', value(f"select payload::text from public.natori_notification_jobs where id={lit(notice)}") == payload_before)
    before = counts(pid)
    check('q01_unknown_notice_changed_request_conflicts', call(issue(pid, manifest, 'different-request', request_hash='0'*64))['result'] == 'conflict' and counts(pid) == before)
    check('q01_extension_waits_for_unknown_resend_notice', call(extend_sql(pid, manifest, token('blocked-extension'), operation('blocked-extension'), "clock_timestamp()+interval '12 days'"))['result'] == 'notice-pending' and counts(pid) == before)
    check('q01_unknown_retry_backoff_is_still_enforced', value(f"select count(*) from public.natori_notification_claim_v1({lit(notice)},{lit(operation('early-claim'))},true)") == '0')
    # Advance only this synthetic queue timer instead of waiting a minute. The
    # immutable payload, send-start clock, notification ID and provider key stay put.
    sql(f"update public.natori_notification_jobs set retry_after=clock_timestamp()-interval '1 second' where id={lit(notice)}")
    send_notice(notice)
    check('q01_unknown_recovery_keeps_one_original_notice_and_payload', counts(pid) == before
          and value(f"select payload::text from public.natori_notification_jobs where id={lit(notice)}") == payload_before)

    second = call(extend_sql(pid, manifest, token('extension-2'), operation('extension-2'), "clock_timestamp()+interval '12 days'"))
    assert second['result'] == 'extended'
    send_notice(second['notification_id'])
    before = counts(pid)
    check('q01_latest_of_multiple_extensions_is_required', call(issue(pid, manifest, 'stale-second-extension', first_expiry))['result'] == 'expiry-changed' and counts(pid) == before)
    latest = call(issue(pid, manifest, 'latest-extension'))
    check('q01_multiple_extension_resend_succeeds', latest['result'] == 'issued')
    check('q01_resend_does_not_append_extension_or_change_release', counts(pid)[3] == 2 and pay.release(pid) == original)
    send_notice(latest['notification_id'])
    check('q01_resent_access_accepts_delivery', pay.accept(token('latest-extension'), rid, manifest)['result'] == 'accepted')
    check('q01_acceptance_keeps_original_manifest_and_expiry', pay.release(pid)['manifest'] == original['manifest'] and pay.release(pid)['expires_at'] == original['expires_at'])
    check('q01_old_link_still_expired_after_acceptance', stored_access(pid)[old] == previous_access[old])

    # A historical extension can itself have expired. Construct only synthetic
    # append-only evidence; never mutate an issued release to move the clock.
    px, mx, _, rx = ready('past-extension', "clock_timestamp()+interval '1 second'")
    sql(f"insert into public.natori_delivery_extensions(release_id,project_id,operation_id,request_hash,previous_expires_at,new_expires_at,reason) "
        f"select id,project_id,{lit(operation('past-extension'))},{lit(token('past-extension-request'))},expires_at,clock_timestamp()+interval '2 seconds','Synthetic historical extension' "
        f"from public.natori_delivery_releases where id={lit(rx)}")
    value('select 1 from pg_sleep(2.1)')
    before = counts(px)
    check('q01_resend_after_extension_itself_expired_is_rejected', call(issue(px,mx,'past-extension-resend'))['result']=='expired' and counts(px)==before)

    # Two actual DB sessions contend in an observed queue, not a Promise-only mock.
    pr, mr, _, _ = ready('parallel-same-op')
    before = counts(pr)
    race = pay.lock_race(pr, [issue(pr,mr,'parallel-same-op'), issue(pr,mr,'parallel-same-op')], 'q01_same_operation')
    check('q01_parallel_same_operation_one_notice', all(r['result']=='issued' for r in race) and race[0]['notification_id']==race[1]['notification_id'] and counts(pr)==[before[0]+1,before[1]+1,before[2]+1,before[3]])

    pd, md, _, _ = ready('parallel-different-op')
    before = counts(pd)
    race = pay.lock_race(pd, [issue(pd,md,'different-op-a'), issue(pd,md,'different-op-b')], 'q01_different_operations')
    check('q01_parallel_identical_request_reuses_unresolved_notice', race[0]['notification_id']==race[1]['notification_id'] and counts(pd)==[before[0]+1,before[1]+1,before[2]+2,before[3]])

    pe, me, _, _ = ready('extension-first')
    original_e = pay.release(pe)
    before = counts(pe)
    race = pay.lock_race(pe, [extend_sql(pe,me,token('race-extension'),operation('race-extension'),"clock_timestamp()+interval '10 days'"),
        issue(pe,me,'race-stale-resend',original_e['expires_at'])], 'q01_extension_first')
    check('q01_extension_first_stale_resend_requires_reconfirmation', [r['result'] for r in race]==['extended','expiry-changed'] and counts(pe)==[before[0]+1,before[1]+1,before[2]+1,before[3]+1] and pay.release(pe)==original_e)

    pi, mi, _, _ = ready('resend-first')
    original_i = pay.release(pi)
    before = counts(pi)
    race = pay.lock_race(pi, [issue(pi,mi,'race-resend-first'),
        extend_sql(pi,mi,token('race-extension-blocked'),operation('race-extension-blocked'),"clock_timestamp()+interval '10 days'")], 'q01_resend_first')
    check('q01_resend_first_blocks_extension_behind_unresolved_notice', [r['result'] for r in race]==['issued','notice-pending'] and counts(pi)==[before[0]+1,before[1]+1,before[2]+1,before[3]] and pay.release(pi)==original_i)

    check('q01_rpc_retains_service_only_security_boundary', value(f"select prosecdef and proconfig=array['search_path=\"\"']::text[] and has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE') from pg_proc where oid={lit(pay.ISSUE)}::regprocedure", role=None) == 't')
