import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMonthlySalesReport, validateMonthlySalesReport } from './salesReports.js';

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
