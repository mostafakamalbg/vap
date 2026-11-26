import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addPaymentRows,
  buildReportOwnerMatch,
  getActivityRoster,
  getPeriodRange,
  legacyInvoicePipeline,
  paymentPipeline,
  priorSessionCondition
} from './dashboard-reports.js';

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

test('dashboard reports accept an all-session and all-month period', () => {
  assert.deepEqual(getPeriodRange('all', 'ALL'), {
    start: '0001-01-01',
    end: '9999-12-31'
  });
});

test('session-prior queries follow explicit session keys and only date-fallback legacy rows', () => {
  const condition = priorSessionCondition('জানুয়ারি - জুন 2027');
  const priorSessions = condition.$or[0].session.$in;

  assert.ok(priorSessions.includes('জুলাই - ডিসেম্বর 2026'));
  assert.ok(priorSessions.includes('July-December 2026'));
  assert.equal(priorSessions.includes('জানুয়ারি - জুন 2027'), false);
  assert.deepEqual(condition.$or[1], {
    $and: [
      { session: { $in: ['', null, 'সেশন নির্ধারিত নয়'] } },
      { date: { $lt: '2027-01-01' } }
    ]
  });
});

test('owner filters include dealer-assigned invoices only when their officer identity is absent', () => {
  const scope = {
    global: false,
    officerIds: new Set(['OFF-1']),
    officerCodes: new Set(['SO-01']),
    officerNames: new Set(['Officer One'])
  };
  const match = buildReportOwnerMatch(scope, ['DL-1']);
  const dealerFallback = match.$or.find((condition) => condition.dealerId);

  assert.deepEqual(dealerFallback, {
    officerId: { $in: ['', null] },
    officerCode: { $in: ['', null] },
    officerName: { $in: ['', null] },
    dealerId: { $in: ['DL-1'] }
  });
});

test('invoice and payment report pipelines fill missing officer identity from the dealer assignment', () => {
  const invoiceStages = legacyInvoicePipeline({});
  const invoiceOwnerStage = invoiceStages.find((stage) => stage.$set?.reportOfficerCode);
  const invoiceGroup = invoiceStages.find((stage) => stage.$group);
  const paymentStages = paymentPipeline({});
  const paymentOwnerStage = paymentStages.find((stage) => stage.$set?.reportOfficerCode);

  assert.ok(JSON.stringify(invoiceOwnerStage).includes('$dealerProfile.officerCode'));
  assert.equal(invoiceGroup.$group._id.officerCode, '$reportOfficerCode');
  assert.ok(JSON.stringify(paymentOwnerStage).includes('$dealerProfile.officerCode'));
});

test('legacy invoice pipeline reads scoped legacy records without overlapping typed invoices', () => {
  const pipeline = legacyInvoicePipeline({
    $and: [
      { date: { $gte: '2026-07-01', $lt: '2027-01-01' } },
      { $or: [{ officerId: { $in: ['SO-01'] } }] }
    ]
  }, {}, ['INV-1']);
  const match = pipeline[0].$match;

  assert.equal(match.type, 'invoices');
  assert.deepEqual(match.$and[0]['data.date'], {
    $gte: '2026-07-01',
    $lt: '2027-01-01'
  });
  assert.deepEqual(match.$and[1].$or[0]['data.officerId'], { $in: ['SO-01'] });
  assert.deepEqual(match.$nor, [
    { 'data.id': { $in: ['INV-1'] } },
    { 'data.invoiceNo': { $in: ['INV-1'] } }
  ]);
  assert.deepEqual(pipeline[1], { $replaceRoot: { newRoot: '$data' } });
});

test('activity owners can populate a missing master roster without losing their identity', () => {
  assert.deepEqual(getActivityRoster([{
    _id: {
      officerId: 'OFF-01',
      officerCode: 'so-01',
      officerName: 'Sales Officer'
    }
  }]), [{
    id: 'OFF-01',
    officerId: 'OFF-01',
    code: 'SO-01',
    officerCode: 'so-01',
    name: 'Sales Officer',
    officerName: 'Sales Officer'
  }]);
});

test('all-session legacy expenses without a date are included, but not treated as prior payments', () => {
  const groups = new Map();
  const rows = [{
    session: 'জুলাই - ডিসেম্বর ২০২৬',
    officerId: 'SO-01',
    paymentType: 'L/C',
    amount: 125
  }];
  const options = {
    period: 'all',
    periodValue: 'ALL',
    periodRange: getPeriodRange('all', 'ALL'),
    scope: { global: true }
  };

  addPaymentRows(groups, rows, { ...options, beforePeriod: false });
  assert.equal([...groups.values()][0].lc, 125);
  addPaymentRows(new Map(), rows, { ...options, beforePeriod: true });
  assert.equal(groups.size, 1);
});

test('session-prior legacy payments use the explicit session instead of a conflicting date', () => {
  const groups = new Map();
  const range = getPeriodRange('session', 'জানুয়ারি - জুন 2027');
  addPaymentRows(groups, [
    {
      id: 'prior-session',
      session: 'জুলাই - ডিসেম্বর 2026',
      date: '2027-01-03',
      officerId: 'SO-01',
      dealerId: 'DL-1',
      paymentType: 'dealer_collection',
      amount: 100
    },
    {
      id: 'current-session',
      session: 'জানুয়ারি - জুন 2027',
      date: '2026-10-12',
      officerId: 'SO-01',
      dealerId: 'DL-1',
      paymentType: 'dealer_collection',
      amount: 200
    }
  ], {
    period: 'session',
    periodValue: 'জানুয়ারি - জুন 2027',
    periodRange: range,
    beforePeriod: true,
    scope: { global: true }
  });

  assert.equal([...groups.values()][0].collection, 100);
});
