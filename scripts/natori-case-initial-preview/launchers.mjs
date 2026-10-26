// Vercel limits installCommand/buildCommand to 256 characters. Keep the
// complete existing gates in private root files, with short launch commands.
export function privateLaunchers(archiveSHA256, partCount, authentication = 'password') {
  if (!['password', 'google'].includes(authentication)) throw Error('launcher_manifest_invalid');
  if (!/^[a-f0-9]{64}$/.test(archiveSHA256) || !Number.isInteger(partCount) || partCount < 1 || partCount > 100) throw Error('launcher_manifest_invalid');
  const common = `const {spawnSync}=require('node:child_process');
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit'});if(r.error||r.status!==0)process.exit(r.status||1);}
run(process.execPath,['preview-platform-gate.mjs']);
if(!process.versions.node.startsWith('22.')){console.error('initial_preview_node22_required');process.exit(1);}
console.log('initial_preview_node22_confirmed',process.versions.node);
`;
  return {
    'preview-install.cjs': common + `const fs=require('node:fs'),{createHash}=require('node:crypto');
const parts=fs.readdirSync('.').filter(p=>/^application-source\\.part-\\d{3}$/.test(p)).sort();
if(parts.length!==${partCount})throw Error('initial_preview_parts_unconfirmed');
const bytes=Buffer.concat(parts.map(p=>fs.readFileSync(p)));
if(createHash('sha256').update(bytes).digest('hex')!==${JSON.stringify(archiveSHA256)})throw Error('initial_preview_source_unconfirmed');
fs.writeFileSync('application-source.tar.gz',bytes,{mode:0o600});
run('tar',['-xzf','application-source.tar.gz']);
run('npm',['ci','--no-audit','--no-fund']);
`,
    'preview-build.cjs': common + `run(process.execPath,['scripts/natori-case-initial-preview/${authentication === 'google' ? 'google-preflight' : 'setup'}.mjs']);
run('npm',['run','build']);
`,
  };
}
