import { execFileSync } from 'node:child_process';
import { request } from 'node:http';

// Construction only: clone this run's disposable container spec without exposing
// its temporary credentials. Test processes never receive the Docker socket.
async function main() {
  const [project, network, origin] = process.argv.slice(2);
  if (process.env.GITHUB_ACTIONS !== 'true' || !/^natori-phase-t-\d+-\d+$/.test(project ?? '')
    || network !== project || !/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin ?? '')) throw Error('GUARD');
  const name = `supabase_storage_${project}`, bootstrap = `${name}-bootstrap`;
  const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const [old] = JSON.parse(docker('inspect', name));
  const [net] = JSON.parse(docker('network', 'inspect', network));
  const endpoint = old.NetworkSettings.Networks[network];
  if (old.Config.Labels?.['com.supabase.cli.project'] !== project || !old.State.Running
    || Object.keys(old.NetworkSettings.Networks).length !== 1 || !endpoint
    || net.Internal !== true || net.Labels?.['natori.phase-t'] !== project
    || Object.keys(old.HostConfig.PortBindings ?? {}).length > 0
    || old.Mounts.some(m => m.Type !== 'volume' || m.Name !== `supabase_storage_${project}`)) throw Error('SPEC_GUARD');
  const overrides = { NODE_ENV: 'development', STORAGE_PUBLIC_URL: origin,
    FILE_SIZE_LIMIT: '262144000', UPLOAD_FILE_SIZE_LIMIT: '262144000', UPLOAD_FILE_SIZE_LIMIT_STANDARD: '262144000' };
  const config = { ...old.Config, Image: old.Image,
    Env: [...old.Config.Env.filter(e => !Object.hasOwn(overrides, e.split('=', 1)[0])),
      ...Object.entries(overrides).map(([key, value]) => `${key}=${value}`)] };
  const body = JSON.stringify({ ...config, HostConfig: { ...old.HostConfig, NetworkMode: network },
    NetworkingConfig: { EndpointsConfig: { [network]: {
      Aliases: endpoint.Aliases, IPAMConfig: { IPv4Address: endpoint.IPAddress },
    } } } });
  docker('network', 'disconnect', network, name); // Release the old internal IP before reusing it.
  docker('stop', '--time', '15', name);
  docker('rename', name, bootstrap);
  await new Promise((resolve, reject) => {
    const req = request({ socketPath: '/var/run/docker.sock', path: `/containers/create?name=${encodeURIComponent(name)}`,
      method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: 15000 }, res => {
      res.resume(); res.on('end', () => res.statusCode === 201 ? resolve() : reject(Error('CREATE_FAILED')));
    });
    req.on('error', () => reject(Error('DOCKER_UNAVAILABLE')));
    req.on('timeout', () => req.destroy(Error('TIMEOUT'))); req.end(body);
  });
  docker('start', name);
  const [created] = JSON.parse(docker('inspect', name));
  if (created.Image !== old.Image || !created.State.Running || created.Config.Labels?.['com.supabase.cli.project'] !== project
    || Object.keys(created.NetworkSettings.Networks).length !== 1
    || created.NetworkSettings.Networks[network]?.IPAddress !== endpoint.IPAddress) throw Error('CREATED_GUARD');
  docker('rm', bootstrap); // The named Storage volume is retained; only this run's old container is removed.
  console.log('Phase 1 disposable Storage: exact internal TUS origin and 250MiB cap; image/auth/policies unchanged');
}
main().catch(() => { console.error('Disposable Storage configuration failed; raw container credentials withheld'); process.exitCode = 1; });
