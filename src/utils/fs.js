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
