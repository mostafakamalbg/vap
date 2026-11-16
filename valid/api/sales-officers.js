import dbConnect from '../lib/mongodb.js';
import { SalesOfficer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import { roundAmount } from '../shared/salesReports.js';

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
      if (user.role === 'admin') {
        const records = await SalesOfficer.find({}).sort({ slNo: 1 }).lean();
        return res.status(200).json(records.map(normalizeSalesOfficer));
      }
      const code = normalizeOfficerCode(user.officerCode);
      const conditions = [
        ...(user.officerId ? [{ officerId: String(user.officerId) }] : []),
        ...(code ? [{ officerCode: code }, { officerCode: String(user.officerCode) }] : [])
      ];
      const records = conditions.length
        ? await SalesOfficer.find({ $or: conditions }).limit(1).lean()
        : [];
      return res.status(200).json(records.map(normalizeSalesOfficer));
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
