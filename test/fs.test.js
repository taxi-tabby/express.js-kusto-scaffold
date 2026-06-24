import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isEmptyDir, writeFileEnsured } from '../src/utils/fs.js';

test('isEmptyDir: missing dir is empty', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-'));
  assert.equal(await isEmptyDir(join(base, 'nope')), true);
});
test('isEmptyDir: dir with a file is not empty', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-'));
  await writeFile(join(base, 'x.txt'), 'hi');
  assert.equal(await isEmptyDir(base), false);
});
test('writeFileEnsured creates parent dirs', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-'));
  const target = join(base, 'a', 'b', 'c.txt');
  await writeFileEnsured(target, 'data');
  assert.equal(await readFile(target, 'utf8'), 'data');
});
