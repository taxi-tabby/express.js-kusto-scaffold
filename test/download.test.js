import { test } from 'node:test';
import assert from 'node:assert/strict';
import { download, TEMPLATE_REPO } from '../src/download.js';

test('download builds the right giget source + opts and awaits it', async () => {
  const calls = [];
  const fakeDownloader = async (source, opts) => { calls.push({ source, opts }); };
  await download({ ref: 'main', targetDir: '/tmp/x' }, fakeDownloader);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].source, `${TEMPLATE_REPO}#main`);
  assert.equal(calls[0].opts.dir, '/tmp/x');
  assert.equal(calls[0].opts.force, true);
});

test('download propagates downloader errors', async () => {
  const boom = async () => { throw new Error('network down'); };
  await assert.rejects(() => download({ ref: 'main', targetDir: '/tmp/x' }, boom), /network down/);
});
