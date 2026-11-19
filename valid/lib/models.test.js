import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminSeat, User } from './models.js';
import {
  ADMIN_ROLE,
  LEGACY_ADMIN_ROLE,
  SUPER_ADMIN_ROLE,
  USER_STATUS_VALUES
} from '../shared/roles.js';

test('user role schema accepts canonical admin roles and the legacy admin role', () => {
  const allowedRoles = User.schema.path('role').enumValues;
  assert.ok(allowedRoles.includes(SUPER_ADMIN_ROLE));
  assert.ok(allowedRoles.includes(ADMIN_ROLE));
  assert.ok(allowedRoles.includes(LEGACY_ADMIN_ROLE));
  assert.ok(allowedRoles.includes('officer'));
});

test('administrator seats are limited to one primary and ten regular accounts', () => {
  const seatId = AdminSeat.schema.path('_id');
  assert.equal(seatId.options.min, 1);
  assert.equal(seatId.options.max, 11);
});

test('user status schema accepts canonical and legacy active values', () => {
  const allowedStatuses = User.schema.path('status').enumValues;
  for (const status of USER_STATUS_VALUES) {
    assert.ok(allowedStatuses.includes(status));
  }
});
