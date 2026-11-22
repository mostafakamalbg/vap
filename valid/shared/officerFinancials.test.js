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
  assert.equal(summary.totalReceivedAmount, 4500);
  assert.equal(summary.paymentAndExpense.officePayment, 600);
  assert.equal(summary.paymentAndExpense.fare, 300);
  assert.equal(summary.paymentAndExpense.salary, 200);
  assert.equal(summary.paymentAndExpense.lc, 400);
  assert.equal(summary.totalAmountDues, 6880);
  assert.equal(summary.totalSalesDues, -1380);
  assert.equal(summary.totalExpenses, 1500);
  assert.equal(summary.expensePercentage, 16);
  assert.equal(summary.salesPercentage, 114);
  assert.equal(summary.paymentPercentage, 40);
});

test('officer summary combines legacy company, office and depot categories as office payment', () => {
  const summary = calculateOfficerFinancials({
    payments: [
      { paymentType: 'Office Pay', amount: 100 },
      { paymentType: 'Depot', amount: 40 },
      { paymentType: 'অফিস / ডিপো', amount: 60 },
      { paymentType: 'অফিস   /   ডিপো', amount: 20 },
      { purpose: 'Depot', amount: 10 },
      { category: 'office_depot', amount: 12 },
      { expenseType: 'অফিস ও ডিপো', amount: 13 },
      { type: 'Depot', amount: 14 },
      { paymentType: 'কোম্পানিতে টাকা পাঠানো', amount: 80 }
    ]
  });

  assert.equal(summary.paymentAndExpense.officePayment, 349);
  assert.equal(summary.totalReceivedAmount, 349);
  assert.equal(summary.totalExpenses, 349);
});

test('collected payments produce the expected ratio for a positive receivable', () => {
  const summary = calculateOfficerFinancials({
    invoices: [{ invoiceType: 'regular', grandTotal: 20 }],
    payments: [{ category: 'dealer_collection', amount: 20 }]
  });

  assert.equal(summary.totalReceivedAmount, 20);
  assert.equal(summary.paymentPercentage, 100);
});

test('payment percentage remains zero for zero or negative receivables', () => {
  const zeroReceivable = calculateOfficerFinancials({
    payments: [{ paymentType: 'dealer_collection', amount: 100 }]
  });
  const negativeReceivable = calculateOfficerFinancials({
    lastSessionDue: -100,
    payments: [{ paymentType: 'dealer_collection', amount: 100 }]
  });

  assert.equal(zeroReceivable.paymentPercentage, 0);
  assert.equal(negativeReceivable.paymentPercentage, 0);
});

test('unknown payment categories are not silently counted as dealer collections', () => {
  const summary = calculateOfficerFinancials({
    payments: [
      { paymentType: 'unrecognized category', amount: 500 },
      { category: 'unrecognized category', amount: 250 }
    ]
  });

  assert.equal(summary.totalReceivedAmount, 0);
});

test('period filtering does not mix months or sessions', () => {
  const records = [
    { date: '2026-10-12', session: 'জুলাই - ডিসেম্বর 2026' },
    { date: '2027-01-03', session: 'জানুয়ারি - জুন 2027' },
    { date: '', session: 'জুলাই - ডিসেম্বর 2026' }
  ];
  assert.deepEqual(filterOfficerRecordsByPeriod(records, {
    session: 'জুলাই - ডিসেম্বর 2026',
    month: '2026-10'
  }), [records[0]]);
  assert.deepEqual(filterOfficerRecordsByPeriod(records, {
    session: 'জুলাই - ডিসেম্বর 2026'
  }), [records[0], records[2]]);
  assert.deepEqual(filterOfficerRecordsByPeriod(records, {
    session: 'জানুয়ারি - জুন 2027',
    month: '2026-10'
  }), []);
  assert.deepEqual(filterOfficerRecordsByPeriod(records, {
    session: 'January-June 2027',
    date: '2027-01-03'
  }), [records[1]]);
});
