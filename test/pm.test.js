import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPackageManager } from '../src/utils/pm.js';

test('detects pnpm from user agent', () => {
  assert.equal(detectPackageManager('pnpm/9.1.0 npm/? node/v20.0.0'), 'pnpm');
});
test('detects yarn', () => {
  assert.equal(detectPackageManager('yarn/1.22.0 npm/? node/v20.0.0'), 'yarn');
});
test('defaults to npm when unknown or empty', () => {
  assert.equal(detectPackageManager(undefined), 'npm');
  assert.equal(detectPackageManager(''), 'npm');
  assert.equal(detectPackageManager('npm/10.0.0 node/v20.0.0'), 'npm');
});
