import { isDealerBalanceCredit, PAYMENT_TYPES } from './paymentMethods.js';

function amountOrZero(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

export function getDealerNetDue({
  openingDue,
  totalBillAmount,
  totalReturnAmount,
  totalPaidAmount
} = {}) {
  return amountOrZero(openingDue)
    + amountOrZero(totalBillAmount)
    - amountOrZero(totalReturnAmount)
    - amountOrZero(totalPaidAmount);
}

export function getDealerLedgerTransactions(summary = {}) {
  const transactions = [];
  let sequence = 0;
  const addTransaction = (transaction) => {
    transactions.push({ ...transaction, sequence: sequence++ });
  };
  const openingDue = amountOrZero(summary.lastSessionDue ?? summary.openingDue);

  if (openingDue !== 0) {
    addTransaction({
      id: 'opening-balance',
      date: summary.previousDueDate || '',
      reference: summary.previousDueSession || '—',
      sourceType: 'opening',
      description: summary.previousDueDate ? 'পূর্বের বাকি পোস্টিং' : 'প্রারম্ভিক বাকি',
      debit: Math.max(openingDue, 0),
      credit: Math.max(-openingDue, 0),
      priority: 0
    });
  }

  (summary.invoices || []).forEach((invoice) => {
    if (['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)) return;
    const grandTotal = Number(invoice.grandTotal);
    const totalAmount = Number(invoice.totalAmount);
    const signedInvoiceAmount =
      Number.isFinite(grandTotal) && grandTotal !== 0
        ? grandTotal
        : amountOrZero(totalAmount);
    const invoiceAmount = Math.abs(signedInvoiceAmount);
    const isCredit = invoice.invoiceType === 'dealer_return' || signedInvoiceAmount < 0;
    addTransaction({
      id: `invoice-${invoice.id}`,
      date: invoice.date || '',
      reference: invoice.id || '—',
      sourceType: 'invoice',
      source: invoice,
      description: isCredit ? 'পণ্য ফেরত / ক্রেডিট' : 'বিক্রয় চালান',
      debit: isCredit ? 0 : invoiceAmount,
      credit: isCredit ? invoiceAmount : 0,
      priority: isCredit ? 2 : 1
    });
  });

  (summary.payments || []).forEach((payment, index) => {
    if (!isDealerBalanceCredit(payment)) return;
    const paymentType = String(payment.paymentType || 'dealer_collection');
    const paymentLabel = PAYMENT_TYPES.find((type) => type.value === paymentType)?.label
      || 'ডিলার কালেকশন';
    addTransaction({
      id: `payment-${payment.id || index}`,
      date: payment.date || '',
      reference: payment.sourceInvoiceId || payment.reference || 'জমার রশিদ',
      sourceType: 'payment',
      source: payment,
      description: paymentLabel,
      debit: 0,
      credit: Math.abs(amountOrZero(payment.amount)),
      priority: 3
    });
  });

  transactions.sort((left, right) => (
    (left.sourceType === 'opening' ? -1 : 0) - (right.sourceType === 'opening' ? -1 : 0)
    || String(left.date || '9999-12-31').localeCompare(String(right.date || '9999-12-31'))
    || left.priority - right.priority
    || left.sequence - right.sequence
  ));

  let balance = 0;
  return transactions.map(({ sequence: _sequence, priority: _priority, ...transaction }) => {
    balance += transaction.debit - transaction.credit;
    return { ...transaction, balance };
  });
}
