# create-kusto-app — Scaffolder Design

- **Date:** 2026-06-24
- **Status:** Approved (design)
- **Repo:** `express.js-kusto-scaffold` (this repo)
- **Upstream template:** [`taxi-tabby/express.js-kusto`](https://github.com/taxi-tabby/express.js-kusto)

## Problem

The Express.js-Kusto framework's adoption is blocked by distribution, not capability.
The shortest path to higher adoption is a one-command bootstrap: `npx create-kusto-app`.
This removes discoverability friction, onboarding friction, and the community entry
barrier in a single move.

## Goal

Ship `create-kusto-app`, an npm-published scaffolder that creates a new Kusto project
from the upstream backend template and optionally configures opt-in extensions (React
now; more later). It must work via every package manager's `create` convention:

- `npx create-kusto-app my-app`
- `npm create kusto-app@latest my-app`
- `pnpm create kusto-app my-app`
- `yarn create kusto-app my-app`

## Key Decisions (from brainstorming)

1. **Always start from the base backend repo**, then *apply* selected extensions on top.
   We do **not** maintain a separate "full" template repo. Rationale: more extensions
   will come, so the scaffolder is an **extension applier**, not a template picker.
   The upstream `express.js-kusto` repo is the single source of truth.
2. **Extension registry structure.** v1 implements only React, but each extension is a
   registry entry `{ id, label, apply(ctx) }`. Adding a future extension = one file +
   one registry line.
3. **Lean backend.** When React is *not* selected, strip the react-family dependencies
   from `package.json` (`react`, `react-dom`, `react-router-dom`, `lucide-react`,
   `@expressjs-kusto/react`). Re-addable later via the extension.
4. **Small, vetted dependencies** for the scaffolder itself: `prompts`, `picocolors`,
   `giget`. ESM, Node ≥ 20.
5. **React applier is intentionally minimal** but produces a working page.
6. **Prompt with sensible defaults:** ask about install / git, both defaulting to Yes;
   provide non-interactive flags.

## Architecture

### Repo layout

```
express.js-kusto-scaffold/
├── package.json          # name=create-kusto-app, bin, type=module, engines.node>=20
├── bin/cli.js            # #!/usr/bin/env node  → imports src/index.js
├── src/
│   ├── index.js          # orchestrator: args → prompts → download → transform → finalize
│   ├── cli.js            # flag parsing + interactive prompts (prompts lib)
│   ├── download.js       # giget download of base template into target dir
│   ├── transform.js      # rename package.json, copy .env, prune/keep react deps
│   ├── finalize.js       # git init + install + next-steps output
│   ├── extensions/
│   │   ├── registry.js   # [{ id, label, apply(ctx) }] — single list of extensions
│   │   └── react.js      # React applier (writes activation + sample page)
│   └── utils/
│       ├── fs.js         # safe write/copy, dir-empty checks
│       ├── pm.js         # package-manager detection (npm/pnpm/yarn)
│       └── log.js        # picocolors-based logger
├── test/
│   ├── transform.test.js
│   ├── react-applier.test.js
│   └── integration.test.js   # runs CLI against a LOCAL fixture tarball (no network)
└── README.md
```

### Units & responsibilities

- **`cli.js`** — parse argv into a normalized `options` object; run interactive prompts
  for anything unset (unless `-y`). Output: `{ targetDir, projectName, extensions[],
  packageManager, install, git, ref }`. Depends on: `prompts`, registry (for the
  extension list).
- **`download.js`** — `download(ref, targetDir)`; wraps `giget`
  (`github:taxi-tabby/express.js-kusto#<ref>`). No `.git` is brought along. Returns when
  the directory is populated. Depends on: `giget`.
- **`transform.js`** — `transform(ctx)`; edits `package.json` (name, version `0.1.0`,
  empty author, keep license), copies `.env.template` → `.env`, and prunes react-family
  deps when React is not among selected extensions. Pure filesystem + JSON; no network.
- **`extensions/registry.js`** — exports an array of extension descriptors. v1: one entry
  for React. Each descriptor: `{ id: 'react', label: 'React frontend (SSR/CSR)',
  apply(ctx) }`.
- **`extensions/react.js`** — `apply(ctx)` writes the activation + minimal working page
  (see below). Does **not** touch deps (they already exist in the base and are kept
  because React was selected).
- **`finalize.js`** — optional `git init` + initial commit; run install with the chosen
  package manager; print colored next-steps.

### Data flow

```
argv ──► cli.js ──► options
                     │
                     ▼
            download.js (giget) ──► targetDir populated
                     │
                     ▼
            transform.js ──► package.json renamed, .env created, deps pruned/kept
                     │
                     ▼
   for each selected ext: registry → ext.apply(ctx)   (ctx = { targetDir, projectName, options })
                     │
                     ▼
            finalize.js ──► git init, install, next steps
```

### CLI surface

```
create-kusto-app [directory] [options]

Options:
  --react               enable the React extension (skips that prompt)
  --no-install          do not run the package install step
  --no-git              do not initialize a git repository
  --pm <npm|pnpm|yarn>  force a package manager (default: auto-detect)
  --ref <branch|tag>    template git ref to download (default: main)
  -y, --yes             accept all defaults, no prompts
  -h, --help            show help
  -v, --version         show version
```

Interactive prompts (only for values not supplied via flags, and only when not `-y`):

1. Project directory / name (validated: non-empty, target empty or creatable).
2. Extensions to enable — multiselect built from the registry (currently just React).
3. Package manager — default = detected.
4. Install dependencies now? (default Yes)
5. Initialize a git repository? (default Yes)

## React applier (minimal, working)

When React is selected, `extensions/react.js#apply(ctx)` creates:

1. **`src/app/extensions/react.ts`** — activation file. Default-exports the React
   `KustoExtension` factory from the installed package.

   > **Implementation must verify** the exact import specifier and factory signature
   > against the published `@expressjs-kusto/react` package's exports before finalizing
   > this file. The extension AGENTS.md shows `@kusto/react`, while `package.json`
   > depends on `@expressjs-kusto/react`; the generated file must match what the
   > installed package actually exports.

2. **`src/app/views/Home.tsx`** — minimal page component with a default export
   (no `window`/`document` at render time, SSR-safe).

3. **`src/app/views/app.css`** — Tailwind v4 entry (single import line; Tailwind compiles
   automatically per the framework's React integration).

4. **A sample route** registering `router.GET_REACT('Home', { title })` so `npm run dev`
   serves a working page immediately.

Kept intentionally simple: one page, one route, one activation file, one css entry.

## Backend-only pruning

When React is not selected, `transform.js` removes these keys from `package.json`
`dependencies` if present: `react`, `react-dom`, `react-router-dom`, `lucide-react`,
`@expressjs-kusto/react`. Nothing in `src/` references React in the base repo (the
`extensions/` folder ships no `react.ts`), so no source edits are required. The base
build/test scripts remain valid (extension build is a no-op with no activations).

## Error handling

- **Node version:** check `process.versions.node` ≥ 20 at startup; clear message + exit.
- **Target directory:** must be empty or non-existent; if not, abort with guidance
  (or prompt to choose another name in interactive mode).
- **Download failure:** surface the network/giget error plainly; do not leave a partial
  directory — clean up a directory the tool created.
- **Install failure:** report it but keep the generated files; tell the user how to run
  install manually.
- **Extension apply failure:** abort with the specific file that failed; clean up.

## Testing strategy

- **Unit — `transform.test.js`:** given a fixture `package.json`, assert name/version
  rewrite, `.env` creation, and correct react-dep pruning (both react-selected and not).
- **Unit — `react-applier.test.js`:** run `apply` against a temp dir seeded with the
  base structure; assert the four files exist with expected key content.
- **Integration — `integration.test.js`:** run the full CLI flow against a **local
  fixture tarball** (no network) by pointing the downloader at a `file:`/local source,
  exercising both backend-only and React paths; assert resulting tree + `package.json`.
- CI runs offline; a network smoke test against real upstream is opt-in (env-gated).

## Distribution

- `package.json`: `name` = `create-kusto-app`, `bin` = `{ "create-kusto-app":
  "bin/cli.js" }`, `type` = `module`, `engines.node` `>=20`, `files` whitelist
  (`bin`, `src`, `README.md`).
- Publish public to npm. The `create-` name prefix makes all package managers' `create`
  shortcuts work automatically.

## Out of scope (v1)

- A separate "full" template repo (explicitly rejected — apply extensions instead).
- Extensions other than React (registry is ready; no implementations yet).
- Database / ORM selection prompts, CI provider choices, deployment config.
- Update/upgrade of an already-scaffolded project.
```
