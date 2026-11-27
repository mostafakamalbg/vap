import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOfficerOwnerFilter,
  createHierarchyScope,
  getHierarchyUsers,
  matchesOfficerScope
} from './hierarchy.js';

const users = [
  { _id: 'rsm-1', role: 'RSM', officerId: 'R-1', officerCode: 'RSM-01', name: 'Regional' },
  { _id: 'asm-1', role: 'ASM', rsmId: 'rsm-1', officerId: 'A-1', officerCode: 'ASM-01', name: 'Area' },
  { _id: 'asm-2', role: 'ASM', rsmId: 'rsm-2' },
  { _id: 'so-1', role: 'SO', asmId: 'asm-1', officerId: 'S-1', officerCode: 'SO-01', name: 'Sales' },
  { _id: 'so-2', role: 'officer', asmId: 'asm-2', officerId: 'S-2' }
];

test('RSM and ASM scopes include only self and direct hierarchy descendants', () => {
  assert.deepEqual(
    getHierarchyUsers(users[0], users).map((entry) => entry._id).sort(),
    ['asm-1', 'rsm-1', 'so-1']
  );
  assert.deepEqual(
    getHierarchyUsers(users[1], users).map((entry) => entry._id).sort(),
    ['asm-1', 'so-1']
  );
});

test('hierarchy scope matches owner ids, legacy codes, and owner-name-only records', () => {
  const scope = createHierarchyScope(users[0], users);
  assert.equal(matchesOfficerScope({ officerId: 'S-1' }, scope), true);
  assert.equal(matchesOfficerScope({ officerCode: 'FSO-01' }, scope), true);
  assert.equal(matchesOfficerScope({ officerName: 'Sales' }, scope), true);
  assert.equal(matchesOfficerScope({ officerName: '  sales ' }, scope), true);
  assert.equal(matchesOfficerScope({ hierarchyUserId: 'so-1' }, scope), true);
  assert.equal(matchesOfficerScope({ createdBy: 'so-1' }, scope), true);
  assert.equal(matchesOfficerScope({ employeeId: 'S-1' }, scope), true);
  assert.equal(matchesOfficerScope({ id: 'payment-1', name: 'Sales' }, scope), true);
  assert.equal(matchesOfficerScope({
    name: 'Dealer Name',
    officerName: 'Sales'
  }, scope), true);
  assert.equal(matchesOfficerScope({ officerId: 'S-2' }, scope), false);
  const ownerConditions = buildOfficerOwnerFilter(scope).$or;
  assert.ok(ownerConditions.some((condition) => condition.officerId));
  assert.ok(ownerConditions.some((condition) => condition.createdBy));
  assert.ok(ownerConditions.some((condition) => condition.employeeId));
  assert.ok(ownerConditions.some((condition) => condition.officerCode));
  assert.ok(ownerConditions.some((condition) => condition.$or?.some((nameCondition) => (
    nameCondition.officerName
  ))));
});
