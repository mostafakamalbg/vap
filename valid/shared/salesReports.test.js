import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMonthlySalesReports,
  normalizeMonthlySalesReport,
  validateMonthlySalesReport
} from './salesReports.js';

const report = {
  personName: 'Sales Officer',
  monthOfReport: 'October/26',
  session: 'January-June 2027',
  reportingDate: '2026-10-31',
  parties: [{
    slNo: 1,
    nameOfTheParty: 'M/s Nowsad traders',
    lastMonthDues: 10000.6,
    presentMonth: { sales: 15800.4, return: 6420.2 },
    lastAndPresent: { salary: 100, collection: 5000.4, fare: 200, l_c: 300 }
  }]
};

test('monthly report rounds amounts and deducts returns before calculating due', () => {
  const saved = normalizeMonthlySalesReport(report);
  assert.deepEqual(saved.parties[0], {
    slNo: 1,
    nameOfTheParty: 'M/s Nowsad traders',
    lastMonthDues: 10001,
    presentMonth: { sales: 15800, return: 6420, netSales: 9380 },
    lastAndPresent: { netSales: 19381, salary: 100, collection: 5000, fare: 200, l_c: 300 },
    presentMonthTotalCollection: 5600,
    presentMonthNetDues: 13781
  });
});

test('monthly report rejects missing party names and invalid dates', () => {
  assert.match(validateMonthlySalesReport({ ...report, reportingDate: '2026-02-30' }), /তারিখ/);
  assert.match(validateMonthlySalesReport({
    ...report,
    parties: [{ ...report.parties[0], nameOfTheParty: '' }]
  }), /পার্টির নাম/);
});

test('monthly reports are built from filtered invoices, returns and linked collections', () => {
  const generated = buildMonthlySalesReports({
    invoices: [
      {
        id: 'INV-1',
        date: '2026-10-10',
        session: 'জুলাই - ডিসেম্বর 2026',
        officerId: 'OFF-1',
        officerCode: 'SO-01',
        dealerId: 'DL-1',
        dealerName: 'Dealer One',
        grandTotal: 1000,
        paidAmount: 200,
        invoiceType: 'regular'
      },
      {
        id: 'RET-1',
        date: '2026-10-12',
        session: 'জুলাই - ডিসেম্বর 2026',
        officerId: 'OFF-1',
        officerCode: 'SO-01',
        dealerId: 'DL-1',
        dealerName: 'Dealer One',
        grandTotal: 100,
        invoiceType: 'dealer_return'
      },
      {
        id: 'INV-OLD',
        date: '2026-09-10',
        session: 'জুলাই - ডিসেম্বর 2026',
        officerId: 'OFF-1',
        officerCode: 'SO-01',
        dealerId: 'DL-1',
        dealerName: 'Dealer One',
        grandTotal: 900,
        invoiceType: 'regular'
      }
    ],
    payments: [
      { id: 'PAY-1', date: '2026-10-10', officerId: 'OFF-1', dealerId: 'DL-1', amount: 200, sourceInvoiceId: 'INV-1' },
      { id: 'PAY-2', date: '2026-10-15', officerId: 'OFF-1', dealerId: 'DL-1', amount: 300, paymentType: 'dealer_collection' }
    ],
    dealers: [{ id: 'DL-1', shopName: 'Dealer One', lastSessionDue: 100 }],
    officers: [{ id: 'OFF-1', code: 'SO-01', name: 'Officer One', designation: 'SO' }],
    monthFilter: 'October/26',
    sessionFilter: 'July-December 2026'
  });

  assert.equal(generated.length, 1);
  assert.equal(generated[0].personName, 'Officer One');
  assert.equal(generated[0].parties.length, 1);
  assert.equal(generated[0].parties[0].presentMonth.sales, 1000);
  assert.equal(generated[0].parties[0].presentMonth.return, 100);
  assert.equal(generated[0].parties[0].lastAndPresent.collection, 500);
  assert.equal(generated[0].parties[0].presentMonthNetDues, 500);
});

test('all-month reports are grouped from source records without a stored report', () => {
  const generated = buildMonthlySalesReports({
    invoices: [
      { id: 'INV-1', date: '2026-08-01', officerCode: 'SO-01', dealerId: 'DL-1', dealerName: 'Dealer One', grandTotal: 100 },
      { id: 'INV-2', date: '2026-10-01', officerCode: 'SO-01', dealerId: 'DL-1', dealerName: 'Dealer One', grandTotal: 200 }
    ],
    dealers: [{ id: 'DL-1', shopName: 'Dealer One' }],
    officers: [{ code: 'SO-01', name: 'Officer One' }]
  });

  assert.equal(generated.length, 2);
  assert.deepEqual(generated.map((report) => report.reportingDate), ['2026-08-31', '2026-10-31']);
});
