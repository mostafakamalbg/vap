import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminSeat, DealerSalesTarget, Payment, SalesOfficer, User } from './models.js';
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

test('payment schemas expose only the canonical office payment category', () => {
  const paymentTypes = Payment.schema.path('paymentType').enumValues;
  assert.ok(paymentTypes.includes('office_payment'));
  assert.equal(paymentTypes.includes('company_transfer'), false);
  assert.equal(paymentTypes.includes('office_pay'), false);
  assert.ok(SalesOfficer.schema.path('paymentAndExpense.officePayment'));
});

test('target uniqueness stays scoped to dealer identity and session', () => {
  const dealerUniqueIndexes = DealerSalesTarget.schema.indexes()
    .filter(([, options]) => options.unique)
    .map(([fields]) => fields);
  assert.deepEqual(dealerUniqueIndexes, [{ id: 1 }, { dealerId: 1, session: 1 }]);

  const officerUniqueIndexes = SalesOfficer.schema.indexes()
    .filter(([, options]) => options.unique)
    .map(([fields]) => fields);
  assert.deepEqual(officerUniqueIndexes, [{ slNo: 1 }]);
});
