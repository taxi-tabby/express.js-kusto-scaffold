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

test('backend-only scaffold: prunes react, no react files', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-int-'));
  const target = join(base, 'my-app');
  const code = await run([target, '-y', '--no-install', '--no-git'], { downloader: makeFakeDownloader(), runner: noopRunner });
  assert.equal(code, 0);
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-app');
  assert.equal(pkg.dependencies.react, undefined);
  assert.equal(await exists(join(target, '.env')), true);
  assert.equal(await exists(join(target, 'src/app/extensions/react.ts')), false);
});

test('react scaffold: keeps react deps and writes sample page', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-int-'));
  const target = join(base, 'react-app');
  const code = await run([target, '-y', '--react', '--no-install', '--no-git'], { downloader: makeFakeDownloader(), runner: noopRunner });
  assert.equal(code, 0);
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.react, '^19.2.7');
  assert.equal(await exists(join(target, 'src/app/views/Home.tsx')), true);
  assert.equal(await exists(join(target, 'src/app/routes/app/route.ts')), true);
});

test('non-empty target dir is rejected', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cka-int-'));
  const target = join(base, 'taken');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'x.txt'), 'hi');
  const code = await run([target, '-y', '--no-install', '--no-git'], { downloader: makeFakeDownloader(), runner: noopRunner });
  assert.equal(code, 1);
});
