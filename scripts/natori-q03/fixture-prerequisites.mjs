// Reuse exact historical type RPCs before early management API checks.
// The later Phase 3A fixture omits only these already-installed definitions.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const path = 'supabase/migrations/20260731115652_etorie_intake_rpcs.sql';
export function reviewedIntakeParts() {
  const source = readFileSync(path, 'utf8');
  if (createHash('sha256').update(source).digest('hex') !== 'c4fbf789b27d1107afe1372ea1846f7270934cfe1e1b7eadc27ee62a6e5063ef') throw Error('Q03_INTAKE_SOURCE_CHANGED');
  const templateStart = source.indexOf('create function public.natori_project_task_template_v1(');
  const templateEnd = source.indexOf('/* --------------------------------------------------------------------------\n   RPC 1:', templateStart);
  const confirmStart = source.indexOf('create function public.natori_confirm_project_type_v1(');
  const confirmEnd = source.indexOf('\ncommit;', confirmStart);
  if (templateStart < 0 || templateEnd <= templateStart || confirmStart < templateEnd || confirmEnd <= confirmStart) throw Error('Q03_INTAKE_BOUNDARY_CHANGED');
  const template = source.slice(templateStart, templateEnd), confirm = source.slice(confirmStart, confirmEnd);
  return { prerequisites: template + '\n' + confirm, remaining: source.replace(template, '').replace(confirm, '') };
}
