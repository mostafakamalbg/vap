import assert from 'node:assert/strict';
import test from 'node:test';
import { getDealerLedgerTransactions } from './dealerLedger.js';

test('expense postings and receipts both reduce dealer balance', () => {
  const transactions = getDealerLedgerTransactions({
    openingDue: 500,
    payments: [
      { id: 'receipt', paymentType: 'company_transfer', amount: 100, date: '2026-10-01' },
      { id: 'expense', paymentType: 'office_pay', amount: 40, date: '2026-10-02' }
    ]
  });
  const balance = transactions[transactions.length - 1].balance;
  assert.equal(balance, 360);
  assert.equal(transactions.find((entry) => entry.id === 'payment-expense').credit, 40);
});

test('last session due is used as the ledger opening balance', () => {
  const transactions = getDealerLedgerTransactions({
    openingDue: 100,
    lastSessionDue: 250,
    previousDueDate: '2026-10-01',
    previousDueSession: 'জুলাই - ডিসেম্বর 2026',
    invoices: [{ id: 'sale', date: '2026-10-01', invoiceType: 'regular', grandTotal: 500 }]
  });
  assert.equal(transactions[0].balance, 250);
  assert.equal(transactions[0].date, '2026-10-01');
  assert.equal(transactions[0].reference, 'জুলাই - ডিসেম্বর 2026');
  assert.equal(transactions[0].description, 'পূর্বের বাকি পোস্টিং');
  assert.equal(transactions[transactions.length - 1].balance, 750);
});

test('legacy purpose labels resolve to the saved payment category in dealer ledgers', () => {
  const transactions = getDealerLedgerTransactions({
    openingDue: 100,
    payments: [{ id: 'legacy-office', purpose: 'Office Pay', amount: 25 }]
  });
  const payment = transactions.find((entry) => entry.id === 'payment-legacy-office');

  assert.equal(payment.credit, 25);
  assert.equal(payment.description, 'অফিস / ডিপো');
  assert.equal(transactions[transactions.length - 1].balance, 75);
});
