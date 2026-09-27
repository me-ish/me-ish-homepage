-- Disposable failure injection only. Not present in any production migration.
create function public.phase_n_fail_enqueue() returns trigger language plpgsql set search_path='' as $$
begin
  if new.snapshot->>'title'='FAIL_ENQUEUE_SYNTHETIC' then raise exception 'SYNTHETIC_ENQUEUE_FAILURE'; end if;
  return new;
end;
$$;
create trigger phase_n_fail_enqueue before insert on public.natori_notification_jobs
  for each row execute function public.phase_n_fail_enqueue();
revoke all on function public.phase_n_fail_enqueue() from public,anon,authenticated;
