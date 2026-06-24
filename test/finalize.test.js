import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalize } from '../src/finalize.js';

test('finalize swallows git failure (non-fatal)', async () => {
  const runner = async (cmd) => { if (cmd === 'git') throw new Error('no git'); };
  await assert.doesNotReject(() => finalize({ targetDir: '/tmp/x', pm: 'npm', install: false, git: true }, runner));
});

test('finalize swallows install failure (non-fatal)', async () => {
  const runner = async () => { throw new Error('install boom'); };
  await assert.doesNotReject(() => finalize({ targetDir: '/tmp/x', pm: 'npm', install: true, git: false }, runner));
});

test('finalize runs nothing when both flags are false', async () => {
  let calls = 0;
  const runner = async () => { calls++; };
  await finalize({ targetDir: '/tmp/x', pm: 'npm', install: false, git: false }, runner);
  assert.equal(calls, 0);
});
