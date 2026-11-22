import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVOICE_SESSIONS,
  isCurrentSession,
  sortSessionsNewestFirst
} from './sessions.js';

test('session filters start at July-December 2025 and sort newest first', () => {
  assert.equal(INVOICE_SESSIONS.at(-1), 'জুলাই - ডিসেম্বর 2025');
  assert.equal(INVOICE_SESSIONS.some((session) => !isCurrentSession(session)), false);
  assert.equal(isCurrentSession('জানুয়ারি - জুন 2025'), false);
  assert.deepEqual(sortSessionsNewestFirst([
    'জুলাই - ডিসেম্বর 2025',
    'January-June 2027',
    'জানুয়ারি - জুন 2026',
    'জুলাই - ডিসেম্বর 2026'
  ]), [
    'January-June 2027',
    'জুলাই - ডিসেম্বর 2026',
    'জানুয়ারি - জুন 2026',
    'জুলাই - ডিসেম্বর 2025'
  ]);
});
