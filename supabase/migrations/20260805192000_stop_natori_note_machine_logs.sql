-- P1-10: natori_projects.note is reserved for administrator-authored free-form notes.
-- Lifecycle history is recorded in natori_project_activity. During the migration
-- period, legacy application paths may still attempt to append their old
-- Japanese machine-log lines. Strip only those exact append shapes at the DB
-- boundary so existing human notes remain unchanged.

create or replace function public.natori_preserve_human_note_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  appended text;
begin
  if new.note is not distinct from old.note then
    return new;
  end if;

  if old.note is null then
    appended := new.note;
  elsif new.note like old.note || E'\n\n%' then
    appended := substr(new.note, char_length(old.note) + 3);
  else
    -- A replacement/edit that is not the legacy append form is treated as a
    -- genuine administrator note edit and is preserved.
    return new;
  end if;

  if appended ~ '^【(見積もりメール送信|支払い依頼メール送信|ラフ提出メール送信|納品メール送信) [0-9]{4}-[0-9]{2}-[0-9]{2}】宛先:'
     or appended ~ '^【納品受け取り確認 [0-9]{4}-[0-9]{2}-[0-9]{2}】納品ページより$'
  then
    new.note := old.note;
  end if;

  return new;
end;
$$;

comment on function public.natori_preserve_human_note_v1() is
  'P1-10 compatibility guard: prevents legacy lifecycle log lines from being appended to administrator notes.';

drop trigger if exists natori_projects_preserve_human_note_v1 on public.natori_projects;
create trigger natori_projects_preserve_human_note_v1
before update of note on public.natori_projects
for each row execute function public.natori_preserve_human_note_v1();

revoke all on function public.natori_preserve_human_note_v1() from public;
revoke all on function public.natori_preserve_human_note_v1() from anon;
revoke all on function public.natori_preserve_human_note_v1() from authenticated;
grant execute on function public.natori_preserve_human_note_v1() to service_role;
