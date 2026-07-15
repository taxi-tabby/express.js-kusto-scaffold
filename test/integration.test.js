// test/integration.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/index.js';

// A fake downloader that materializes a minimal base template into targetDir.
function makeFakeDownloader() {
  return async (_source, opts) => {
    const dir = opts.dir;
    await mkdir(join(dir, 'src/app/routes'), { recursive: true });
    const pkg = {
      name: 'kusto-server', version: '0.2.6', author: 'a@b.c', license: 'ISC',
      dependencies: { express: '^4.18.3', react: '^19.2.7', 'react-dom': '^19.2.7', 'react-router-dom': '^7.18.0', 'lucide-react': '^1.21.0', '@expressjs-kusto/react': '^0.5.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
    await writeFile(join(dir, '.env.template'), 'PORT=3000\n');
  };
}

const noopRunner = async () => {};
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// Deterministic stand-in for the npm registry so tests never touch the network.
const fakeLatest = {
  react: '19.5.0', 'react-dom': '19.5.0', 'react-router-dom': '7.9.0',
  'lucide-react': '1.9.0', '@expressjs-kusto/react': '0.9.0',
};
const fakeResolveLatest = async (name) => fakeLatest[name] ?? null;

test('backend-only scaffold: prunes react, no react files', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-int-'));
  const target = join(base, 'my-app');
  const code = await run([target, '-y', '--no-install', '--no-git'], { downloader: makeFakeDownloader(), runner: noopRunner });
  assert.equal(code, 0);
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-app');
  assert.equal(pkg.dependencies.react, undefined);
  assert.equal(await exists(join(target, '.env')), true);
  // react.ts is created ONLY by the react applier (see the react scenario); backend-only must not run it.
  assert.equal(await exists(join(target, 'src/app/extensions/react.ts')), false);
});

test('react scaffold: keeps react deps and writes sample page', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-int-'));
  const target = join(base, 'react-app');
  const code = await run([target, '-y', '--react', '--no-install', '--no-git'], { downloader: makeFakeDownloader(), runner: noopRunner, resolveLatest: fakeResolveLatest });
  assert.equal(code, 0);
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  // React deps are refreshed to the latest published versions (caret-pinned).
  assert.equal(pkg.dependencies.react, '^19.5.0');
  assert.equal(pkg.dependencies['@expressjs-kusto/react'], '^0.9.0');
  assert.equal(await exists(join(target, 'src/app/views/Home.tsx')), true);
  assert.equal(await exists(join(target, 'src/app/routes/app/route.ts')), true);
  // Assert file CONTENT to ensure the react applier actually ran
  assert.equal(await exists(join(target, 'src/app/extensions/react.ts')), true);
  const activation = await readFile(join(target, 'src/app/extensions/react.ts'), 'utf8');
  assert.match(activation, /from '@expressjs-kusto\/react'/);
  const home = await readFile(join(target, 'src/app/views/Home.tsx'), 'utf8');
  assert.match(home, /export default function Home/);
  const route = await readFile(join(target, 'src/app/routes/app/route.ts'), 'utf8');
  assert.match(route, /GET_REACT\('Home'/);
});

test('react scaffold with no injected resolver uses the default npm resolver (real wiring)', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-int-'));
  const target = join(base, 'default-resolver-app');
  const realFetch = globalThis.fetch;
  // Stub the registry so the DEFAULT path (index.js -> versions.js -> fetch) runs offline.
  // This guards the `?? defaultResolveLatest` wiring: without it, production silently stops
  // refreshing versions while every other test stays green.
  globalThis.fetch = async (url) => {
    const m = /registry\.npmjs\.org\/(.+)\/latest$/.exec(url);
    const name = m ? decodeURIComponent(m[1]) : '';
    const version = name === '@expressjs-kusto/react' ? '0.9.0' : '99.0.0';
    return { ok: true, json: async () => ({ version }) };
  };
  try {
    const code = await run([target, '-y', '--react', '--no-install', '--no-git'], { downloader: makeFakeDownloader(), runner: noopRunner });
    assert.equal(code, 0);
    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies.react, '^99.0.0');
    assert.equal(pkg.dependencies['@expressjs-kusto/react'], '^0.9.0');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('non-empty target dir is rejected', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-int-'));
  const target = join(base, 'taken');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'x.txt'), 'hi');
  const code = await run([target, '-y', '--no-install', '--no-git'], { downloader: makeFakeDownloader(), runner: noopRunner });
  assert.equal(code, 1);
});
