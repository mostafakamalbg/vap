import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrganizationCounts } from './public-dashboard.js';
import { ADMIN_ROLE, LOGISTIC_OFFICER_ROLE, SO_ROLE } from '../shared/roles.js';

test('organization counts include roster staff and deduplicate matching officer accounts', () => {
  const counts = getOrganizationCounts([
    { _id: 'user-so', role: SO_ROLE, officerCode: 'SO-05' },
    { _id: 'user-admin', role: ADMIN_ROLE },
    { _id: 'user-logistic', role: LOGISTIC_OFFICER_ROLE, officerId: 'LOG-01' }
  ], 12, [
    { recordId: 'SO-05', data: { id: 'SO-05', code: '5', designation: 'সেলস অফিসার (SO)' } },
    { recordId: 'LOG-01', data: { id: 'LOG-01', designation: 'Logistic Officer' } }
  ]);

  assert.deepEqual(counts, {
    employees: 3,
    officers: 1,
    dealers: 12,
    logisticOfficers: 1
  });
});

test('organization counts return clean zero values for empty collections', () => {
  assert.deepEqual(getOrganizationCounts([], 0, []), {
    employees: 0,
    officers: 0,
    dealers: 0,
    logisticOfficers: 0
  });
});
