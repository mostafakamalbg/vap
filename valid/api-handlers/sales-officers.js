import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Invoice, Payment, SalesOfficer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import { roundAmount } from '../shared/salesReports.js';
import { calculateOfficerFinancials, filterOfficerRecordsByPeriod } from '../shared/officerFinancials.js';
import {
  getOfficerSalesTarget,
  hasOfficerSessionSalesTarget,
  mergeOfficerSalesTargets
} from '../shared/officerSalesTargets.js';
import { parseReportMonth, parseSessionDateRange } from '../shared/reportDateFilters.js';
import { normalizeSessionText } from '../shared/sessions.js';
import { ADMIN_ROLES, OFFICER_ROLE, isAdminRole } from '../shared/roles.js';

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

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function getOfficerSummaryFilter(officer) {
  return {
    $or: [
      ...(officer.id ? [{ officerId: officer.id }] : []),
      ...(officer.code ? [{ officerCode: officer.code }] : [])
    ]
  };
}

function hasLegacyTarget(record, session) {
  return hasOfficerSessionSalesTarget(record, session);
}

async function setOfficerSessionTarget(record, { session, date, amount }) {
  const targetPath = `salesTargets.${session}`;
  const datePath = `salesTargetDates.${session}`;
  if (record.salesTargets?.[session] != null || hasLegacyTarget(record, session)) {
    const error = new Error('এই অফিসারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।');
    error.statusCode = 409;
    throw error;
  }
  const saved = await SalesOfficer.findOneAndUpdate(
    { _id: record._id, [targetPath]: { $exists: false } },
    { $set: { [targetPath]: amount, [datePath]: date } },
    { new: true, runValidators: true }
  );
  if (!saved) {
    const error = new Error('এই অফিসারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।');
    error.statusCode = 409;
    throw error;
  }
  return saved;
}

