import { writeFileSync } from 'node:fs';
import { buildReaderFixture } from '../natori-wf01/build-reader-fixture.mjs';
// The current management reader's exact prerequisites are installed once, before PhaseN cases.
writeFileSync(process.argv[2],buildReaderFixture('verify-existing').sql);
