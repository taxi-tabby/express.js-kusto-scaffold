# create-kusto-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prepare for npm publish a `create-kusto-app` scaffolder that creates a new Express.js-Kusto project from the upstream backend template and optionally applies the React extension.

**Architecture:** A thin ESM Node CLI. `bin/cli.js` → `src/index.js#run()` which: parses argv (`cli.js`), prompts for anything missing (`prompts`), downloads the base template via `giget` (`download.js`), rewrites `package.json` + copies `.env` + prunes/keeps React deps (`transform.js`), runs each selected extension's `apply()` from a registry (`extensions/`), then optionally `git init` + installs deps (`finalize.js`). Pure logic (arg parse, package.json rewrite, dep prune, applier file-writes) is isolated and unit-tested; the downloader and command-runner are injectable so the orchestrator is testable offline.

**Tech Stack:** Node ≥ 20 (ESM), `prompts`, `picocolors`, `giget`. Tests use the built-in `node:test` runner + `node:assert/strict` (zero extra test deps).

## Global Constraints

- Package name: `create-kusto-app` (publish public to npm).
- `package.json`: `"type": "module"`, `"bin": { "create-kusto-app": "bin/cli.js" }`, `"engines": { "node": ">=20" }`, `"files": ["bin", "src", "README.md"]`.
- Runtime dependencies limited to: `prompts`, `picocolors`, `giget`. No other runtime deps.
- Tests use only `node:test` + `node:assert/strict`. Run with `node --test`.
- Upstream template source: `github:taxi-tabby/express.js-kusto`, default ref `main`.
- React dependency keys to prune when React is NOT selected: `react`, `react-dom`, `react-router-dom`, `lucide-react`, `@expressjs-kusto/react`.
- React activation import: `import { react } from '@expressjs-kusto/react'` (named export; factory accepts `ReactExtensionOptions`). Type augmentation lives at `@expressjs-kusto/react/augment`.
- Rewritten project `package.json`: `version` → `0.1.0`, `author` → `""`, `name` → project name; keep `license`.
- No `Co-Authored-By` trailer in commits (user global rule).
- Commit after every task.

---

### Task 1: Project skeleton + CLI entry (version/help)

**Files:**
- Create: `package.json`
- Create: `bin/cli.js`
- Create: `src/index.js`
- Create: `src/cli.js`
- Create: `.gitignore`
- Test: `test/cli-parse.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/cli.js` → `export function parseArgs(argv: string[]): Options` where
    `Options = { targetDir: string|null, projectName: string|null, react: boolean|null, install: boolean, git: boolean, pm: 'npm'|'pnpm'|'yarn'|null, ref: string, yes: boolean, help: boolean, version: boolean }`.
  - `src/index.js` → `export async function run(argv: string[], deps?: { downloader?, runner? }): Promise<number>` (exit code). Task 1 only implements the `--help`/`--version` short-circuit; later tasks extend it.

- [ ] **Step 1: Write the failing test**

```js
// test/cli-parse.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli-parse.test.js`
Expected: FAIL — `Cannot find module '../src/cli.js'`.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "create-kusto-app",
  "version": "0.1.0",
  "description": "Scaffold a new Express.js-Kusto project.",
  "type": "module",
  "bin": { "create-kusto-app": "bin/cli.js" },
  "files": ["bin", "src", "README.md"],
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test"
  },
  "keywords": ["kusto", "express", "scaffold", "create", "typescript"],
  "license": "ISC",
  "author": "rkdmf0000@gmail.com",
  "dependencies": {
    "giget": "^1.2.3",
    "picocolors": "^1.1.1",
    "prompts": "^2.4.2"
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
*.log
.DS_Store
```

- [ ] **Step 5: Implement `src/cli.js`**

```js
// src/cli.js
const PM_VALUES = new Set(['npm', 'pnpm', 'yarn']);

export function parseArgs(argv) {
  const o = {
    targetDir: null,
    projectName: null,
    react: null,
    install: true,
    git: true,
    pm: null,
    ref: 'main',
    yes: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--react': o.react = true; break;
      case '--no-install': o.install = false; break;
      case '--no-git': o.git = false; break;
      case '--pm': {
        const v = argv[++i];
        if (!PM_VALUES.has(v)) throw new Error(`--pm must be one of npm|pnpm|yarn, got: ${v}`);
        o.pm = v;
        break;
      }
      case '--ref': o.ref = argv[++i]; break;
      case '-y':
      case '--yes': o.yes = true; break;
      case '-h':
      case '--help': o.help = true; break;
      case '-v':
      case '--version': o.version = true; break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
        if (o.targetDir === null) o.targetDir = a;
        else throw new Error(`Unexpected argument: ${a}`);
    }
  }
  return o;
}