async function createOfficerTargetSummary(normalizedOfficer, target) {
  const filter = getOfficerSummaryFilter(normalizedOfficer);
  let summary = await SalesOfficer.findOne(filter).lean();
  if (summary) return setOfficerSessionTarget(summary, target);

  const requestedSlNo = Number(normalizedOfficer.code.match(/\d+/)?.[0]);
  const highestSummary = await SalesOfficer.findOne({}).sort({ slNo: -1 }).select('slNo').lean();
  let slNo = Number.isSafeInteger(requestedSlNo) && requestedSlNo > 0
    ? requestedSlNo
    : (highestSummary?.slNo || 0) + 1;
  if (await SalesOfficer.exists({ slNo })) slNo = (highestSummary?.slNo || 0) + 1;

  while (true) {
    try {
      const [saved] = await SalesOfficer.create([{
        slNo,
        officerId: normalizedOfficer.id,
        officerCode: normalizedOfficer.code,
        officerName: normalizedOfficer.name,
        mobileNo: normalizedOfficer.mobileNo,
        salesTargets: { [target.session]: target.amount },
        salesTargetDates: { [target.session]: target.date }
      }]);
      return saved;
    } catch (error) {
      const keyPattern = Object.keys(error?.keyPattern || {});
      const isSerialNumberConflict = error?.code === 11000
        && ((keyPattern.length === 1 && keyPattern[0] === 'slNo')
          || error?.keyValue?.slNo != null
          || /index:\s*slNo_1/i.test(String(error?.message || '')));
      if (!isSerialNumberConflict) throw error;
      summary = await SalesOfficer.findOne(filter).lean();
      if (summary) return setOfficerSessionTarget(summary, target);
      const latestSummary = await SalesOfficer.findOne({})
        .sort({ slNo: -1 })
        .select('slNo')
        .lean();
      slNo = Math.max(slNo + 1, (latestSummary?.slNo || 0) + 1);
    }
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, [...ADMIN_ROLES, OFFICER_ROLE]);
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
      const conditions = isAdminRole(user.role) ? [] : [
        ...(user.officerId ? [{ officerId: String(user.officerId) }] : []),
        ...(code ? [{ officerCode: code }, { officerCode: String(user.officerCode) }] : [])
      ];
      const [storedRecords, invoices, typedPayments, legacyRecords] = await Promise.all([
        SalesOfficer.find(conditions.length ? { $or: conditions } : isAdminRole(user.role) ? {} : { _id: null })
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

    if (!isAdminRole(user.role)) {
      return res.status(403).json({ error: 'টার্গেট পরিবর্তনের অনুমতি নেই।' });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const officerId = String(body.officerId || '').trim();
      const officerCode = normalizeOfficerCode(body.officerCode);
      const session = normalizeSessionText(body.session);
      const date = String(body.date || '');
      const targetAmount = Number(body.targetAmount);
      const sessionRange = parseSessionDateRange(session);
      if ((!officerId && !officerCode)
        || !sessionRange
        || !validDate(date)
        || date < sessionRange.start
        || date >= sessionRange.end
        || String(body.targetAmount ?? '').trim() === ''
        || !Number.isFinite(targetAmount)
        || targetAmount < 0) {
        return res.status(400).json({ error: 'অফিসার, সেশন, তারিখ ও টার্গেটের পরিমাণ সঠিকভাবে দিন।' });
      }

      try {
        const officerRecords = await BusinessRecord.find({ type: 'officers' }).select('data').lean();
        const officer = officerRecords.map((record) => record.data).find((record) => (
          (officerId && String(record?.id || record?.officerId || '') === officerId)
          || (officerCode && normalizeOfficerCode(record?.code, record?.designation) === officerCode)
        ));
        if (!officer) return res.status(404).json({ error: 'নির্বাচিত অফিসার পাওয়া যায়নি।' });

        const normalizedOfficer = {
          id: String(officer.id || officer.officerId || ''),
          code: normalizeOfficerCode(officer.code, officer.designation),
          name: String(officer.name || officer.officerName || '').trim(),
          mobileNo: String(officer.phone || officer.mobileNo || '').trim()
        };
        if (hasLegacyTarget({ salesTargets: officer.salesTargets }, session)) {
          return res.status(409).json({
            error: 'এই অফিসারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।'
          });
        }
        const summary = await SalesOfficer.findOne(getOfficerSummaryFilter(normalizedOfficer)).lean();
        if (summary) {
          const saved = await setOfficerSessionTarget(summary, {
            session,
            date,
            amount: roundAmount(targetAmount)
          });
          return res.status(201).json(normalizeSalesOfficer(saved.toObject()));
        }
        const saved = await createOfficerTargetSummary(normalizedOfficer, {
          session,
          date,
          amount: roundAmount(targetAmount)
        });
        return res.status(201).json(normalizeSalesOfficer(saved.toObject()));
      } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
        if (error?.code === 11000) {
          return res.status(409).json({ error: 'এই অফিসারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।' });
        }
        console.error('Officer target import failed:', error);
        return res.status(500).json({ error: 'অফিসার টার্গেট সংরক্ষণ করা যায়নি।' });
      }
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
    const existingTarget = await SalesOfficer.findOne({ slNo }).lean();
    for (const field of numericFields) {
      if (body[field] != null && !Number.isFinite(Number(body[field]))) {
        return res.status(400).json({ error: 'টার্গেট বা সারাংশের টাকার পরিমাণ সঠিক নয়।' });
      }
      if (['salesTargetJulyDec2026', 'salesTargetJanJune2027'].includes(field)
        && body[field] != null
        && roundAmount(body[field]) !== roundAmount(existingTarget?.[field])) {
        return res.status(409).json({
          error: 'সেশন টার্গেট তারিখসহ নতুন টার্গেট ফর্মে ইমপোর্ট করুন; সংরক্ষিত টার্গেট পরিবর্তন করা যাবে না।'
        });
      }
      values[field] = body[field] == null
        ? roundAmount(existingTarget?.[field])
        : roundAmount(body[field]);
    }
    values.paymentAndExpense = {};
    for (const field of expenseFields) {
      if (body.paymentAndExpense?.[field] != null
        && !Number.isFinite(Number(body.paymentAndExpense[field]))) {
        return res.status(400).json({ error: 'খরচের পরিমাণ সঠিক নয়।' });
      }
      values.paymentAndExpense[field] = body.paymentAndExpense?.[field] == null
        ? roundAmount(existingTarget?.paymentAndExpense?.[field])
        : roundAmount(body.paymentAndExpense[field]);
    }

    if (body.salesTargets != null && (
      !body.salesTargets
      || typeof body.salesTargets !== 'object'
      || Array.isArray(body.salesTargets)
    )) {
      return res.status(400).json({ error: 'সেশন টার্গেটের তালিকা সঠিক নয়।' });
    }
    values.salesTargets = mergeOfficerSalesTargets(existingTarget?.salesTargets);
    for (const [rawSession, target] of Object.entries(body.salesTargets || {})) {
      const session = normalizeSessionText(rawSession);
      if (!parseSessionDateRange(session) || !Number.isFinite(Number(target)) || Number(target) < 0) {
        return res.status(400).json({ error: 'সেশন টার্গেটের পরিমাণ সঠিক নয়।' });
      }
      if (existingTarget?.salesTargets?.[session] == null) {
        return res.status(409).json({
          error: `${session} সেশনের নতুন টার্গেট তারিখসহ নতুন টার্গেট ফর্মে ইমপোর্ট করুন।`
        });
      }
      if (
        existingTarget?.salesTargets?.[session] != null
        && roundAmount(existingTarget.salesTargets[session]) !== roundAmount(target)
      ) {
        return res.status(409).json({
          error: `${session} সেশনে এই অফিসারের টার্গেট অলরেডি ইমপোর্ট করা আছে।`
        });
      }
      values.salesTargets = mergeOfficerSalesTargets(values.salesTargets, {
        [session]: roundAmount(target)
      });
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
