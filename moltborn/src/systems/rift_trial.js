// The Trial room of a Tidal Rift: the chamber starts empty, waves of foes drop in on a timer, and when the clock runs out
// and the last of them has fallen the way opens, with a better pool of relics on offer. This file holds the timing rules
// as plain functions over a small state object, so they can be tested without a game; systems/rifts.js drives them.
import { rng } from '../core/util.js';

export const TRIAL = {
  length: 40,                    // seconds the tide must be held
  firstWave: 3,                  // seconds before the first wave
  gap: 8,                        // seconds between waves
  stopSpawning: 6,               // no new waves in the last few seconds, so the end is a clean-up
  maxPending: 7,                 // never queue more than this many foes at once
};
export const waveSize = (depth) => 2 + Math.floor(depth / 2);

export const newTrial = () => ({ left: TRIAL.length, next: TRIAL.firstWave, waves: 0, done: false });

// advance the clock; returns how many foes to drop in right now (0 most of the time)
export function stepTrial(tr, dt, depth, pending = 0) {
  if (tr.done) return 0;
  tr.left = Math.max(0, tr.left - dt);
  if (tr.left <= 0) { tr.done = true; return 0; }
  tr.next -= dt;
  if (tr.next > 0 || tr.left <= TRIAL.stopSpawning) return 0;
  tr.next = TRIAL.gap; tr.waves++;
  return Math.max(0, Math.min(waveSize(depth), TRIAL.maxPending - pending));
}

// "0:32", counting down
export const clockText = (tr) => { const s = Math.ceil(tr.left); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// the elite chance of a trial wave climbs as the clock runs down: the last waves are the worst
export const waveElite = (tr, depth, r = rng(tr.waves * 31 + depth)) => r() < 0.1 + depth * 0.03 + (1 - tr.left / TRIAL.length) * 0.2;
