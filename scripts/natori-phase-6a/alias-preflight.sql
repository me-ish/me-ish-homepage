-- Fixture-only proof of the former local/column collision; no rows are read or changed.
do $$
declare next_action text; diagnostic_code text;
begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
 begin
  perform next_action from public.natori_projects where false;
  raise exception 'task_action_ambiguity_not_reproduced';
 exception when ambiguous_column then
  get stacked diagnostics diagnostic_code=returned_sqlstate;
  if diagnostic_code<>'42702' then raise exception 'unexpected_task_alias_sqlstate'; end if;
 end;
 raise notice 'PHASE6A_ALIAS_PREFLIGHT next_action=42702';
end;
$$;
