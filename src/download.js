import { downloadTemplate } from 'giget';

export const TEMPLATE_REPO = 'github:taxi-tabby/express.js-kusto';

export async function download(ctx, downloader = downloadTemplate) {
  const source = `${TEMPLATE_REPO}#${ctx.ref}`;
  await downloader(source, { dir: ctx.targetDir, force: true });
}
