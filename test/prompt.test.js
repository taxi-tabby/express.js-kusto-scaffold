import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promptMissing } from '../src/cli.js';
import { parseArgs } from '../src/cli.js';

test('yes mode uses defaults, no prompter calls', async () => {
  const prompter = async () => { throw new Error('should not prompt'); };
  const opts = parseArgs(['my-app', '-y']);
  const r = await promptMissing(opts, prompter);
  assert.equal(r.targetDir, 'my-app');
  assert.equal(r.projectName, 'my-app');
  assert.deepEqual(r.extensions, []);
  assert.equal(r.install, true);
  assert.equal(r.git, true);
});

test('yes mode with --react keeps react without prompting', async () => {
  const prompter = async () => { throw new Error('should not prompt'); };
  const r = await promptMissing(parseArgs(['my-app', '-y', '--react']), prompter);
  assert.deepEqual(r.extensions, ['react']);
});

test('prompts for missing values', async () => {
  const answers = { targetDir: 'fresh-app', extensions: ['react'], pm: 'pnpm', install: false, git: false };
  const prompter = async () => answers;
  const r = await promptMissing(parseArgs([]), prompter);
  assert.equal(r.targetDir, 'fresh-app');
  assert.equal(r.projectName, 'fresh-app');
  assert.deepEqual(r.extensions, ['react']);
  assert.equal(r.pm, 'pnpm');
  assert.equal(r.install, false);
  assert.equal(r.git, false);
});