export const HELP_TEXT = `
create-kusto-app — scaffold a new Express.js-Kusto project

Usage:
  create-kusto-app [directory] [options]

Options:
  --react               enable the React extension
  --no-install          skip dependency installation
  --no-git              skip git initialization
  --pm <npm|pnpm|yarn>  force a package manager (default: auto-detect)
  --ref <branch|tag>    template git ref to download (default: main)
  -y, --yes             accept all defaults, no prompts
  -h, --help            show this help
  -v, --version         print version
`;
```

- [ ] **Step 6: Implement `src/index.js` (help/version only for now)**

```js
// src/index.js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs, HELP_TEXT } from './cli.js';

async function readVersion() {
  const pkgUrl = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(await readFile(fileURLToPath(pkgUrl), 'utf8'));
  return pkg.version;
}

export async function run(argv, deps = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return 1;
  }

  if (options.help) { process.stdout.write(HELP_TEXT); return 0; }
  if (options.version) { process.stdout.write(`${await readVersion()}\n`); return 0; }

  // Extended in later tasks.
  process.stdout.write('Not yet implemented\n');
  return 0;
}
```

- [ ] **Step 7: Implement `bin/cli.js`**

```js
#!/usr/bin/env node
import { run } from '../src/index.js';

const MIN_MAJOR = 20;
const major = Number(process.versions.node.split('.')[0]);
if (major < MIN_MAJOR) {
  process.stderr.write(`create-kusto-app requires Node >= ${MIN_MAJOR} (found ${process.versions.node}).\n`);
  process.exit(1);
}

