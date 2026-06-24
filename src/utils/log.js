import pc from 'picocolors';

export const log = {
  info: (msg) => process.stdout.write(`${msg}\n`),
  success: (msg) => process.stdout.write(`${pc.green('✓')} ${msg}\n`),
  warn: (msg) => process.stderr.write(`${pc.yellow('!')} ${msg}\n`),
  error: (msg) => process.stderr.write(`${pc.red('✗')} ${msg}\n`),
  step: (msg) => process.stdout.write(`${pc.cyan('›')} ${msg}\n`),
};
