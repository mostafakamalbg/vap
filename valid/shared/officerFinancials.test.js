import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOfficerFinancials, filterOfficerRecordsByPeriod } from './officerFinancials.js';

test('officer summary deducts return invoices and classifies payment categories', () => {
  const summary = calculateOfficerFinancials({
    invoices: [
      { invoiceType: 'regular', grandTotal: 15800, paidAmount: 2000 },
      { invoiceType: 'dealer_return', grandTotal: 6420 }
    ],
    payments: [
      { paymentType: 'dealer_collection', amount: 1000 },
      { paymentType: 'company_transfer', amount: 500 },
      { paymentType: 'office_pay', amount: 100 },
      { paymentType: 'salary', amount: 200 },
      { paymentType: 'vehicle_rent', amount: 300 },
      { paymentType: 'lc_commission', amount: 400 },
      { paymentType: 'dealer_collection', amount: 900, sourceInvoiceId: 'inv-1' }
    ],
    salesTarget: 10000,
    lastSessionDue: 2000
  });

  assert.equal(summary.totalNetSales, 9380);
  assert.equal(summary.totalReceivedAmount, 3500);
  assert.equal(summary.paymentAndExpense.officePay, 100);
  assert.equal(summary.paymentAndExpense.fare, 300);
  assert.equal(summary.paymentAndExpense.salary, 200);
  assert.equal(summary.paymentAndExpense.lc, 400);
  assert.equal(summary.totalAmountDues, 7880);
  assert.equal(summary.expensePercentage, 11);
  assert.equal(summary.salesPercentage, 94);
  assert.equal(summary.paymentPercentage, 31);
});

test('period filtering does not mix months or sessions', () => {
  const records = [
    { date: '2026-10-12', session: 'জুলাই - ডিসেম্বর 2026' },
    { date: '2027-01-03', session: 'জানুয়ারি - জুন 2027' }
  ];
  assert.deepEqual(filterOfficerRecordsByPeriod(records, {
    session: 'জুলাই - ডিসেম্বর 2026',
    month: '2026-10'
  }), [records[0]]);
  assert.deepEqual(filterOfficerRecordsByPeriod(records, {
    session: 'জানুয়ারি - জুন 2027',
    month: '2026-10'
  }), []);
  assert.deepEqual(filterOfficerRecordsByPeriod(records, {
    session: 'January-June 2027',
    date: '2027-01-03'
  }), [records[1]]);
});
