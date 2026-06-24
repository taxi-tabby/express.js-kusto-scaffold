import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply, id, label } from '../src/extensions/react.js';
import { extensions, getExtension } from '../src/extensions/registry.js';

test('registry exposes the react extension', () => {
  assert.equal(id, 'react');
  assert.ok(label.length > 0);
  assert.equal(getExtension('react').id, 'react');
  assert.equal(getExtension('nope'), undefined);
  assert.ok(extensions.some((e) => e.id === 'react'));
});

test('apply writes activation + sample page files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cka-react-'));
  await apply({ targetDir: dir, projectName: 'my-app' });

  const activation = await readFile(join(dir, 'src/app/extensions/react.ts'), 'utf8');
  assert.match(activation, /from '@expressjs-kusto\/react'/);
  assert.match(activation, /export default react\(/);

  const home = await readFile(join(dir, 'src/app/views/Home.tsx'), 'utf8');
  assert.match(home, /export default function Home/);

  const css = await readFile(join(dir, 'src/app/views/app.css'), 'utf8');
  assert.match(css, /tailwindcss/);

  const route = await readFile(join(dir, 'src/app/routes/app/route.ts'), 'utf8');
  assert.match(route, /GET_REACT\('Home'/);
  assert.match(route, /export default router\.build\(\)/);
});
