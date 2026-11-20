import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentPipeline } from './dashboard-reports.js';

test('payment summary pipeline resolves categories from legacy payment fields', () => {
  const pipeline = paymentPipeline({ date: { $gte: '2026-07-01' } });
  const serializedGroup = JSON.stringify(pipeline[3].$group);

  assert.match(serializedGroup, /officePay/);
  for (const field of [
    'paymentType',
    'purpose',
    'category',
    'expenseType',
    'expenseCategory',
    'paymentPurpose',
    'transactionType',
    'type'
  ]) {
    assert.ok(serializedGroup.includes(`$${field}`), `expected category matching for ${field}`);
  }
});
