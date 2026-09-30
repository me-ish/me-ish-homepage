import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Dedicated diagnostic fixture only, after the ordinary mandatory matrix.
// Widen the existing DB-version/backend-read window; do not fabricate responses,
// bypass auth, change policies, alter bytes, or touch a cloud Storage instance.
export function installFixture() {
const {readFileSync,writeFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const path='/app/dist/storage/backend/file.js';
const source=readFileSync(path,'utf8');
const start=source.indexOf('async getObject('), end=source.indexOf('async uploadObject(',start);
if(start<0||end<start||source.includes('phase0a-controlled-version-race'))throw Error('SOURCE_GUARD');
const method=source.slice(start,end);
const target=/const data = await [\w.]+\.stat\(file\);/g;
if([...method.matchAll(target)].length!==1)throw Error('METHOD_GUARD');
const changed=method.replace(target, '/* phase0a-controlled-version-race */\n' +
  'if(key.includes("/artworks/entry_")) await new Promise(resolve=>setTimeout(resolve,600));\n$&');
const result=source.slice(0,start)+changed+source.slice(end);
const uploaderPath='/app/dist/storage/uploader.js';
const uploader=readFileSync(uploaderPath,'utf8');
const uploadStart=uploader.indexOf('async completeUpload(');
const uploadMethod=uploader.slice(uploadStart);
const uploadTarget='const db = this.db.asSuperUser();';
if(uploadStart<0||uploadMethod.split(uploadTarget).length!==2||uploader.includes('phase0a-controlled-version-race'))
  throw Error('UPLOADER_GUARD');
const gate=String.raw`/* phase0a-controlled-version-race */
if(bucketId==='artworks' && /^entry_[0-9a-f-]{36}\.(png|jpg)$/.test(objectName)) {
  const gates=globalThis.__phase0aRaceGates ??= new Map();
  let state=gates.get(objectName);
  if(!state) {
    let release;
    state={arrived:0,promise:new Promise(resolve=>{release=resolve}),release:()=>release()};
    gates.set(objectName,state);
  }
  const actor=++state.arrived;
  if(actor===2) state.release();
  if(actor>2) throw Error('CONTROLLED_PAIR_LIMIT');
  let timer;
  try {
    await Promise.race([state.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CONTROLLED_PAIR_TIMEOUT')),5000)})]);
  } finally {clearTimeout(timer)}
  if(actor===2) await new Promise(resolve=>setTimeout(resolve,200));
}
`;
const uploaderResult=uploader.slice(0,uploadStart)+uploadMethod.replace(uploadTarget,gate+'\n'+uploadTarget);
writeFileSync(path,result);
writeFileSync(uploaderPath,uploaderResult);
console.log(JSON.stringify({fixture:'controlled-version-race',delayMs:600,
  originalSHA256:createHash('sha256').update(source).digest('hex'),
  fixtureSHA256:createHash('sha256').update(result).digest('hex'),
  uploaderOriginalSHA256:createHash('sha256').update(uploader).digest('hex'),
  uploaderFixtureSHA256:createHash('sha256').update(uploaderResult).digest('hex')}));
}
export const program = `(${installFixture.toString()})();`;
function main() {
  const [project, output] = process.argv.slice(2);
  if (process.env.GITHUB_ACTIONS !== 'true' || !/^natori-phase-t-\d+-\d+$/.test(project ?? '') || !output)
    throw Error('GUARD');
  const name = `supabase_storage_${project}`;
  const docker = (...args) => {
    const result = spawnSync('docker', args, {encoding:'utf8'});
    if (result.status !== 0) throw Error('DOCKER_GUARD');
    return result.stdout.trim();
  };
  if (docker('inspect','-f','{{index .Config.Labels "com.supabase.cli.project"}}',name) !== project
    || docker('inspect','-f','{{.State.Running}}',name) !== 'true'
    || !docker('inspect','-f','{{.Config.Image}}',name).endsWith('/storage-api:v1.77.0')
    || docker('inspect','-f','{{len .NetworkSettings.Networks}}',name) !== '1'
    || docker('network','inspect','-f','{{.Internal}}',project) !== 'true'
    || docker('inspect','-f',`{{with index .NetworkSettings.Networks "${project}"}}present{{end}}`,name) !== 'present'
    || docker('exec',name,'printenv','STORAGE_BACKEND') !== 'file') throw Error('SPEC_GUARD');
  const fixture = JSON.parse(docker('exec',name,'node','-e',program));
  if (fixture.fixture !== 'controlled-version-race' || !/^[a-f0-9]{64}$/.test(fixture.originalSHA256)
    || !/^[a-f0-9]{64}$/.test(fixture.fixtureSHA256)) throw Error('RESULT_GUARD');
  writeFileSync(`${output}/phase0a-storage-fixture.json`, JSON.stringify(fixture,null,2), {mode:0o600});
  docker('restart',name);
  console.log('Controlled timing active only in the disposable Storage read fixture; source hashes saved');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch {
    console.error('CONTROLLED_STORAGE_TIMING_FAILED; raw logs withheld');
    process.exitCode = 1;
  }
}
