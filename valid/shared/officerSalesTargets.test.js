import assert from 'node:assert/strict';
import test from 'node:test';
import { getOfficerSalesTarget } from './officerSalesTargets.js';

const sessions = [
  {
    name: 'July-December 2026',
    session: 'জুলাই - ডিসেম্বর 2026',
    targets: {
      'SO-05': 2500000,
      'SO-09': 3000000,
      'SO-07': 1500000,
      'SO-04': 1000000
    }
  },
  {
    name: 'January-June 2027',
    session: 'জানুয়ারি - জুন 2027',
    targets: {
      'SO-05': 9000000,
      'SO-09': 8000000,
      'SO-07': 3500000,
      'SO-04': 3000000
    }
  }
];

test('officer targets match the provided values for each session', () => {
  sessions.forEach(({ session, targets }) => {
    Object.entries(targets).forEach(([code, target]) => {
      assert.equal(getOfficerSalesTarget({ code }, session), target);
    });
  });
});

test('officer targets can be totaled across sessions and unknown officers default to zero', () => {
  assert.equal(getOfficerSalesTarget({ code: '5' }), 11500000);
  assert.equal(getOfficerSalesTarget({ code: '99' }, 'জুলাই - ডিসেম্বর 2026'), 0);
});
