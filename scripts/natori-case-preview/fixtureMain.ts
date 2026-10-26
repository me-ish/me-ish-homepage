import { buildPreviewRecords } from './fixtureReader';
const normal=await buildPreviewRecords();
const partial=await buildPreviewRecords('partial');
process.stdout.write(JSON.stringify({normal,partial}));
