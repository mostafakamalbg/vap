import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceSessionCondition, parseReportMonth, parseSessionDateRange } from './reportDateFilters.js';

test('parses report month labels and ISO month filters', () => {
  assert.deepEqual(parseReportMonth('October/26'), {
    start: '2026-10-01',
    end: '2026-11-01'
  });
  assert.deepEqual(parseReportMonth('2026-10'), {
    start: '2026-10-01',
    end: '2026-11-01'
  });
  assert.equal(parseReportMonth('2026-13'), null);
});

test('maps English and Bengali sessions to date ranges', () => {
  assert.deepEqual(parseSessionDateRange('January-June 2027'), {
    start: '2027-01-01',
    end: '2027-07-01'
  });
  assert.deepEqual(parseSessionDateRange('জুলাই - ডিসেম্বর 2026'), {
    start: '2026-07-01',
    end: '2027-01-01'
  });
  assert.deepEqual(invoiceSessionCondition('January-June 2027'), {
    $or: [
      { session: 'January-June 2027' },
      { session: 'জানুয়ারি - জুন 2027' },
      { date: { $gte: '2027-01-01', $lt: '2027-07-01' } }
    ]
  });
});
