-- Fixture-only proof of the former ambiguity; no business rows are read or changed.
do $$
declare
  t public.natori_payment_transactions%rowtype;
  p public.natori_projects%rowtype;
  purpose text;
  observed integer:=0;
  diagnostic_code text;
begin
  if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then
    raise exception 'Sandbox required';
  end if;
  begin
    perform t.id from public.natori_payment_transactions t where false;
    raise exception 'transaction_alias_ambiguity_not_reproduced';
  exception when ambiguous_column then
    get stacked diagnostics diagnostic_code=returned_sqlstate;
    if diagnostic_code<>'42702' then raise exception 'unexpected_alias_sqlstate'; end if;
    observed:=observed+1;
  end;
  begin
    perform p.id from public.natori_projects p where false;
    raise exception 'project_alias_ambiguity_not_reproduced';
  exception when ambiguous_column then
    get stacked diagnostics diagnostic_code=returned_sqlstate;
    if diagnostic_code<>'42702' then raise exception 'unexpected_alias_sqlstate'; end if;
    observed:=observed+1;
  end;
  begin
    perform purpose from public.natori_notification_jobs j where false;
    raise exception 'notification_value_ambiguity_not_reproduced';
  exception when ambiguous_column then
    get stacked diagnostics diagnostic_code=returned_sqlstate;
    if diagnostic_code<>'42702' then raise exception 'unexpected_alias_sqlstate'; end if;
    observed:=observed+1;
  end;
  if observed<>3 then raise exception 'alias_preflight_incomplete'; end if;
  raise notice 'PHASE2D_ALIAS_PREFLIGHT transaction=42702 project=42702 notification=42702';
end;
$$;
