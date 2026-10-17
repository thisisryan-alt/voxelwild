// Runs every unit test file and exits non-zero if anything failed. Usage: node tests/unit/run.mjs
import { summary } from './harness.mjs';
for (const f of ['status', 'settings', 'data', 'systems', 'more', 'ai']) await import(`./${f}.test.mjs`);
const r = summary('all');
process.exitCode = r.fail ? 1 : 0;
