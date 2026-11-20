import assert from 'node:assert/strict';
import test from 'node:test';
import { PAYMENT_TYPES, resolvePaymentType } from './paymentMethods.js';

test('office and depot payment labels resolve to the canonical office_pay category', () => {
  const officePay = PAYMENT_TYPES.find((entry) => entry.value === 'office_pay');

  assert.equal(officePay.label, 'অফিস / ডিপো');
  [
    'office_pay',
    'Office Pay',
    'Office / Depot',
    'Depot',
    'অফিস / ডিপো',
    'অফিস খরচ',
    'ডিপো'
  ].forEach((label) => assert.equal(resolvePaymentType(label), 'office_pay'));
});
