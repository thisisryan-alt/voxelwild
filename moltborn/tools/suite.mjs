// Runs a set of browser scripts one after another and prints a table of results. A script passes when it exits with code 0
// and prints neither a page error nor a script error. Usage:
//   node tools/suite.mjs                 run the default set
//   node tools/suite.mjs bounties fishing   run just these (names without .mjs)
//   node tools/suite.mjs --list          list every script that can be run
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';

const DEFAULT = [
  'smoke', 'rifts', 'riftrooms', 'trial', 'oaths', 'warden', 'riftfoes', 'arena', 'bounties', 'fishing', 'market', 'moonpool', 'surge', 'clock',
  'helphall', 'tricks', 'audio3', 'newcuts2', 'companion', 'extras', 'forage', 'savetools', 'devconsole', 'director', 'affixes', 'ngplus', 'feel',
];
const TIMEOUT = 280000;
const all = readdirSync(new URL('../tests/scripts/', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();

const args = process.argv.slice(2);
if (args.includes('--list')) { console.log(all.join('\n')); process.exit(0); }
const names = args.length ? args : DEFAULT;
for (const n of names) if (!all.includes(n)) { console.error(`no such script: ${n}`); process.exit(2); }

function run(name) {
  return new Promise((resolve) => {
    const t0 = Date.now(), p = spawn(process.execPath, ['tools/run.mjs', `tests/scripts/${name}.mjs`], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, OUT: `/tmp/suite_${name}` } });
    let out = ''; const timer = setTimeout(() => { out += '\n[suite] timed out'; p.kill('SIGKILL'); }, TIMEOUT);
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      clearTimeout(timer);
      const bad = /\[pageerror\]|\[script error\]|\[suite\] timed out/.test(out) || code !== 0;
      resolve({ name, ok: !bad, secs: (Date.now() - t0) / 1000, out });
    });
  });
}

const results = [];
for (const n of names) {
  process.stdout.write(`${n.padEnd(14)} `);
  const r = await run(n); results.push(r);
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.secs.toFixed(1)}s`);
  if (!r.ok) console.log(r.out.split('\n').filter((l) => /error|Error|timed out/.test(l)).slice(0, 6).map((l) => '    ' + l).join('\n'));
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scripts passed in ${results.reduce((a, r) => a + r.secs, 0).toFixed(0)}s`);
process.exitCode = failed.length ? 1 : 0;
