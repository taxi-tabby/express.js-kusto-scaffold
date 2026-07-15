// src/versions.js — resolve the latest published version of an npm package.

const REGISTRY = 'https://registry.npmjs.org';

// Returns the latest published version string for `name`, or null on any failure
// (unknown package, non-2xx response, network error, timeout, malformed body).
// Callers treat null as "keep whatever version we already have", so a registry
// outage or offline machine never breaks scaffolding. `fetchImpl` is injectable
// for tests; production uses the global fetch (Node >= 20).
export async function resolveLatest(name, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(`${REGISTRY}/${name}/latest`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}
