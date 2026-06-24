import { join } from 'node:path';
import { writeFileEnsured } from '../utils/fs.js';

export const id = 'react';
export const label = 'React frontend (SSR/CSR)';

const ACTIVATION = `import { react } from '@expressjs-kusto/react';

// Turns on the React extension: registers router.GET_REACT(...) and SSR/CSR.
// Pages live in src/app/views/ as default-exported components.
export default react({});
`;

const HOME_PAGE = `// src/app/views/Home.tsx — minimal default-exported page (SSR-safe).
export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>It works 🎉</h1>
      <p>Your Express.js-Kusto app is rendering React. Edit src/app/views/Home.tsx.</p>
    </main>
  );
}
`;

const APP_CSS = `@import 'tailwindcss';
`;

const SAMPLE_ROUTE = `import { ExpressRouter } from '@lib/http/routing/expressRouter';

const router = new ExpressRouter();

// Serves the React 'Home' page (src/app/views/Home.tsx) at /app.
router.GET_REACT('Home', { title: 'Home' });

export default router.build();
`;

export async function apply(ctx) {
  await writeFileEnsured(join(ctx.targetDir, 'src/app/extensions/react.ts'), ACTIVATION);
  await writeFileEnsured(join(ctx.targetDir, 'src/app/views/Home.tsx'), HOME_PAGE);
  await writeFileEnsured(join(ctx.targetDir, 'src/app/views/app.css'), APP_CSS);
  await writeFileEnsured(join(ctx.targetDir, 'src/app/routes/app/route.ts'), SAMPLE_ROUTE);
}
