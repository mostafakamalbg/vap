import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEDGER_PAYMENT_TYPES,
  PAYMENT_TYPES,
  getPaymentAmount,
  isDealerCollection,
  resolvePaymentRecordType,
  resolvePaymentType
} from './paymentMethods.js';

test('office payment is the only active category for legacy company, office and depot values', () => {
  const officePayment = PAYMENT_TYPES.find((entry) => entry.value === 'office_payment');

  assert.equal(officePayment.label, 'অফিস পেমেন্ট');
  assert.equal(PAYMENT_TYPES.some((entry) => ['company_transfer', 'office_pay'].includes(entry.value)), false);
  assert.ok(LEDGER_PAYMENT_TYPES.some((entry) => entry.value === 'office_payment'));

  [
    'office_payment',
    ' OFFICE PAYMENT ',
    'office_pay',
    'Office Pay',
    'Office / Depot',
    ' OFFICE /   DEPOT ',
    'office_depot',
    'Office',
    'Depot',
    'Depot Payment',
    'অফিস / ডিপো',
    'অফিস/ডিপো',
    'অফিস   /   ডিপো',
    'অফিস ও ডিপো',
    'office expense',
    'company_transfer',
    'Company Transfer',
    'কোম্পানিতে টাকা পাঠানো',
    'টাকা কোম্পানিতে পাঠানো'
  ].forEach((label) => assert.equal(resolvePaymentType(label), 'office_payment'));

  assert.equal(resolvePaymentRecordType({ purpose: 'Office Pay' }), 'office_payment');
  assert.equal(resolvePaymentRecordType({ category: 'office_depot' }), 'office_payment');
  assert.equal(isDealerCollection({ paymentType: 'company_transfer' }), true);
  assert.equal(resolvePaymentType('বেতন'), 'salary');
  assert.equal(resolvePaymentType('গাড়ি ভাড়া'), 'vehicle_rent');
  assert.equal(resolvePaymentType('লেস কমিশন (LC)'), 'lc_commission');
});

test('legacy L/C and travel expense labels resolve to live report categories', () => {
  ['L/C', 'l_c', 'LC', 'L C'].forEach((label) => {
    assert.equal(resolvePaymentType(label), 'lc_commission');
  });
  [
    'TA', 'travel', 'travel allowance', 'travelFare', 'journey', 'journeyFare',
    'journey fare', 'fare', 'FARE', 'ভাড়া', 'যাতায়াত', 'ফেয়ার', 'ফেয়ার'
  ].forEach((label) => {
    assert.equal(resolvePaymentType(label), 'vehicle_rent');
  });
});

test('Fare amount aliases identify and safely amount legacy payments', () => {
  [
    { travelFare: '125' },
    { journey: '125' },
    { ta: 125 },
    { travel: 125 },
    { ভাড়া: 125 },
    { 'যাতায়াত': 125 },
    { paymentAndExpense: { ফেয়ার: 125 } }
  ].forEach((payment) => {
    assert.equal(resolvePaymentRecordType(payment), 'vehicle_rent');
    assert.equal(getPaymentAmount(payment), 125);
  });
  assert.equal(getPaymentAmount({ paymentType: 'fare', amount: 'invalid' }), 0);
  assert.equal(getPaymentAmount({ paymentType: 'fare', totalAmount: '80' }), 80);
  assert.equal(resolvePaymentRecordType({
    category: 'unrecognized',
    travelFare: 125
  }), '');
});

test('the first recognized category wins and unknown populated categories are not defaulted', () => {
  assert.equal(resolvePaymentRecordType({
    paymentType: 'unrecognized',
    expenseType: 'Depot'
  }), 'office_payment');
  assert.equal(resolvePaymentRecordType({ category: 'unrecognized category' }), '');
});