run(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
```

- [ ] **Step 8: Run tests + manual smoke**

Run: `node --test test/cli-parse.test.js`
Expected: PASS (3 tests).
Run: `node bin/cli.js --version`
Expected: prints `0.1.0`.
Run: `node bin/cli.js --help`
Expected: prints usage text.

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore bin/cli.js src/cli.js src/index.js test/cli-parse.test.js
git commit -m "feat: CLI skeleton with arg parsing, help and version"
```

---

### Task 2: Utilities (package-manager detection, fs helpers, logger)

**Files:**
- Create: `src/utils/pm.js`
- Create: `src/utils/fs.js`
- Create: `src/utils/log.js`
- Test: `test/pm.test.js`
- Test: `test/fs.test.js`

**Interfaces:**
- Produces:
  - `src/utils/pm.js` → `export function detectPackageManager(userAgent?: string): 'npm'|'pnpm'|'yarn'` (default arg `process.env.npm_config_user_agent`; falls back to `'npm'`).
  - `src/utils/fs.js` → `export async function isEmptyDir(dir: string): Promise<boolean>` (true if dir does not exist or has no entries); `export async function writeFileEnsured(file: string, content: string): Promise<void>` (creates parent dirs).
  - `src/utils/log.js` → `export const log` with methods `info(msg)`, `success(msg)`, `warn(msg)`, `error(msg)`, `step(msg)` writing to stdout/stderr with picocolors.

- [ ] **Step 1: Write the failing tests**

```js
// test/pm.test.js
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
```

```js
// test/fs.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/pm.test.js test/fs.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/utils/pm.js`**

```js
// src/utils/pm.js
export function detectPackageManager(userAgent = process.env.npm_config_user_agent) {
  if (typeof userAgent === 'string') {
    if (userAgent.startsWith('pnpm')) return 'pnpm';
    if (userAgent.startsWith('yarn')) return 'yarn';
  }
  return 'npm';
}
```

- [ ] **Step 4: Implement `src/utils/fs.js`**

```js
// src/utils/fs.js
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function isEmptyDir(dir) {
  try {
    const entries = await readdir(dir);
    return entries.length === 0;
  } catch (err) {
    if (err.code === 'ENOENT') return true;
    throw err;
  }
}

export async function writeFileEnsured(file, content) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}
```

- [ ] **Step 5: Implement `src/utils/log.js`**

```js
// src/utils/log.js
import pc from 'picocolors';

export const log = {
  info: (msg) => process.stdout.write(`${msg}\n`),
  success: (msg) => process.stdout.write(`${pc.green('✓')} ${msg}\n`),
  warn: (msg) => process.stderr.write(`${pc.yellow('!')} ${msg}\n`),
  error: (msg) => process.stderr.write(`${pc.red('✗')} ${msg}\n`),
  step: (msg) => process.stdout.write(`${pc.cyan('›')} ${msg}\n`),
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/pm.test.js test/fs.test.js`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/utils test/pm.test.js test/fs.test.js
git commit -m "feat: pm detection, fs helpers, and logger utilities"
```

---

### Task 3: Transform (rename package.json, copy .env, prune React deps)

**Files:**
- Create: `src/transform.js`
- Test: `test/transform.test.js`

**Interfaces:**
- Consumes: `writeFileEnsured` is not needed here (operates on existing tree).
- Produces:
  - `src/transform.js` → `export const REACT_DEP_KEYS: string[]`.
  - `export function rewritePackageJson(pkg: object, projectName: string): object` — pure; returns a new object with `name`, `version='0.1.0'`, `author=''`, other keys preserved.
  - `export function pruneReactDeps(pkg: object): object` — pure; returns a new object whose `dependencies` has the `REACT_DEP_KEYS` removed.
  - `export async function transform(ctx: { targetDir: string, projectName: string, extensions: string[] }): Promise<void>` — reads `<targetDir>/package.json`, applies `rewritePackageJson`, and (when `!extensions.includes('react')`) `pruneReactDeps`; writes it back with 2-space indent + trailing newline. Copies `<targetDir>/.env.template` → `<targetDir>/.env` if the template exists.

- [ ] **Step 1: Write the failing test**

```js
// test/transform.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/transform.test.js`
Expected: FAIL — `../src/transform.js` not found.

- [ ] **Step 3: Implement `src/transform.js`**

```js
// src/transform.js
import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export const REACT_DEP_KEYS = ['react', 'react-dom', 'react-router-dom', 'lucide-react', '@expressjs-kusto/react'];

export function rewritePackageJson(pkg, projectName) {
  return { ...pkg, name: projectName, version: '0.1.0', author: '' };
}

export function pruneReactDeps(pkg) {
  const dependencies = { ...(pkg.dependencies ?? {}) };
  for (const key of REACT_DEP_KEYS) delete dependencies[key];
  return { ...pkg, dependencies };
}

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function transform(ctx) {
  const pkgPath = join(ctx.targetDir, 'package.json');
  let pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  pkg = rewritePackageJson(pkg, ctx.projectName);
  if (!ctx.extensions.includes('react')) pkg = pruneReactDeps(pkg);
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const envTemplate = join(ctx.targetDir, '.env.template');
  if (await fileExists(envTemplate)) {
    await copyFile(envTemplate, join(ctx.targetDir, '.env'));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/transform.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/transform.js test/transform.test.js
git commit -m "feat: transform — rename package.json, copy .env, prune React deps"
```

---

### Task 4: Extension registry + React applier

**Files:**
- Create: `src/extensions/registry.js`
- Create: `src/extensions/react.js`
- Test: `test/react-applier.test.js`

**Interfaces:**
- Consumes: `writeFileEnsured` from `src/utils/fs.js`.
- Produces:
  - `src/extensions/react.js` → `export const id = 'react'`, `export const label = 'React frontend (SSR/CSR)'`, `export async function apply(ctx: { targetDir: string, projectName: string }): Promise<void>` — writes the four files below.
  - `src/extensions/registry.js` → `export const extensions: Array<{ id, label, apply }>`, `export function getExtension(id: string)` returning the descriptor or `undefined`.

- [ ] **Step 1: Write the failing test**

```js
// test/react-applier.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/react-applier.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/extensions/react.js`**

```js
// src/extensions/react.js
import { join } from 'node:path';
import { writeFileEnsured } from '../utils/fs.js';

export const id = 'react';
export const label = 'React frontend (SSR/CSR)';

const ACTIVATION = `import { react } from '@expressjs-kusto/react';

// Turns on the React extension: registers router.GET_REACT(...) and SSR/CSR.
// Pages live in src/app/views/ as default-exported components.
export default react({});
`;

const HOME_PAGE = `// src/app/views/Home.tsx — minimal default-exported page (SSR-safe).
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>It works 🎉</h1>
      <p>Your Express.js-Kusto app is rendering React. Edit src/app/views/Home.tsx.</p>
    </main>
  );
}
`;

const APP_CSS = `@import 'tailwindcss';
`;

const SAMPLE_ROUTE = `import { ExpressRouter } from '@lib/http/routing/expressRouter';

