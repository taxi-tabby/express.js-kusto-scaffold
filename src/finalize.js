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
