import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentPipeline } from './dashboard-reports.js';

test('payment summary pipeline resolves categories from legacy payment fields', () => {
  const pipeline = paymentPipeline({ date: { $gte: '2026-07-01' } });
  const serializedPipeline = JSON.stringify(pipeline);

  assert.match(serializedPipeline, /officePayment/);
  assert.match(serializedPipeline, /company transfer/);
  assert.match(serializedPipeline, /অফিস\/ডিপো/);
  assert.match(serializedPipeline, /resolvedPaymentType/);
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
    assert.ok(serializedPipeline.includes(`$${field}`), `expected category matching for ${field}`);
  }
});

test('payment aggregation applies shared category precedence and blank-category defaults', () => {
  const pipeline = paymentPipeline({});
  const typeStage = pipeline.find((stage) => stage.$set?.resolvedPaymentType);
  const serializedTypeExpression = JSON.stringify(typeStage.$set.resolvedPaymentType);

  assert.match(serializedTypeExpression, /office_payment/);
  assert.match(serializedTypeExpression, /dealer_collection/);
  assert.match(serializedTypeExpression, /paymentType/);
  assert.match(serializedTypeExpression, /purpose/);
});
