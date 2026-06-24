import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/cli.js';

test('defaults: no args', () => {
  const o = parseArgs([]);
  assert.equal(o.targetDir, null);
  assert.equal(o.react, null);
  assert.equal(o.install, true);
  assert.equal(o.git, true);
  assert.equal(o.pm, null);
  assert.equal(o.ref, 'main');
  assert.equal(o.yes, false);
});

test('positional dir + flags', () => {
  const o = parseArgs(['my-app', '--react', '--no-install', '--no-git', '--pm', 'pnpm', '--ref', 'dev', '-y']);
  assert.equal(o.targetDir, 'my-app');
  assert.equal(o.react, true);
  assert.equal(o.install, false);
  assert.equal(o.git, false);
  assert.equal(o.pm, 'pnpm');
  assert.equal(o.ref, 'dev');
  assert.equal(o.yes, true);
});

test('help and version flags', () => {
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-v']).version, true);
});
