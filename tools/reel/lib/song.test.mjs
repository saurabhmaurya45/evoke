import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBeat, SAMPLE_RATE } from './song.mjs';

function clicks(bpm, seconds, offset = 0) {
  const x = new Float32Array(seconds * SAMPLE_RATE);
  for (let t = offset; t < seconds; t += 60 / bpm) {
    const at = Math.round(t * SAMPLE_RATE);
    for (let i = 0; i < 300 && at + i < x.length; i++) x[at + i] = Math.exp(-i / 60) * Math.sin(i * 0.9);
  }
  return x;
}

for (const bpm of [84, 96, 110]) {
  test(`finds ${bpm} BPM and lands on a beat`, () => {
    const offset = 0.2;
    const r = findBeat(clicks(bpm, 90, offset), 30, 96);
    assert.ok(Math.abs(r.bpm - bpm) < 0.5, `read ${r.bpm}`);
    const beat = 60 / bpm;
    const off = ((r.firstBeat - offset) % beat + beat) % beat;
    assert.ok(Math.min(off, beat - off) < 0.06, `${off}s off the beat`);
  });
}

test('reads a fast song at half time rather than rushing the film', () => {
  const r = findBeat(clicks(192, 60), 30, 96);
  assert.ok(Math.abs(r.bpm - 96) < 0.5, `read ${r.bpm}`);
});

test('starts where a section begins, not partway through the quieter part before it', () => {
  const x = clicks(96, 120);
  for (let i = 0; i < 60 * SAMPLE_RATE; i++) x[i] *= 0.1;
  const firstBar = 3;
  const r = findBeat(x, 30, 96, firstBar);
  const songStart = r.firstBeat - firstBar / (r.bpm / 96);
  assert.ok(Math.abs(songStart - 60) < 1, `starts at ${songStart}s`);
});

test('a song that is strong from the start plays from the start', () => {
  const r = findBeat(clicks(96, 90), 30, 96, 3);
  assert.ok(r.firstBeat - 3 < 0.7, `first beat at ${r.firstBeat}s`);
});

test('a silent song is reported instead of guessing a tempo', () => {
  assert.throws(() => findBeat(new Float32Array(SAMPLE_RATE * 8), 30, 96), /silent/);
});

test('a song too short to analyse is reported', () => {
  assert.throws(() => findBeat(new Float32Array(100), 30, 96), /too short/);
});
