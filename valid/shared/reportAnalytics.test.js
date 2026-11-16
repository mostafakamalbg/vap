import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOfficerSessionSummary } from './reportAnalytics.js';

test('builds officer session totals from assigned dealer dues, sales, returns, and expenses', () => {
  const officer = {
    id: 'officer-5',
    code: 'SO-05',
    name: 'Mostafa Kamal',
    phone: '01700000000'
  };
  const { rows, totals } = buildOfficerSessionSummary({
    officers: [officer],
    dealers: [{ id: 'dealer-1', code: 'DL-01', officerCode: 'SO-05', openingDue: 1000 }],
    invoices: [
      {
        id: 'old-sale',
        date: '2026-06-20',
        dealerId: 'dealer-1',
        officerId: 'officer-5',
        grandTotal: 400
      },
      {
        id: 'current-sale',
        date: '2026-07-10',
        session: 'জুলাই - ডিসেম্বর 2026',
        dealerId: 'dealer-1',
        officerId: 'officer-5',
        grandTotal: 1000
      },
      {
        id: 'current-return',
        date: '2026-07-15',
        session: 'জুলাই - ডিসেম্বর 2026',
        invoiceType: 'dealer_return',
        dealerId: 'dealer-1',
        officerId: 'officer-5',
        grandTotal: 100
      }
    ],
    payments: [
      { date: '2026-06-25', dealerId: 'dealer-1', amount: 100, paymentType: 'dealer_collection' },
      { date: '2026-07-12', officerId: 'officer-5', amount: 100, paymentType: 'company_transfer' },
      { date: '2026-07-13', officerId: 'officer-5', amount: 50, paymentType: 'vehicle_rent' },
      { date: '2026-07-14', officerId: 'officer-5', amount: 100, paymentType: 'salary' },
      { date: '2026-07-15', officerId: 'officer-5', amount: 25, paymentType: 'lc_commission' }
    ],
    session: 'জুলাই - ডিসেম্বর 2026',
    asOfMonth: '2026-07'
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].lastSessionDue, 1300);
  assert.equal(rows[0].slNo, 1);
  assert.deepEqual(rows[0].paymentAndExpense, {
    officePay: 100,
    fare: 50,
    salary: 100,
    lc: 25
  });
  assert.equal(rows[0].salesAmount, 1000);
  assert.equal(rows[0].returnAmount, 100);
  assert.equal(rows[0].previousPlusNetSales, 2200);
  assert.equal(rows[0].totalReceivedAmount, 275);
  assert.equal(rows[0].totalAmountDues, 1925);
  assert.equal(rows[0].salesTargetJulyDec2026, 2500000);
  assert.equal(rows[0].salesTargetJanJune2027, 9000000);
  assert.equal(totals.totalSalesDues, 2497800);
  assert.equal(totals.expensePercentage, 12.5);
  assert.equal(totals.paymentPercentage, 12.5);
});

test('returns zeroed totals for a session without a year', () => {
  const result = buildOfficerSessionSummary({ session: 'unknown' });
  assert.deepEqual(result, {
    rows: [],
    totals: {
      salesTargetJulyDec2026: 0,
      salesTargetJanJune2027: 0,
      target: 0,
      lastSessionDue: 0,
      salesAmount: 0,
      returnAmount: 0,
      previousPlusNetSales: 0,
      officePay: 0,
      fare: 0,
      salary: 0,
      lc: 0,
      totalReceivedAmount: 0,
      totalAmountDues: 0,
      totalNetSales: 0,
      totalSalesDues: 0,
      expensePercentage: 0,
      salesPercentage: 0,
      paymentPercentage: 0,
      salesInvoiceCount: 0,
      returnInvoiceCount: 0,
      totalInvoiceCount: 0,
      previousInvoices: 0,
      runningInvoices: 0
    }
  });
});
