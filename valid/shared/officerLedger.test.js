import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dealerHasOfficerPreviousDue,
  getOfficerPreviousDueByDealer
} from './officerLedger.js';

const officer = {
  officerIds: ['OFF-SO-01'],
  officerCode: 'SO-01'
};

test('previous due history follows its officer and active session/month filters', () => {
  const dealer = {
    id: 'DLR-01',
    officerCode: 'SO-99',
    previousDueHistory: [
      {
        date: '2026-10-01',
        session: 'জুলাই - ডিসেম্বর 2026',
        amount: 100,
        officerId: 'OFF-SO-01',
        postedAt: '2026-10-01T10:00:00.000Z'
      },
      {
        date: '2026-10-14',
        session: 'জুলাই - ডিসেম্বর 2026',
        amount: 240,
        officerId: 'OFF-SO-01',
        postedAt: '2026-10-14T10:00:00.000Z'
      },
      {
        date: '2027-01-03',
        session: 'জানুয়ারি - জুন 2027',
        amount: 300,
        officerId: 'OFF-SO-02',
        postedAt: '2027-01-03T10:00:00.000Z'
      }
    ]
  };

  assert.equal(dealerHasOfficerPreviousDue(dealer, officer), true);
  assert.deepEqual(
    getOfficerPreviousDueByDealer([dealer], officer, {
      session: 'জুলাই - ডিসেম্বর 2026',
      month: '2026-10'
    }).get('DLR-01'),
    {
      amount: 240,
      date: '2026-10-14',
      session: 'জুলাই - ডিসেম্বর 2026',
      officerId: 'OFF-SO-01'
    }
  );
  assert.equal(getOfficerPreviousDueByDealer([dealer], officer, {
    session: 'জানুয়ারি - জুন 2027',
    month: '2027-01'
  }).size, 0);
  assert.equal(getOfficerPreviousDueByDealer([dealer], officer, {
    session: 'ALL',
    month: 'ALL',
    openingBalance: true
  }).get('DLR-01').amount, 100);
});

test('legacy dealer due falls back to assignment and only appears without unsupported period metadata', () => {
  const dealer = {
    id: 'DLR-02',
    officerCode: 'SO-01',
    previousDue: 0,
    lastSessionDue: 450,
    openingDue: 300
  };

  assert.deepEqual(
    getOfficerPreviousDueByDealer([dealer], officer, {}).get('DLR-02'),
    { amount: 450, date: '', session: '', officerId: '' }
  );
  assert.equal(getOfficerPreviousDueByDealer([dealer], officer, {
    openingBalance: true
  }).get('DLR-02').amount, 300);
  assert.equal(getOfficerPreviousDueByDealer([dealer], officer, {
    session: 'জুলাই - ডিসেম্বর 2026',
    month: '2026-10'
  }).size, 0);
});

test('historical officer-owned due includes a dealer that has since been reassigned', () => {
  const dealer = {
    id: 'DLR-03',
    officerCode: 'SO-99',
    previousDue: 250,
    previousDueOfficerId: 'OFF-SO-01',
    previousDueDate: '2026-10-05',
    previousDueSession: 'জুলাই - ডিসেম্বর 2026'
  };

  assert.equal(dealerHasOfficerPreviousDue(dealer, officer), true);
  assert.equal(getOfficerPreviousDueByDealer([dealer], officer, {
    session: 'জুলাই - ডিসেম্বর 2026',
    month: '2026-10'
  }).get('DLR-03').amount, 250);
});

test('explicit session labels take priority over conflicting previous-due dates', () => {
  const dealer = {
    id: 'DLR-04',
    previousDueHistory: [{
      date: '2026-10-05',
      session: 'জানুয়ারি - জুন ২০২৭',
      amount: 350,
      officerId: 'OFF-SO-01'
    }]
  };

  assert.equal(getOfficerPreviousDueByDealer([dealer], officer, {
    session: 'January-June 2027'
  }).get('DLR-04').amount, 350);
  assert.equal(getOfficerPreviousDueByDealer([dealer], officer, {
    session: 'July-December 2026'
  }).size, 0);
});
