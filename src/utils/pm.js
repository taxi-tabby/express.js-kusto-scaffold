export function detectPackageManager(userAgent = process.env.npm_config_user_agent) {
  if (typeof userAgent === 'string') {
    if (userAgent.startsWith('pnpm')) return 'pnpm';
    if (userAgent.startsWith('yarn')) return 'yarn';
  }
  return 'npm';
}
