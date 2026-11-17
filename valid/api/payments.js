import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { Dealer, Payment } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { normalizePaymentMethod, PAYMENT_TYPES } from '../shared/paymentMethods.js';
import { roundCurrency } from '../shared/invoiceTotals.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function paymentValues(payment) {
  return {
    id: String(payment.id || `PAY-${randomUUID()}`),
    date: payment.date,
    paymentType: payment.paymentType,
    amount: roundCurrency(payment.amount),
    paymentMethod: normalizePaymentMethod(payment.paymentMethod),
    dealerId: String(payment.dealerId || ''),
    dealerName: String(payment.dealerName || '').trim().slice(0, 200),
    officerId: String(payment.officerId || ''),
    officerCode: String(payment.officerCode || ''),
    officerName: String(payment.officerName || '').trim().slice(0, 200),
    reference: String(payment.reference || '').trim().slice(0, 200),
    receivedBy: String(payment.receivedBy || '').trim().slice(0, 200),
    note: String(payment.note || '').trim().slice(0, 1000),
    sourceInvoiceId: ''
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['admin']);
  if (!user) return;

  const payments = req.body?.payments;
  if (!Array.isArray(payments) || payments.length < 1 || payments.length > PAYMENT_TYPES.length) {
    return res.status(400).json({ error: 'পেমেন্টের তালিকা সঠিক নয়।' });
  }
  const validTypes = new Set(PAYMENT_TYPES.map(({ value }) => value));
  if (payments.some((payment) => (
    !payment
    || !isValidDate(String(payment.date || ''))
    || !validTypes.has(String(payment.paymentType || ''))
    || !Number.isFinite(Number(payment.amount))
    || Number(payment.amount) <= 0
    || !String(payment.dealerId || '').trim()
  ))) {
    return res.status(400).json({ error: 'তারিখ, ডিলার, পেমেন্টের ধরন ও টাকার পরিমাণ সঠিক নয়।' });
  }

  try {
    const values = payments.map(paymentValues);
    if (new Set(values.map(({ id }) => id)).size !== values.length) {
      return res.status(400).json({ error: 'পেমেন্টের আইডি পুনরাবৃত্তি হয়েছে।' });
    }
    const dealerIds = [...new Set(values.map(({ dealerId }) => dealerId))];
    const dealers = await Dealer.find({ id: { $in: dealerIds } }).select('id shopName').lean();
    if (dealers.length !== dealerIds.length) {
      return res.status(400).json({ error: 'নির্বাচিত ডিলার ডেটাবেজে পাওয়া যায়নি।' });
    }
    const dealerNames = new Map(dealers.map((dealer) => [dealer.id, dealer.shopName]));
    values.forEach((payment) => {
      payment.dealerName = dealerNames.get(payment.dealerId) || payment.dealerName;
    });

    const existing = await Payment.find({ id: { $in: values.map(({ id }) => id) } }).lean();
    const existingById = new Map(existing.map((payment) => [payment.id, payment]));
    const conflicts = values.filter((payment) => {
      const saved = existingById.get(payment.id);
      return saved && (
        saved.date !== payment.date
        || saved.paymentType !== payment.paymentType
        || saved.amount !== payment.amount
        || saved.dealerId !== payment.dealerId
      );
    });
    if (conflicts.length) {
      return res.status(409).json({ error: 'একই পেমেন্ট আইডিতে ভিন্ন তথ্য রয়েছে।' });
    }
    const newPayments = values.filter((payment) => !existingById.has(payment.id));
    if (newPayments.length) {
      await withTransactionFallback(async (session) => {
        await Payment.create(newPayments, transactionOptions(session));
      });
    }
    return res.status(201).json(values);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'পেমেন্টটি ইতোমধ্যে সংরক্ষিত হয়েছে।' });
    }
    console.error('Payment posting failed:', error);
    return res.status(500).json({ error: 'পেমেন্ট সংরক্ষণ করা যায়নি।' });
  }
}
