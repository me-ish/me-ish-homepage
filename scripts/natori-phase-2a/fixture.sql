do $$ begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
end $$;
alter table public.natori_projects add column quoted_amount integer,
 add column quote_accept_token_hash text,add column quote_token_expires_at timestamptz;
