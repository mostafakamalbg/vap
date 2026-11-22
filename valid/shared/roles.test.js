import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_ROLE,
  LEGACY_ADMIN_ROLE,
  SUPER_ADMIN_ROLE,
  isActiveUserStatus,
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
});

test('legacy active status values remain usable and normalize to active', () => {
  assert.equal(isActiveUserStatus('একটিভ'), true);
  assert.equal(isActiveUserStatus('সুপার এডমিন'), true);
  assert.equal(normalizeUserStatus('এডমিন'), 'active');
  assert.equal(isActiveUserStatus('pending'), false);
});
