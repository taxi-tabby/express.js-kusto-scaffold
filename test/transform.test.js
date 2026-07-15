import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rewritePackageJson, pruneReactDeps, applyLatestReactVersions, REACT_DEP_KEYS, transform } from '../src/transform.js';

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

test('applyLatestReactVersions caret-pins each present react dep to its latest', async () => {
  const latest = {
    react: '19.9.9', 'react-dom': '19.9.9', 'react-router-dom': '7.9.9',
    'lucide-react': '1.9.9', '@expressjs-kusto/react': '0.9.9',
  };
  const out = await applyLatestReactVersions(basePkg(), async (name) => latest[name] ?? null);
  for (const key of REACT_DEP_KEYS) assert.equal(out.dependencies[key], `^${latest[key]}`);
  assert.equal(out.dependencies.express, '^4.18.3'); // non-react deps untouched
});

test('applyLatestReactVersions keeps the template version when the resolver returns null', async () => {
  const out = await applyLatestReactVersions(basePkg(), async () => null);
  assert.equal(out.dependencies.react, '^19.2.7'); // template value preserved on failure
});

test('applyLatestReactVersions survives a resolver that throws for one dep', async () => {
  const out = await applyLatestReactVersions(basePkg(), async (name) => {
    if (name === 'react-dom') throw new Error('boom');
    return '19.9.9';
  });
  assert.equal(out.dependencies.react, '^19.9.9');
  assert.equal(out.dependencies['react-dom'], '^19.2.7'); // thrown dep falls back
});

test('applyLatestReactVersions only touches keys present in the package', async () => {
  const out = await applyLatestReactVersions({ dependencies: { react: '^18.0.0' } }, async () => '19.9.9');
  assert.equal(out.dependencies.react, '^19.9.9');
  assert.equal('react-dom' in out.dependencies, false);
});

test('transform with react + resolver applies latest caret versions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cka-tf-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify(basePkg()));
  await transform(
    { targetDir: dir, projectName: 'my-app', extensions: ['react'] },
    { resolveLatest: async () => '19.9.9' },
  );
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.react, '^19.9.9');
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

test('transform with react but no resolver: keeps template react deps (no network)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cka-tf-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify(basePkg()));
  await transform({ targetDir: dir, projectName: 'my-app', extensions: ['react'] });
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.react, '^19.2.7');
});
