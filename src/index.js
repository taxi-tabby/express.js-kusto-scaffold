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
