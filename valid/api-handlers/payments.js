import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Payment } from '../lib/models.js';
import { authorize, hasSuperAdminAccess } from '../lib/auth.js';
import {
  normalizePaymentMethod,
  normalizePaymentType,
  PAYMENT_TYPES,
  getPaymentRecordTypeValue,
  resolvePaymentRecordType
} from '../shared/paymentMethods.js';
import { roundCurrency } from '../shared/invoiceTotals.js';
import { transactionCreateOptions, transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { parseSessionDateRange } from '../shared/reportDateFilters.js';
import { normalizeSessionText } from '../shared/sessions.js';
import { ADMIN_ROLES, LOGISTIC_OFFICER_ROLE, isAdminRole } from '../shared/roles.js';
import { createApprovalRequest } from '../lib/approvalRequests.js';

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function paymentValues(payment) {
  return {
    id: String(payment.id || `PAY-${randomUUID()}`),
    date: payment.date,
    session: normalizeSessionText(payment.session),
    paymentType: normalizePaymentType(resolvePaymentRecordType(payment)),
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
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  } catch (error) {
    console.error('Payment database connection failed:', error);
    const message = error?.message || 'Payment database connection failed.';
    return res.status(503).json({ error: message, message });
  }
  const user = await authorize(
    req,
    res,
    [...ADMIN_ROLES, LOGISTIC_OFFICER_ROLE]
  );
  if (!user) return;
  if (req.method !== 'POST') {
    if (req.method === 'DELETE' && !await hasSuperAdminAccess(user)) {
      return res.status(403).json({ error: 'পেমেন্ট সম্পাদনা বা মুছে ফেলার অনুমতি শুধু সুপার অ্যাডমিনের।' });
    }
    if (req.method === 'PATCH' && !isAdminRole(user.role)
      && user.role !== LOGISTIC_OFFICER_ROLE && !await hasSuperAdminAccess(user)) {
      return res.status(403).json({ error: 'পেমেন্ট সম্পাদনা বা মুছে ফেলার অনুমতি শুধু সুপার অ্যাডমিনের।' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String(req.body?.id || '').trim();
    if (!id) return res.status(400).json({ error: 'মুছে ফেলার জন্য পেমেন্ট নির্বাচন করুন।' });
    try {
      await withTransactionFallback(async (session) => {
        await Payment.deleteOne({ id }, transactionOptions(session));
      });
      return res.status(200).json({ deleted: id });
    } catch (error) {
      console.error('Payment delete failed:', error);
      const message = error?.message || 'পেমেন্ট মুছে ফেলা যায়নি।';
      return res.status(500).json({ error: message, message });
    }
  }
  if (req.method === 'PATCH') {
    const id = String(req.body?.id || '').trim();
    const update = req.body?.payment;
    if (!id || !update) return res.status(400).json({ error: 'পেমেন্টের সঠিক তথ্য দিন।' });
    if (getPaymentRecordTypeValue(update) && !resolvePaymentRecordType(update)) {
      return res.status(400).json({ error: 'পেমেন্টের ধরন সঠিক নয়।' });
    }
    if (!isValidDate(String(update.date || ''))
      || !parseSessionDateRange(normalizeSessionText(update.session))) {
      return res.status(400).json({ error: 'তারিখ ও সেশন নির্বাচন করুন।' });
    }
    try {
      if (!await hasSuperAdminAccess(user)) {
        let existing = await Payment.findOne({ id }).lean();
        let originalUpdatedAt = existing?.updatedAt || null;
        if (!existing) {
          const legacy = await BusinessRecord.findOne({
            type: 'payments',
            $or: [{ recordId: id }, { 'data.id': id }]
          }).select('recordId data updatedAt').lean();
          if (legacy?.data) {
            existing = legacy.data;
            originalUpdatedAt = legacy.updatedAt || null;
          }
        }
        if (!existing) return res.status(404).json({ error: 'পেমেন্ট পাওয়া যায়নি।' });
        if (existing.sourceInvoiceId) {
          return res.status(409).json({ error: 'ইনভয়েসের সঙ্গে যুক্ত পেমেন্ট সংশোধন করতে ইনভয়েস আপডেট অনুরোধ দিন।' });
        }
        const existingValues = Object.fromEntries(Object.entries(existing).filter(([key]) => (
          !['_id', '__v', 'createdAt', 'updatedAt'].includes(key)
        )));
        const proposed = {
          ...existingValues,
          ...paymentValues({ ...existing, ...update, id }),
          sourceInvoiceId: existing.sourceInvoiceId || ''
        };
        const approvalRequest = await createApprovalRequest({
          requestType: 'payment_update',
          targetId: id,
          original: existing,
          originalUpdatedAt,
          proposed,
          user
        });
        return res.status(202).json({ pendingApproval: true, approvalRequest });
      }
      const saved = await Payment.findOneAndUpdate(
        { id },
        { $set: { ...paymentValues({ ...update, id }), session: String(update.session).trim() } },
        { new: true, runValidators: true }
      ).lean();
      if (!saved) return res.status(404).json({ error: 'পেমেন্ট পাওয়া যায়নি।' });
      return res.status(200).json(saved);
    } catch (error) {
      console.error('Payment update failed:', error);
      if (error?.name === 'ValidationError') {
        return res.status(400).json({ error: 'পেমেন্টের তথ্য সঠিক নয়।' });
      }
      const message = error?.message || 'পেমেন্ট সম্পাদনা করা যায়নি।';
      return res.status(500).json({ error: message, message });
    }
  }

  const payments = req.body?.payments;
  if (!Array.isArray(payments) || payments.length < 1 || payments.length > PAYMENT_TYPES.length) {
    return res.status(400).json({ error: 'পেমেন্টের তালিকা সঠিক নয়।' });
  }
  if (payments.some((payment) => (
    !payment
    || !isValidDate(String(payment.date || ''))
    || !String(payment.session || '').trim()
    || String(payment.session).length > 100
    || !parseSessionDateRange(normalizeSessionText(payment.session))
    || !resolvePaymentRecordType(payment)
    || !Number.isFinite(Number(payment.amount))
    || Number(payment.amount) <= 0
    || !String(payment.dealerId || '').trim()
    || !String(payment.officerId || '').trim()
  ))) {
    return res.status(400).json({ error: 'তারিখ, সেশন, ডিলার, অফিসার, পেমেন্টের ধরন ও টাকার পরিমাণ সঠিকভাবে দিন।' });
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
          || normalizeSessionText(saved.session) !== payment.session
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
        await Payment.create(newPayments, transactionCreateOptions(session));
      });
    }
    return res.status(201).json(values);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'পেমেন্টটি ইতোমধ্যে সংরক্ষিত হয়েছে।' });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: 'পেমেন্টের তথ্য সঠিক নয়।' });
    }
    console.error('Payment posting failed:', error);
    const message = error?.message || 'পেমেন্ট সংরক্ষণ করা যায়নি।';
    return res.status(500).json({ error: message, message });
  }
}
