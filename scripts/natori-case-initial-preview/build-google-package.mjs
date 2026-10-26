// Offline preparation only. No upload, external Auth configuration or deploy.
import { buildPackage } from './package.mjs';
console.log(JSON.stringify(buildPackage(process.argv[2] ?? '', { authentication: 'google' }), null, 2));
