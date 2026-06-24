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