const router = new ExpressRouter();

// Serves the React 'Home' page (src/app/views/Home.tsx) at /app.
router.GET_REACT('Home', { title: 'Home' });

export default router.build();
`;

export async function apply(ctx) {
  await writeFileEnsured(join(ctx.targetDir, 'src/app/extensions/react.ts'), ACTIVATION);
  await writeFileEnsured(join(ctx.targetDir, 'src/app/views/Home.tsx'), HOME_PAGE);
  await writeFileEnsured(join(ctx.targetDir, 'src/app/views/app.css'), APP_CSS);
  await writeFileEnsured(join(ctx.targetDir, 'src/app/routes/app/route.ts'), SAMPLE_ROUTE);
}
```

- [ ] **Step 4: Implement `src/extensions/registry.js`**

```js
// src/extensions/registry.js
import * as react from './react.js';

// To add a future extension: import its module and add it here.
export const extensions = [
  { id: react.id, label: react.label, apply: react.apply },
];

export function getExtension(id) {
  return extensions.find((e) => e.id === id);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/react-applier.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/extensions test/react-applier.test.js
git commit -m "feat: extension registry and minimal React applier"
```

---

### Task 5: Download module (giget wrapper, injectable)

**Files:**
- Create: `src/download.js`
- Test: `test/download.test.js`

**Interfaces:**
- Produces:
  - `src/download.js` → `export async function download(ctx: { ref: string, targetDir: string }, downloader?): Promise<void>`. Default `downloader` calls giget's `downloadTemplate(`github:taxi-tabby/express.js-kusto#${ref}`, { dir: targetDir, force: true })`. The injectable `downloader(source, opts)` seam lets tests run offline.
  - `export const TEMPLATE_REPO = 'github:taxi-tabby/express.js-kusto'`.

- [ ] **Step 1: Write the failing test**

```js
// test/download.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { download, TEMPLATE_REPO } from '../src/download.js';

test('download builds the right giget source + opts and awaits it', async () => {
  const calls = [];
  const fakeDownloader = async (source, opts) => { calls.push({ source, opts }); };
  await download({ ref: 'main', targetDir: '/tmp/x' }, fakeDownloader);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].source, `${TEMPLATE_REPO}#main`);
  assert.equal(calls[0].opts.dir, '/tmp/x');
  assert.equal(calls[0].opts.force, true);
});

