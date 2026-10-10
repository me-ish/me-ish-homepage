"""Only the reviewed obsolete definitions may disappear; all other catalog stays."""
import json
import sys
from pathlib import Path

before, after = [json.loads(Path(p).read_text()) for p in sys.argv[1:3]]
mode = sys.argv[3]
targets = json.loads((Path(__file__).parents[2] / 'supabase/operations/retire-empty-legacy-schema/targets.json').read_text())
expected = json.loads(json.dumps(before))
if mode == 'schema':
    relation_names = targets['tables'] + targets['views']
    expected['relations'] = [r for r in expected['relations'] if not (r['schema'] == 'public' and r['name'] in relation_names)]
    expected['indexes'] = [r for r in expected['indexes'] if not (r['schemaname'] == 'public' and r['tablename'] in targets['tables'])]
    expected['policies'] = [r for r in expected['policies'] if not (r['schemaname'] == 'public' and r['tablename'] in targets['tables'])]
    expected['functions'] = [r for r in expected['functions'] if r['signature'] not in targets['functions']] or None
elif mode == 'storage':
    expected['policies'] = [r for r in expected['policies'] if not (r['schemaname'] == 'storage' and r['tablename'] == 'objects' and r['policyname'] in targets['storage_policies'])]
    if not expected['policies']:
        expected['policies'] = None  # PostgreSQL jsonb_agg on an empty set.
else:
    raise SystemExit('Unknown catalog comparison mode')
assert after == expected, f'Unexpected {mode} catalog change'
print(f'PASS exact {mode} catalog delta; all protected definitions/permissions unchanged')
