import { readFileSync, writeFileSync } from 'node:fs';
const migration = readFileSync('supabase/migrations/20261001221938_natori_refund_ledger.sql', 'utf8');
const locks = readFileSync('scripts/natori-phase-2d/lock-fixture.sql', 'utf8');
writeFileSync(process.argv[2], `do $$ begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
end $$;
` + migration + "\n" + locks + "\nNOTIFY pgrst, 'reload schema';\n");
