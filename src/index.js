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
