// A tiny test harness (no dependencies): test(name, fn), assertion helpers, and a summary that sets the exit code.
const results = { pass: 0, fail: 0, failures: [] };
let current = '';
export function test(name, fn) {
  current = name;
  try { fn(); results.pass++; }
  catch (e) { results.fail++; results.failures.push(`${name}: ${e.message}`); }
}
export const ok = (v, msg = 'expected truthy') => { if (!v) throw new Error(msg); };
export const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`.trim()); };
export const near = (a, b, tol = 1e-6, msg = '') => { if (Math.abs(a - b) > tol) throw new Error(`${msg} expected ~${b}, got ${a}`.trim()); };
export const deep = (a, b, msg = '') => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`${msg} expected ${y}, got ${x}`.trim()); };
export const throws = (fn, msg = 'expected a throw') => { try { fn(); } catch (e) { return; } throw new Error(msg); };
export function summary(label) {
  console.log(`[unit] ${label}: ${results.pass} passed, ${results.fail} failed`);
  for (const f of results.failures) console.log('  ✗', f);
  return results;
}
export const counts = () => results;
