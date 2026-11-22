import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonResponse } from './api.js';

function response({ body, contentType = 'application/json', ok = true }) {
  return {
    ok,
    headers: { get: () => contentType },
    text: async () => body
  };
}

test('JSON API responses are parsed', async () => {
  assert.deepEqual(await readJsonResponse(response({
    body: '{"success":true,"value":0}'
  })), { success: true, value: 0 });
});

test('plain-text API errors surface their message without JSON parsing errors', async () => {
  await assert.rejects(
    readJsonResponse(response({
      body: 'A server error occurred. Please try again.',
      contentType: 'text/plain',
      ok: false
    })),
    { message: 'A server error occurred. Please try again.' }
  );
});

test('HTML and malformed successful responses produce a safe API error', async () => {
  await assert.rejects(
    readJsonResponse(response({
      body: '<html><body>Server error</body></html>',
      contentType: 'text/html',
      ok: false
    })),
    { message: 'অনুরোধ সম্পন্ন করা যায়নি।' }
  );
  await assert.rejects(
    readJsonResponse(response({ body: 'not json' })),
    { message: 'সার্ভার থেকে সঠিক প্রতিক্রিয়া পাওয়া যায়নি।' }
  );
});
