// Isolated test process preload only. No application endpoint, credentials or /proc reads.
const fs = require('node:fs');
const out = process.env.CASE_SCALE_OUT;
if (out && /^\/(workspace|tmp)\//.test(out)) {
  const peaks = {};
  let session, started=false;
  setInterval(() => {
    let phase;
    try { phase = fs.readFileSync(out + '/memory-phase.txt', 'utf8').trim(); } catch { return; }
    if (!/^[a-z0-9-]{1,80}$/.test(phase)) return;
    // Built-in in-process profiler, no inspector port or external endpoint.
    // One synthetic warm phase only; its timing is labelled as profiled.
    if(phase==='1000-warm'&&!started){
      started=true;session=new (require('node:inspector').Session)();session.connect();
      session.post('Profiler.enable',()=>session.post('Profiler.start'));
    }else if(session&&phase!=='1000-warm'){
      const active=session;session=undefined;
      active.post('Profiler.stop',(error,result)=>{if(!error)fs.writeFileSync(out+'/cpu-'+process.pid+'.json',JSON.stringify(result.profile));active.disconnect();});
    }
    const m = process.memoryUsage(), previous = peaks[phase] || {};
    peaks[phase] = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.max(v, previous[k] || 0)]));
    fs.writeFileSync(out + '/memory-' + process.pid + '.json', JSON.stringify({pid:process.pid, peaks}));
  }, 500).unref();
}
