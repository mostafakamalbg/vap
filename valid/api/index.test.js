import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { getApiErrorResponse } from './index.js';
import { MongoConnectionError } from '../lib/mongodb.js';

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

test('API handler maps connection failures to a retryable service error', () => {
  const response = getApiErrorResponse(new MongoConnectionError(new Error('private connection detail')));

  assert.deepEqual(response, {
    statusCode: 503,
    message: 'Database is temporarily unavailable.'
  });
});

test('API handler maps invalid Mongo identifiers to a client error', () => {
  const response = getApiErrorResponse({ name: 'CastError', message: 'private cast detail' });

  assert.deepEqual(response, {
    statusCode: 400,
    message: 'Request data is invalid.'
  });
});