test('download propagates downloader errors', async () => {
  const boom = async () => { throw new Error('network down'); };
  await assert.rejects(() => download({ ref: 'main', targetDir: '/tmp/x' }, boom), /network down/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/download.test.js`
Expected: FAIL — `../src/download.js` not found.

- [ ] **Step 3: Implement `src/download.js`**

```js
// src/download.js
import { downloadTemplate } from 'giget';

export const TEMPLATE_REPO = 'github:taxi-tabby/express.js-kusto';

export async function download(ctx, downloader = downloadTemplate) {
  const source = `${TEMPLATE_REPO}#${ctx.ref}`;
  await downloader(source, { dir: ctx.targetDir, force: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/download.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/download.js test/download.test.js
git commit -m "feat: giget download wrapper with injectable downloader"
```

---

### Task 6: Interactive prompts (fill missing options)

**Files:**
- Modify: `src/cli.js` (add `promptMissing`)
- Test: `test/prompt.test.js`

**Interfaces:**
- Consumes: `Options` from `parseArgs`; `extensions` from `src/extensions/registry.js`; `detectPackageManager` from `src/utils/pm.js`.
- Produces:
  - `src/cli.js` → `export async function promptMissing(options: Options, prompter?): Promise<Resolved>` where `Resolved = { targetDir, projectName, extensions: string[], pm, install, git, ref }`. When `options.yes` is true, no prompts run and defaults are used (targetDir required — throw if still null). `prompter` defaults to the `prompts` package and is injected in tests. `projectName` is derived as the basename of `targetDir`. `extensions` = `['react']` when `options.react === true`, `[]` when `options.react === false`, else from the prompt answer.

- [ ] **Step 1: Write the failing test**

```js
// test/prompt.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/prompt.test.js`
Expected: FAIL — `promptMissing` is not exported.

- [ ] **Step 3: Add `promptMissing` to `src/cli.js`**

```js
// append to src/cli.js
import promptsLib from 'prompts';
import { basename } from 'node:path';
import { extensions as registryExtensions } from './extensions/registry.js';
import { detectPackageManager } from './utils/pm.js';

export async function promptMissing(options, prompter = promptsLib) {
  if (options.yes) {
    if (!options.targetDir) throw new Error('Project directory is required with -y. Pass it as the first argument.');
    return {
      targetDir: options.targetDir,
      projectName: basename(options.targetDir),
      extensions: options.react ? ['react'] : [],
      pm: options.pm ?? detectPackageManager(),
      install: options.install,
      git: options.git,
      ref: options.ref,
    };
  }

  const questions = [];
  if (!options.targetDir) {
    questions.push({ type: 'text', name: 'targetDir', message: 'Project directory:', validate: (v) => (v && v.trim() ? true : 'Required') });
  }
  if (options.react === null) {
    questions.push({
      type: 'multiselect', name: 'extensions', message: 'Enable extensions:',
      choices: registryExtensions.map((e) => ({ title: e.label, value: e.id })),
      hint: '- space to select, enter to confirm',
    });
  }
  if (!options.pm) {
    const detected = detectPackageManager();
    questions.push({
      type: 'select', name: 'pm', message: 'Package manager:',
      choices: ['npm', 'pnpm', 'yarn'].map((v) => ({ title: v, value: v })),
      initial: ['npm', 'pnpm', 'yarn'].indexOf(detected),
    });
  }
  questions.push({ type: 'confirm', name: 'install', message: 'Install dependencies now?', initial: options.install });
  questions.push({ type: 'confirm', name: 'git', message: 'Initialize a git repository?', initial: options.git });

  const answers = await prompter(questions);

  const targetDir = options.targetDir ?? answers.targetDir;
  if (!targetDir) throw new Error('Project directory is required.');

  return {
    targetDir,
    projectName: basename(targetDir),
    extensions: options.react === true ? ['react'] : options.react === false ? [] : (answers.extensions ?? []),
    pm: options.pm ?? answers.pm ?? detectPackageManager(),
    install: answers.install ?? options.install,
    git: answers.git ?? options.git,
    ref: options.ref,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/prompt.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cli.js test/prompt.test.js
git commit -m "feat: interactive prompts for missing scaffold options"
```

---

### Task 7: Orchestrator + finalize, wired end-to-end (offline integration test)

**Files:**
- Create: `src/finalize.js`
- Modify: `src/index.js` (full `run` flow)
- Test: `test/integration.test.js`

**Interfaces:**
- Consumes: `promptMissing`, `download`, `transform`, `getExtension`, `isEmptyDir`, `log`.
- Produces:
  - `src/finalize.js` → `export async function finalize(ctx: { targetDir, pm, install, git }, runner?): Promise<void>`. `runner(cmd: string, args: string[], opts: { cwd }) ` defaults to a `spawn`-based promise. Runs `git init` + initial commit when `git`; runs `<pm> install` when `install`. Failures of git/install are logged as warnings, not thrown.
  - `src/index.js` → `run(argv, { downloader?, runner?, prompter? })` now: parse → help/version → `promptMissing` → assert target dir empty → `download` → `transform` → apply each selected extension → `finalize` → print next steps. Returns `0` on success, `1` on handled error.

- [ ] **Step 1: Write the failing integration test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/integration.test.js`
Expected: FAIL — `run` prints "Not yet implemented" / `src/finalize.js` missing.

- [ ] **Step 3: Implement `src/finalize.js`**

```js
// src/finalize.js
import { spawn } from 'node:child_process';
import { log } from './utils/log.js';

function defaultRunner(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))));
  });
}

