-- Rough submissions in the consultation talk. A rough is an ordinary staff message with
-- attachments that staff marked as a rough; this table only annotates that message and keeps
-- the client's "OK" as a record. Messages, files, notifications and every existing flow are untouched.
begin;

create table public.natori_talk_roughs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  message_id uuid not null unique references public.natori_consultation_messages(id) on delete cascade,
  -- Fixed when the rough is marked: no quote existed yet ("参考ラフ（見積もり前）").
  before_quote boolean not null,
  created_at timestamptz not null default now(),
  -- Set once by the client's "このラフでOK". It is a progress note, never a formal consent.
  client_ok_at timestamptz
);
create index natori_talk_roughs_project_idx on public.natori_talk_roughs(project_id, created_at);

-- The OK is a record: once set it cannot be changed or cleared, and the rest of the row never moves.
create function public.natori_talk_roughs_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.project_id is distinct from old.project_id
     or new.message_id is distinct from old.message_id or new.before_quote is distinct from old.before_quote
     or new.created_at is distinct from old.created_at then
    raise exception 'talk_rough_immutable' using errcode = '23514';
  end if;
  if old.client_ok_at is not null and new.client_ok_at is distinct from old.client_ok_at then
    raise exception 'talk_rough_ok_recorded' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger natori_talk_roughs_guard before update on public.natori_talk_roughs
  for each row execute function public.natori_talk_roughs_guard();

-- A recorded OK also keeps its rough: only a rough nobody answered can be un-marked.
create function public.natori_talk_roughs_keep_ok() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.client_ok_at is not null and pg_trigger_depth() = 1 then
    raise exception 'talk_rough_ok_recorded' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger natori_talk_roughs_keep_ok before delete on public.natori_talk_roughs
  for each row execute function public.natori_talk_roughs_keep_ok();

alter table public.natori_talk_roughs enable row level security;
revoke all on public.natori_talk_roughs from public, anon, authenticated;
grant select, insert, update, delete on public.natori_talk_roughs to service_role;

commit;
