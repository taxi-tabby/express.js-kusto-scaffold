import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rewritePackageJson, pruneReactDeps, REACT_DEP_KEYS, transform } from '../src/transform.js';

const basePkg = () => ({
  name: 'kusto-server',
  version: '0.2.6',
  author: 'someone@example.com',
  license: 'ISC',
  dependencies: { express: '^4.18.3', react: '^19.2.7', 'react-dom': '^19.2.7', 'react-router-dom': '^7.18.0', 'lucide-react': '^1.21.0', '@expressjs-kusto/react': '^0.5.0' },
});

test('rewritePackageJson sets name/version/author, keeps the rest', () => {
  const out = rewritePackageJson(basePkg(), 'my-app');
  assert.equal(out.name, 'my-app');
  assert.equal(out.version, '0.1.0');
  assert.equal(out.author, '');
  assert.equal(out.license, 'ISC');
  assert.equal(out.dependencies.express, '^4.18.3');
});

test('pruneReactDeps removes exactly the React keys', () => {
  const out = pruneReactDeps(basePkg());
  for (const k of REACT_DEP_KEYS) assert.equal(out.dependencies[k], undefined);
  assert.equal(out.dependencies.express, '^4.18.3');
});

test('transform backend-only: prunes react, renames, copies env', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cka-tf-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify(basePkg()));
  await writeFile(join(dir, '.env.template'), 'PORT=3000\n');
  await transform({ targetDir: dir, projectName: 'my-app', extensions: [] });
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-app');
  assert.equal(pkg.dependencies.react, undefined);
  assert.equal(await readFile(join(dir, '.env'), 'utf8'), 'PORT=3000\n');
});

test('transform with react: keeps react deps', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cka-tf-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify(basePkg()));
  await transform({ targetDir: dir, projectName: 'my-app', extensions: ['react'] });
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.react, '^19.2.7');
});
