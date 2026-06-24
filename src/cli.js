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
