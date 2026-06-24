#!/usr/bin/env node
import { run } from '../src/index.js';

const MIN_MAJOR = 20;
const major = Number(process.versions.node.split('.')[0]);
if (major < MIN_MAJOR) {
  process.stderr.write(`create-kusto-app requires Node >= ${MIN_MAJOR} (found ${process.versions.node}).\n`);
  process.exit(1);
}

run(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
