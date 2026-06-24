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
