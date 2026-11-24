// Writes the FICTIONAL demo import file used by the public E2E test.
import { writeFileSync } from 'node:fs';
import { buildDemoBundle } from './demoJourney';
import { makeJourneyFile } from '../../src/lib/journeyFile';
const f = await makeJourneyFile(buildDemoBundle(), '2030-01-01T00:00:00.000Z');
writeFileSync('tests/fixtures/demo-journey.changjourney.json', JSON.stringify(f, null, 1) + '\n');
console.log('demo import file written');
