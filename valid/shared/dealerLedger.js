import {
  isDealerBalanceCredit,
  isDealerCollection,
  PAYMENT_TYPES,
  resolvePaymentRecordType
} from './paymentMethods.js';

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

function getLinkedInvoiceId(payment) {
  const sourceInvoiceId = String(payment?.sourceInvoiceId || '').trim();
  if (sourceInvoiceId) return sourceInvoiceId;
  return String(payment?.reference || '').match(/(?:invoice|চালান)\s*#?\s*([^\s,]+)/i)?.[1] || '';
}

export function getDealerCollectionAmount(invoices = [], payments = []) {
  const salesInvoices = invoices.filter((invoice) => (
    !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  ));
  const invoiceById = new Map(salesInvoices.map((invoice) => [
    String(invoice.id || invoice.invoiceNo || ''),
    invoice
  ]).filter(([id]) => id));
  const invoicePaidById = new Map();
  salesInvoices.forEach((invoice) => {
    const id = String(invoice.id || invoice.invoiceNo || '');
    if (id) invoicePaidById.set(id, amountOrZero(invoice.paidAmount));
  });

  let standalonePayments = 0;
  const linkedPaymentsByInvoice = new Map();
  payments.filter(isDealerCollection).forEach((payment) => {
    const amount = Math.abs(amountOrZero(payment.amount));
    if (!amount) return;
    const linkedInvoiceId = getLinkedInvoiceId(payment);
    if (linkedInvoiceId && invoiceById.has(linkedInvoiceId)) {
      linkedPaymentsByInvoice.set(
        linkedInvoiceId,
        (linkedPaymentsByInvoice.get(linkedInvoiceId) || 0) + amount
      );
    } else {
      standalonePayments += amount;
    }
  });

  const invoicePayments = [...invoicePaidById.entries()].reduce((sum, [id, amount]) => (
    sum + Math.max(amount, linkedPaymentsByInvoice.get(id) || 0)
  ), 0);
  return invoicePayments + standalonePayments;
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
    const paymentType = resolvePaymentRecordType(payment) || 'dealer_collection';
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
