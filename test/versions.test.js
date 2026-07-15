import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLatest } from '../src/versions.js';

test('resolveLatest returns the version field on a 200 response', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ version: '19.2.7' }) });
  assert.equal(await resolveLatest('react', fetchImpl), '19.2.7');
});

test('resolveLatest requests the /<name>/latest endpoint (scoped names kept literal)', async () => {
  let calledUrl;
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ version: '0.5.1' }) };
  };
  await resolveLatest('@expressjs-kusto/react', fetchImpl);
  assert.equal(calledUrl, 'https://registry.npmjs.org/@expressjs-kusto/react/latest');
});

test('resolveLatest returns null on a non-2xx response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  assert.equal(await resolveLatest('does-not-exist', fetchImpl), null);
});

test('resolveLatest returns null when fetch throws (offline / timeout)', async () => {
  const fetchImpl = async () => { throw new Error('network down'); };
  assert.equal(await resolveLatest('react', fetchImpl), null);
});

test('resolveLatest returns null when the body has no version field', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  assert.equal(await resolveLatest('react', fetchImpl), null);
});

test('resolveLatest returns null when the version field is not a string', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ version: 19 }) });
  assert.equal(await resolveLatest('react', fetchImpl), null);
});
