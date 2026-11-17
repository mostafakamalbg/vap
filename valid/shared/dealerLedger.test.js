import assert from 'node:assert/strict';
import test from 'node:test';
import { getDealerLedgerTransactions } from './dealerLedger.js';

test('expense payments do not reduce dealer balance', () => {
  const transactions = getDealerLedgerTransactions({
    openingDue: 500,
    payments: [
      { id: 'receipt', paymentType: 'company_transfer', amount: 100, date: '2026-10-01' },
      { id: 'expense', paymentType: 'office_pay', amount: 40, date: '2026-10-02' }
    ]
  });
  const balance = transactions[transactions.length - 1].balance;
  assert.equal(balance, 400);
  assert.equal(transactions.some((entry) => entry.id === 'payment-expense'), false);
});

test('last session due is used as the ledger opening balance', () => {
  const transactions = getDealerLedgerTransactions({
    openingDue: 100,
    lastSessionDue: 250,
    invoices: [{ id: 'sale', date: '2026-10-01', invoiceType: 'regular', grandTotal: 500 }]
  });
  assert.equal(transactions[0].balance, 250);
  assert.equal(transactions[transactions.length - 1].balance, 750);
});
