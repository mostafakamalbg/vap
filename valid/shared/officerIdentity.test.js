import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeOfficerRecords, officerRecordsMatch } from './officerIdentity.js';

test('officer records with matching code or ID merge without duplicate names', () => {
  const officers = mergeOfficerRecords([
    { id: 'user-1', code: 'SO-01', name: 'Officer One' },
    { officerId: 'user-1', officerCode: 'SO-01', officerName: 'Officer One', salesTargets: { '2026 session': 10 } },
    { id: 'legacy-1', code: 'SO-01', name: 'Officer One', salesTargets: { '2027 session': 20 } }
  ]);

  assert.equal(officers.length, 1);
  assert.equal(officers[0].id, 'user-1');
  assert.equal(officers[0].salesTargets['2026 session'], 10);
  assert.equal(officers[0].salesTargets['2027 session'], 20);
});

test('same-name officers with separate identifiers remain distinct', () => {
  const officers = mergeOfficerRecords([
    { id: 'user-1', name: 'Same Name' },
    { id: 'user-2', name: 'Same Name' }
  ]);

  assert.equal(officers.length, 2);
});

test('officer matching resolves account IDs, officer IDs, codes, and normalized names', () => {
  assert.equal(officerRecordsMatch(
    { _id: 'account-1', officerCode: 'SO-01', officerName: '  SALES   Officer ' },
    { userId: 'account-1', code: 'SO-01', name: 'Sales Officer' }
  ), true);
  assert.equal(officerRecordsMatch(
    { officerId: 'OFF-01', officerName: 'Sales Officer' },
    { id: 'OFF-01', name: 'Other Name' }
  ), true);
  assert.equal(officerRecordsMatch(
    { name: '  Sales   Officer ' },
    { officerName: 'sales officer' }
  ), true);
  assert.equal(officerRecordsMatch(
    { id: 'account-1', name: 'Sales Officer' },
    { id: 'account-2', name: 'Sales Officer' }
  ), false);
});

test('createdBy is a fallback identity and owner names match when an ID is absent', () => {
  assert.equal(officerRecordsMatch(
    { createdBy: 'account-1' },
    { _id: 'account-1', name: 'Sales Officer' }
  ), true);
  assert.equal(officerRecordsMatch(
    { officerName: 'Sales Officer' },
    { officerId: 'OFF-01', name: 'sales officer' }
  ), true);
  assert.equal(officerRecordsMatch(
    { officerId: 'OFF-02', createdBy: 'account-1', officerName: 'Sales Officer' },
    { officerId: 'OFF-01', name: 'Sales Officer' }
  ), false);
});

test('merging user and officer records preserves display capitalization and target data', () => {
  const [officer] = mergeOfficerRecords([
    { _id: 'account-1', name: 'Sales Officer', officerCode: 'SO-01' },
    { userId: 'account-1', officerName: 'SALES OFFICER', salesTargets: { 'জুলাই - ডিসেম্বর 2026': 10 } }
  ]);

  assert.equal(officer.name, 'Sales Officer');
  assert.equal(officer.salesTargets['জুলাই - ডিসেম্বর 2026'], 10);
});
