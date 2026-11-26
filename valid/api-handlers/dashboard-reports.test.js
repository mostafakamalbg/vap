import assert from 'node:assert/strict';
import test from 'node:test';
import { getPeriodRange, paymentPipeline } from './dashboard-reports.js';

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

test('payment aggregation keeps both session filters and hierarchy owner scope', () => {
  const match = {
    $and: [
      { date: { $gte: '2026-07-01', $lt: '2027-01-01' } },
      { $or: [{ officerId: { $in: ['SO-01'] } }] }
    ]
  };
  const pipelineMatch = paymentPipeline(match)[0].$match;
  assert.ok(pipelineMatch.$and.includes(match.$and[0]));
  assert.ok(pipelineMatch.$and.includes(match.$and[1]));
});

test('dashboard reports accept inclusive date bounds for date ranges', () => {
  assert.deepEqual(
    getPeriodRange('date-range', '', '', '', '2025-01-01', '2025-01-01'),
    { start: '2025-01-01', end: '2025-01-02' }
  );
  assert.equal(getPeriodRange('date-range', '', '', '', '2025-02-01', '2025-01-31'), null);
});