export async function finalize(ctx, runner = defaultRunner) {
  if (ctx.git) {
    try {
      await runner('git', ['init'], { cwd: ctx.targetDir });
      await runner('git', ['add', '-A'], { cwd: ctx.targetDir });
      await runner('git', ['commit', '-m', 'Initial commit from create-kusto-app'], { cwd: ctx.targetDir });
      log.success('Initialized a git repository.');
    } catch (err) {
      log.warn(`Skipped git init: ${err.message}`);
    }
  }
  if (ctx.install) {
    try {
      await runner(ctx.pm, ['install'], { cwd: ctx.targetDir });
      log.success(`Installed dependencies with ${ctx.pm}.`);
    } catch (err) {
      log.warn(`Dependency install failed: ${err.message}. Run "${ctx.pm} install" manually.`);
    }
  }
}
```

- [ ] **Step 4: Replace the body of `run` in `src/index.js`**

```js
// src/index.js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { parseArgs, HELP_TEXT, promptMissing } from './cli.js';
import { download } from './download.js';
import { transform } from './transform.js';
import { finalize } from './finalize.js';
import { getExtension } from './extensions/registry.js';
import { isEmptyDir } from './utils/fs.js';
import { log } from './utils/log.js';

async function readVersion() {
  const pkgUrl = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(await readFile(fileURLToPath(pkgUrl), 'utf8'));
  return pkg.version;
}

export async function run(argv, deps = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    log.error(err.message);
    return 1;
  }

  if (options.help) { process.stdout.write(HELP_TEXT); return 0; }
  if (options.version) { process.stdout.write(`${await readVersion()}\n`); return 0; }

  try {
    const resolved = await promptMissing(options, deps.prompter);

    if (!(await isEmptyDir(resolved.targetDir))) {
      log.error(`Target directory "${resolved.targetDir}" is not empty.`);
      return 1;
    }

    log.step(`Downloading template into ${resolved.targetDir} ...`);
    await download({ ref: resolved.ref, targetDir: resolved.targetDir }, deps.downloader);

    log.step('Configuring project ...');
    await transform({ targetDir: resolved.targetDir, projectName: resolved.projectName, extensions: resolved.extensions });

    for (const extId of resolved.extensions) {
      const ext = getExtension(extId);
      if (!ext) { log.warn(`Unknown extension "${extId}" — skipped.`); continue; }
      log.step(`Applying extension: ${ext.label} ...`);
      await ext.apply({ targetDir: resolved.targetDir, projectName: resolved.projectName });
    }

    await finalize({ targetDir: resolved.targetDir, pm: resolved.pm, install: resolved.install, git: resolved.git }, deps.runner);

    printNextSteps(resolved);
    return 0;
  } catch (err) {
    log.error(err.message);
    return 1;
  }
}

function printNextSteps(resolved) {
  log.success('Done! Next steps:');
  log.info(`  cd ${resolved.projectName}`);
  if (!resolved.install) log.info(`  ${resolved.pm} install`);
  log.info(`  ${resolved.pm === 'npm' ? 'npm run' : resolved.pm} dev`);
}
```

- [ ] **Step 5: Run the integration test to verify it passes**

Run: `node --test test/integration.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite**

