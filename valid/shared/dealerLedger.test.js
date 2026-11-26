import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDealerCollectionAmount,
  getDealerLedgerTransactions
} from './dealerLedger.js';

test('dealer collection totals include linked valid payments without double counting invoices', () => {
  assert.equal(getDealerCollectionAmount(
    [{ id: 'INV-1', paidAmount: 500 }, { id: 'INV-2', paidAmount: 0 }],
    [
      { id: 'PAY-1', amount: 500, sourceInvoiceId: 'INV-1' },
      { id: 'PAY-2', amount: 250, sourceInvoiceId: 'INV-2' },
      { id: 'PAY-3', amount: 100, paymentType: 'dealer_collection' }
    ]
  ), 850);
});

test('dealer collection totals include invoice-referenced payments when inline paid amount is empty', () => {
  assert.equal(getDealerCollectionAmount(
    [{ id: 'INV-4', paidAmount: 0 }],
    [{ reference: 'চালান #INV-4', amount: 75 }]
  ), 75);
});

test('legacy company transfers and office payments normalize to office payment', () => {
  const transactions = getDealerLedgerTransactions({
    openingDue: 500,
    payments: [
      { id: 'receipt', paymentType: 'company_transfer', amount: 100, date: '2026-10-01' },
      { id: 'expense', paymentType: 'office_pay', amount: 40, date: '2026-10-02' }
    ]
  });
  const balance = transactions[transactions.length - 1].balance;
  assert.equal(balance, 360);
  assert.equal(transactions.find((entry) => entry.id === 'payment-receipt').description, 'অফিস পেমেন্ট');
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
  assert.equal(payment.description, 'অফিস পেমেন্ট');
  assert.equal(transactions[transactions.length - 1].balance, 75);
});
