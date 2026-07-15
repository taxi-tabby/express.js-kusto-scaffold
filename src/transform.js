import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { log } from './utils/log.js';

export const REACT_DEP_KEYS = ['react', 'react-dom', 'react-router-dom', 'lucide-react', '@expressjs-kusto/react'];

export function rewritePackageJson(pkg, projectName) {
  return { ...pkg, name: projectName, version: '0.1.0', author: '' };
}

export function pruneReactDeps(pkg) {
  const dependencies = { ...(pkg.dependencies ?? {}) };
  for (const key of REACT_DEP_KEYS) delete dependencies[key];
  return { ...pkg, dependencies };
}

// Caret-pins every React dependency present in `pkg` to its latest published
// version. `resolveLatest(name)` returns the latest version or null; a null
// (offline, registry down, unknown package) keeps the template's version so the
// scaffold never fails. Only keys already in the template are touched.
export async function applyLatestReactVersions(pkg, resolveLatest) {
  const dependencies = { ...(pkg.dependencies ?? {}) };
  const targets = REACT_DEP_KEYS.filter((key) => key in dependencies);
  const safeResolve = async (name) => {
    try { return await resolveLatest(name); } catch { return null; }
  };
  const resolved = await Promise.all(targets.map(async (key) => [key, await safeResolve(key)]));
  const fellBack = [];
  for (const [key, version] of resolved) {
    if (version) dependencies[key] = `^${version}`;
    else fellBack.push(key);
  }
  if (fellBack.length) {
    log.warn(`Could not fetch latest version for ${fellBack.join(', ')}; kept template versions.`);
  }
  return { ...pkg, dependencies };
}

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function transform(ctx, { resolveLatest } = {}) {
  const pkgPath = join(ctx.targetDir, 'package.json');
  let pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  pkg = rewritePackageJson(pkg, ctx.projectName);
  if (ctx.extensions.includes('react')) {
    if (resolveLatest) pkg = await applyLatestReactVersions(pkg, resolveLatest);
  } else {
    pkg = pruneReactDeps(pkg);
  }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const envTemplate = join(ctx.targetDir, '.env.template');
  if (await fileExists(envTemplate)) {
    await copyFile(envTemplate, join(ctx.targetDir, '.env'));
  }
}
