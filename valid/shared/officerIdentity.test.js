import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeOfficerRecords } from './officerIdentity.js';

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
