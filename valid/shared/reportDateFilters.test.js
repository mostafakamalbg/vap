import assert from 'node:assert/strict';
import test from 'node:test';
import {
  invoiceSessionCondition,
  parseReportMonth,
  parseSessionDateRange,
  sessionPrimaryCondition,
  sessionsMatch
} from './reportDateFilters.js';

test('parses report month labels and ISO month filters', () => {
  assert.deepEqual(parseReportMonth('October/26'), {
    start: '2026-10-01',
    end: '2026-11-01'
  });
  assert.deepEqual(parseReportMonth('2026-10'), {
    start: '2026-10-01',
    end: '2026-11-01'
  });
  assert.deepEqual(parseReportMonth('October 2026'), {
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

test('session-priority filters only use the date range for legacy session values', () => {
  assert.deepEqual(sessionPrimaryCondition('January-June 2027'), {
    $or: [
      {
        session: {
          $in: [
            'January-June 2027',
            'জানুয়ারি - জুন 2027',
            'January - June 2027'
          ]
        }
      },
      {
        $and: [
          { session: { $in: ['', null, 'সেশন নির্ধারিত নয়'] } },
          { date: { $gte: '2027-01-01', $lt: '2027-07-01' } }
        ]
      }
    ]
  });
});

test('matches equivalent English and Bengali session labels', () => {
  assert.equal(sessionsMatch('January-June 2027', 'জানুয়ারি - জুন ২০২৭'), true);
  assert.equal(sessionsMatch('July-December 2026', 'জুলাই - ডিসেম্বর ২০২৬'), true);
  assert.equal(sessionsMatch('January-June 2027', 'July-December 2027'), false);
});
