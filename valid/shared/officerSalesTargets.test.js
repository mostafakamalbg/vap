import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOfficerSalesTarget,
  hasOfficerSessionSalesTarget,
  mergeOfficerSalesTargets
} from './officerSalesTargets.js';

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

test('officer target fields override defaults for Bengali and English session labels', () => {
  const officer = {
    code: '5',
    salesTargetJulyDec2026: 1200000.4,
    salesTargetJanJune2027: 5400000.4
  };
  assert.equal(getOfficerSalesTarget(officer, 'July-December 2026'), 1200000);
  assert.equal(getOfficerSalesTarget(officer, 'January-June 2027'), 5400000);
  assert.equal(getOfficerSalesTarget({ ...officer, salesTargetJanJune2027: 0 }, 'January-June 2027'), 0);
});

test('dynamic session targets override legacy session defaults', () => {
  const officer = {
    code: '05',
    salesTargetJanJune2027: 5400000,
    salesTargets: { 'জানুয়ারি - জুন 2027': 6100000 }
  };
  assert.equal(getOfficerSalesTarget(officer, 'January-June 2027'), 6100000);
});

test('officer target lock is scoped to explicitly saved values, including zero', () => {
  assert.equal(hasOfficerSessionSalesTarget({
    salesTargets: { 'জুলাই - ডিসেম্বর 2026': 0 }
  }, 'জুলাই - ডিসেম্বর 2026'), true);
  assert.equal(hasOfficerSessionSalesTarget({ code: 'SO-05' }, 'জুলাই - ডিসেম্বর 2026'), false);
  assert.equal(hasOfficerSessionSalesTarget({ code: 'SO-99' }, 'জুলাই - ডিসেম্বর 2026'), false);
  assert.equal(hasOfficerSessionSalesTarget({
    salesTargets: { 'জানুয়ারি - জুন 2027': 250 }
  }, 'January-June 2027'), true);
  assert.equal(hasOfficerSessionSalesTarget({
    salesTargetJulyDec2026: 250
  }, 'জুলাই - ডিসেম্বর 2026'), true);
});

test('updating other officer fields does not discard saved session targets', () => {
  const existing = { 'জুলাই - ডিসেম্বর 2026': 1200000 };
  assert.deepEqual(mergeOfficerSalesTargets(existing), existing);
  assert.deepEqual(
    mergeOfficerSalesTargets(existing, { 'জানুয়ারি - জুন 2027': 2400000 }),
    {
      'জুলাই - ডিসেম্বর 2026': 1200000,
      'জানুয়ারি - জুন 2027': 2400000
    }
  );
});
