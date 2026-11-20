import assert from 'node:assert/strict';
import test from 'node:test';
import handler from './index.js';

test('API route errors always include a JSON error message', async () => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return body;
    }
  };

  await handler({
    query: { __path: 'missing-route' },
    headers: {}
  }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    error: 'Not Found',
    success: false,
    message: 'Not Found'
  });
});
