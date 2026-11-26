import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_ROLE,
  LEGACY_ADMIN_ROLE,
  SUPER_ADMIN_ROLE,
  GENERAL_ADMIN_ROLE,
  LOGISTIC_OFFICER_ROLE,
  DATA_WRITE_ROLES,
  RSM_ROLE,
  ASM_ROLE,
  SO_ROLE,
  isActiveUserStatus,
  isAdminRole,
  isHierarchyRole,
  matchesExpectedRole,
  normalizeAdminRole,
  normalizeUserStatus
} from './roles.js';

test('legacy admin role normalizes to the assigned canonical admin role', () => {
  assert.equal(normalizeAdminRole(LEGACY_ADMIN_ROLE), ADMIN_ROLE);
  assert.equal(normalizeAdminRole(LEGACY_ADMIN_ROLE, true), SUPER_ADMIN_ROLE);
});

test('Admin login accepts both admin roles while SuperAdmin expectation stays strict', () => {
  assert.equal(matchesExpectedRole(ADMIN_ROLE, ADMIN_ROLE), true);
  assert.equal(matchesExpectedRole(ADMIN_ROLE, SUPER_ADMIN_ROLE), true);
  assert.equal(matchesExpectedRole(SUPER_ADMIN_ROLE, ADMIN_ROLE), false);
  assert.equal(matchesExpectedRole(SUPER_ADMIN_ROLE, SUPER_ADMIN_ROLE), true);
  for (const role of ['super_admin', 'superadmin', 'super admin']) {
    assert.equal(matchesExpectedRole(SUPER_ADMIN_ROLE, role), true);
    assert.equal(isAdminRole(role), true);
    assert.equal(normalizeAdminRole(role, true), SUPER_ADMIN_ROLE);
    assert.equal(normalizeAdminRole(role), ADMIN_ROLE);
  }
});

test('legacy active status values remain usable and normalize to active', () => {
  assert.equal(isActiveUserStatus('একটিভ'), true);
  assert.equal(isActiveUserStatus('সুপার এডমিন'), true);
  assert.equal(normalizeUserStatus('এডমিন'), 'active');
  assert.equal(isActiveUserStatus('pending'), false);
});

test('new role types preserve admin and reporting authorization categories', () => {
  assert.equal(isAdminRole(GENERAL_ADMIN_ROLE), true);
  assert.equal(isAdminRole('MD'), true);
  assert.equal(isAdminRole('Chairman'), true);
  for (const role of [RSM_ROLE, ASM_ROLE, SO_ROLE, 'officer']) {
    assert.equal(isHierarchyRole(role), true);
    assert.equal(matchesExpectedRole('officer', role), true);
  }
  assert.equal(matchesExpectedRole('officer', LOGISTIC_OFFICER_ROLE), true);
});

test('business-write access excludes hierarchy and dealer roles', () => {
  assert.ok(DATA_WRITE_ROLES.includes(SUPER_ADMIN_ROLE));
  assert.ok(DATA_WRITE_ROLES.includes(ADMIN_ROLE));
  assert.ok(DATA_WRITE_ROLES.includes(LOGISTIC_OFFICER_ROLE));
  for (const role of [RSM_ROLE, ASM_ROLE, SO_ROLE, 'officer', 'Dealer']) {
    assert.equal(DATA_WRITE_ROLES.includes(role), false);
  }
});
