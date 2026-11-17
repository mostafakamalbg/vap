import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Invoice, Payment, SalesOfficer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import { roundAmount } from '../shared/salesReports.js';
import { calculateOfficerFinancials, filterOfficerRecordsByPeriod } from '../shared/officerFinancials.js';
import { getOfficerSalesTarget } from '../shared/officerSalesTargets.js';
import { parseReportMonth, parseSessionDateRange } from '../shared/reportDateFilters.js';

const numericFields = [
  'salesTargetJulyDec2026',
  'salesTargetJanJune2027',
  'lastSessionDue',
  'salesAmount',
  'returnAmount',
  'previousPlusNetSales',
  'totalReceivedAmount',
  'totalAmountDues',
  'totalNetSales',
  'totalSalesDues',
  'expensePercentage',
  'salesPercentage',
  'paymentPercentage'
];
const expenseFields = ['officePay', 'fare', 'salary', 'lc'];

function normalizeSalesOfficer(record) {
  return {
    ...record,
    ...Object.fromEntries(numericFields.map((field) => [field, roundAmount(record[field])])),
    paymentAndExpense: Object.fromEntries(expenseFields.map((field) => [
      field,
      roundAmount(record.paymentAndExpense?.[field])
    ]))
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['admin', 'officer']);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const session = String(req.query?.session || 'ALL');
      const month = String(req.query?.month || 'ALL');
      const date = String(req.query?.date || 'ALL');
      if (session !== 'ALL' && (!parseSessionDateRange(session) || session.length > 100)) {
        return res.status(400).json({ error: 'সঠিক সেশন নির্বাচন করুন।' });
      }
      if (month !== 'ALL' && !parseReportMonth(month)) {
        return res.status(400).json({ error: 'রিপোর্টের মাস সঠিক নয়।' });
      }
      if (date !== 'ALL') {
        const parsedDate = new Date(`${date}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
          || Number.isNaN(parsedDate.valueOf())
          || parsedDate.toISOString().slice(0, 10) !== date) {
          return res.status(400).json({ error: 'সঠিক তারিখ দিন।' });
        }
      }

      const code = normalizeOfficerCode(user.officerCode);
      const conditions = user.role === 'admin' ? [] : [
        ...(user.officerId ? [{ officerId: String(user.officerId) }] : []),
        ...(code ? [{ officerCode: code }, { officerCode: String(user.officerCode) }] : [])
      ];
      const [storedRecords, invoices, typedPayments, legacyRecords] = await Promise.all([
        SalesOfficer.find(conditions.length ? { $or: conditions } : user.role === 'admin' ? {} : { _id: null })
          .sort({ slNo: 1 }).lean(),
        Invoice.find({}).lean(),
        Payment.find({}).lean(),
        BusinessRecord.find({ type: 'payments' }).select('data').lean()
      ]);
      const knownIds = new Set(typedPayments.map((payment) => String(payment.id)));
      const knownInvoices = new Set(typedPayments.map((payment) => String(payment.sourceInvoiceId || '')).filter(Boolean));
      const legacyPayments = legacyRecords.map((record) => record.data).filter((payment) => (
        payment && !(payment.id && knownIds.has(String(payment.id)))
        && !(payment.sourceInvoiceId && knownInvoices.has(String(payment.sourceInvoiceId)))
      ));
      const payments = [...typedPayments, ...legacyPayments];
      return res.status(200).json(storedRecords.map((record) => {
        const officerCode = normalizeOfficerCode(record.officerCode);
        const matchesOfficer = (entry) => (
          (record.officerId && entry.officerId === record.officerId)
          || (officerCode && normalizeOfficerCode(entry.officerCode) === officerCode)
          || (record.officerName && entry.officerName === record.officerName)
        );
        const officerInvoices = filterOfficerRecordsByPeriod(invoices.filter(matchesOfficer), { session, month, date });
        const officerPayments = filterOfficerRecordsByPeriod(payments.filter(matchesOfficer), { session, month, date });
        const financials = calculateOfficerFinancials({
          invoices: officerInvoices,
          payments: officerPayments,
          salesTarget: getOfficerSalesTarget(record, session),
          lastSessionDue: month === 'ALL' ? record.lastSessionDue : 0
        });
        return {
          ...normalizeSalesOfficer(record),
          ...financials,
          paymentAndExpense: financials.paymentAndExpense
        };
      }));
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'টার্গেট পরিবর্তনের অনুমতি নেই।' });
    }
    const body = req.body || {};
    const slNo = Number(body.slNo);
    const officerName = String(body.officerName || '').trim();
    if (!Number.isSafeInteger(slNo) || slNo < 1 || !officerName) {
      return res.status(400).json({ error: 'অফিসারের ক্রমিক নম্বর ও নাম দিন।' });
    }
    const values = {
      slNo,
      officerId: String(body.officerId || ''),
      officerCode: normalizeOfficerCode(body.officerCode),
      officerName,
      mobileNo: String(body.mobileNo || '').trim()
    };
    for (const field of numericFields) {
      if (body[field] != null && !Number.isFinite(Number(body[field]))) {
        return res.status(400).json({ error: 'টার্গেট বা সারাংশের টাকার পরিমাণ সঠিক নয়।' });
      }
      values[field] = roundAmount(body[field]);
    }
    values.paymentAndExpense = {};
    for (const field of expenseFields) {
      if (body.paymentAndExpense?.[field] != null
        && !Number.isFinite(Number(body.paymentAndExpense[field]))) {
        return res.status(400).json({ error: 'খরচের পরিমাণ সঠিক নয়।' });
      }
      values.paymentAndExpense[field] = roundAmount(body.paymentAndExpense?.[field]);
    }

    if (body.salesTargets != null && (
      !body.salesTargets
      || typeof body.salesTargets !== 'object'
      || Array.isArray(body.salesTargets)
    )) {
      return res.status(400).json({ error: 'সেশন টার্গেটের তালিকা সঠিক নয়।' });
    }
    values.salesTargets = {};
    for (const [session, target] of Object.entries(body.salesTargets || {})) {
      if (!parseSessionDateRange(session) || !Number.isFinite(Number(target)) || Number(target) < 0) {
        return res.status(400).json({ error: 'সেশন টার্গেটের পরিমাণ সঠিক নয়।' });
      }
      values.salesTargets[session] = roundAmount(target);
    }

    const saved = await SalesOfficer.findOneAndUpdate(
      { slNo },
      { $set: values },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json(normalizeSalesOfficer(saved.toObject()));
  } catch (error) {
    console.error('Sales officer summary save failed:', error);
    return res.status(500).json({ error: 'অফিসারের টার্গেট বা সারাংশ সংরক্ষণ করা যায়নি।' });
  }
}