Run: `node --test`
Expected: PASS (all tests across files).

- [ ] **Step 7: Commit**

```bash
git add src/index.js src/finalize.js test/integration.test.js
git commit -m "feat: wire orchestrator end-to-end with finalize and offline integration tests"
```

---

### Task 8: README + publish readiness

**Files:**
- Create: `README.md`
- Modify: `package.json` (add `repository`, `bugs`, `homepage`)

**Interfaces:**
- Consumes: nothing (documentation + metadata).
- Produces: a publish-ready package.

- [ ] **Step 1: Write `README.md`**

````markdown
# create-kusto-app

Scaffold a new [Express.js-Kusto](https://github.com/taxi-tabby/express.js-kusto) project in one command.

## Usage

```bash
npm create kusto-app@latest my-app
# or
npx create-kusto-app my-app
# or
pnpm create kusto-app my-app
# or
yarn create kusto-app my-app
```

You'll be asked for a project directory, which extensions to enable (e.g. React),
your package manager, and whether to install dependencies and initialize git.

## Options

```
create-kusto-app [directory] [options]

  --react               enable the React extension
  --no-install          skip dependency installation
  --no-git              skip git initialization
  --pm <npm|pnpm|yarn>  force a package manager (default: auto-detect)
  --ref <branch|tag>    template git ref to download (default: main)
  -y, --yes             accept all defaults, no prompts
  -h, --help            show help
  -v, --version         print version
```

## What you get

- The Express.js-Kusto backend framework (TypeScript, convention-based routing, multi-DB Prisma, CRUD generator).
- Optionally, a minimal working React page wired through the `@expressjs-kusto/react` extension.

## Requirements

Node.js >= 20.

## License

ISC
````

- [ ] **Step 2: Add publish metadata to `package.json`**

```json
  "repository": { "type": "git", "url": "git+https://github.com/taxi-tabby/express.js-kusto-scaffold.git" },
  "bugs": { "url": "https://github.com/taxi-tabby/express.js-kusto-scaffold/issues" },
  "homepage": "https://github.com/taxi-tabby/express.js-kusto-scaffold#readme",
```

(Insert these keys after `"keywords"` in `package.json`.)

- [ ] **Step 3: Verify the package contents that would publish**

Run: `npm pack --dry-run`
Expected: the tarball lists `bin/`, `src/`, `README.md`, and `package.json` only.

- [ ] **Step 4: Run the full test suite once more**

Run: `node --test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs: README and npm publish metadata"
```

---

## Manual verification (after all tasks)

These require network + a working Node toolchain and are run by a human, not in CI:

1. `node bin/cli.js my-real-app -y --react` — confirm it downloads the real upstream repo,
   prunes nothing (react kept), writes the React sample files, installs, and `git init`s.
2. `cd my-real-app && npm run dev` — confirm the server boots and `/app` renders the React page.
3. `node bin/cli.js my-backend -y --no-install --no-git` — confirm React deps are pruned and
   no `src/app/extensions/react.ts` exists.
4. Verify the generated `src/app/extensions/react.ts` import (`@expressjs-kusto/react`) and the
   `react({})` call match the installed package's actual exports; adjust the applier template if
   the published API differs.

## Notes / open risks

- **React activation API:** the applier writes `import { react } from '@expressjs-kusto/react'`
  and `export default react({})`. This matches the published `@expressjs-kusto/react@0.5.x`
  named export. Manual verification step 4 confirms against the real package before publish.
- **`giget` ref:** defaults to `main`. If upstream tags releases, consider defaulting `--ref` to
  the latest tag in a future iteration.
- **Partial-directory rollback (deferred):** the spec calls for cleaning up a directory the tool
  created if download fails mid-way. The empty-dir guard (Task 7) already prevents clobbering
  existing content, so the only residue is a freshly-created, partially-populated dir on a network
  failure. Automatic `rm -rf` of that dir is intentionally deferred: it is risky when the target is
  `.` or a pre-existing path, and the failure message tells the user the directory to remove. Revisit
  once the tool tracks whether it created the directory.
```
