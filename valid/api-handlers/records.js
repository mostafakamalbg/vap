import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice, Payment, Product } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import {
  getOfficerCodeAliases,
  isDealerAssignedToOfficer,
  normalizeDealerAssignment,
  normalizeOfficerCode
} from '../shared/codes.js';
import { getDealersWithOfficerCodes } from '../lib/dealerAssignments.js';
import { dateRangeCondition, parseReportMonth, parseSessionDateRange } from '../shared/reportDateFilters.js';
import {
  normalizePaymentMethod,
  normalizePaymentType,
  PAYMENT_TYPES,
  getPaymentRecordTypeValue,
  resolvePaymentRecordType
} from '../shared/paymentMethods.js';
import { dealerHasOfficerPreviousDue } from '../shared/officerLedger.js';
import { roundCurrency } from '../shared/invoiceTotals.js';
import { getInvoiceSessionForDate, normalizeSessionText } from '../shared/sessions.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { ADMIN_ROLES, OFFICER_ROLE, isAdminRole } from '../shared/roles.js';

const recordTypes = new Set([
  'products',
  'officers',
  'dealers',
  'invoices',
  'stockInLogs',
  'damageLogs',
  'payments',
  'salesAgreements'
]);
const databaseModels = { products: Product, dealers: Dealer, invoices: Invoice, payments: Payment };

function getRecordId(record, index) {
  return String(record?.id || record?.officerId || record?._id || `${Date.now()}-${index}`);
}

function normalizePaymentRecord(payment) {
  const paymentType = resolvePaymentRecordType(payment);
  return {
    ...payment,
    ...(paymentType ? { paymentType } : {}),
    paymentMethod: normalizePaymentMethod(payment.paymentMethod)
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(
    req,
    res,
    req.method === 'PUT' ? ADMIN_ROLES : [...ADMIN_ROLES, OFFICER_ROLE]
  );
  if (!user) return;

  const type = String(req.query?.type || '');
  if (!recordTypes.has(type)) return res.status(400).json({ error: 'Unknown record type.' });
  if (req.method === 'PUT' && type === 'invoices') {
    return res.status(405).json({ error: 'ইনভয়েস সংরক্ষণ, সম্পাদনা ও মুছতে নির্দিষ্ট ইনভয়েস অপশন ব্যবহার করুন।' });
  }

  try {
    const Model = databaseModels[type];
    if (req.method === 'GET') {
      if (type === 'dealers') {
        const { officers, dealers } = await getDealersWithOfficerCodes();
        if (isAdminRole(user.role)) return res.status(200).json(dealers);
        const normalizedUserCode = normalizeOfficerCode(user.officerCode);
        const officer = (user.officerId && officers.find((entry) => (
          String(entry.id || entry.officerId || '') === String(user.officerId || '')
        ))) || (normalizedUserCode && officers.find((entry) => (
          normalizeOfficerCode(entry.code, entry.designation) === normalizedUserCode
        )));
        const officerCode = user.officerCode || officer?.code;
        const designation = officer?.designation || '';
        return res.status(200).json(dealers.filter((dealer) => (
          isDealerAssignedToOfficer(dealer, officerCode, designation)
          || dealerHasOfficerPreviousDue(dealer, {
            officerIds: [user.officerId, officer?.id, officer?.officerId],
            officerCode,
            designation
          })
        )));
      }
      if (type === 'payments') {
        const conditions = [];
        const officerCodeAliases = new Set(getOfficerCodeAliases(user.officerCode));
        if (!isAdminRole(user.role)) {
          const ownerConditions = [
            ...(user.officerId ? [{ officerId: user.officerId }] : []),
            ...(officerCodeAliases.size ? [{
              officerCode: {
                $regex: new RegExp(`^(?:${[...officerCodeAliases]
                  .map((code) => code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                  .join('|')})$`, 'i')
              }
            }] : []),
            ...(user.name ? [{
              officerId: { $in: ['', null] },
              officerCode: { $in: ['', null] },
              officerName: String(user.name)
            }] : [])
          ];
          conditions.push(ownerConditions.length ? { $or: ownerConditions } : { id: '__no_records__' });
        }
        if (req.query?.session != null) {
          const range = parseSessionDateRange(req.query.session);
          if (!range) return res.status(400).json({ error: 'সঠিক সেশন নির্বাচন করুন।' });
          conditions.push({
            $or: [
              dateRangeCondition('date', range),
              {
                date: { $in: ['', null] },
                session: normalizeSessionText(req.query.session)
              }
            ]
          });
        }
        if (req.query?.month != null) {
          const range = parseReportMonth(req.query.month);
          if (!range) return res.status(400).json({ error: 'রিপোর্টের মাস সঠিক নয়।' });
          conditions.push(dateRangeCondition('date', range));
        }
        if (req.query?.date != null) {
          const date = String(req.query.date);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'সঠিক তারিখ দিন।' });
          conditions.push({ date });
        }
        const filter = conditions.length > 1 ? { $and: conditions } : conditions[0] || {};
        const [typed, legacyRecords] = await Promise.all([
          Payment.find(filter).sort({ date: -1 }).lean(),
          BusinessRecord.find({ type: 'payments' }).select('data').lean()
        ]);
        const ids = new Set(typed.map((payment) => String(payment.id)));
        const sources = new Set(typed.map((payment) => String(payment.sourceInvoiceId || '')).filter(Boolean));
        const monthRange = req.query?.month != null ? parseReportMonth(req.query.month) : null;
        const sessionRange = req.query?.session != null ? parseSessionDateRange(req.query.session) : null;
        const normalizedUserCode = normalizeOfficerCode(user.officerCode);
        const legacy = legacyRecords.map((record) => record.data).filter((payment) => {
          if (!payment || (payment.id && ids.has(String(payment.id)))) return false;
          if (payment.sourceInvoiceId && sources.has(String(payment.sourceInvoiceId))) return false;
          const matchesOfficer = Boolean(user.officerId
            && String(payment.officerId || '') === String(user.officerId))
            || officerCodeAliases.has(String(payment.officerCode || '').trim().toUpperCase())
            || Boolean(normalizedUserCode
              && normalizeOfficerCode(payment.officerCode) === normalizedUserCode)
            || Boolean(!payment.officerId && !payment.officerCode
              && user.name && String(payment.officerName || '').trim() === user.name);
          if (!isAdminRole(user.role) && !matchesOfficer) return false;
          if (req.query?.date != null && payment.date !== String(req.query.date)) return false;
          if (monthRange && !(String(payment.date || '') >= monthRange.start
            && String(payment.date || '') < monthRange.end)) return false;
          if (sessionRange) {
            const paymentDate = String(payment.date || '');
            const matchesSession = paymentDate
              ? paymentDate >= sessionRange.start && paymentDate < sessionRange.end
              : normalizeSessionText(payment.session) === normalizeSessionText(req.query.session);
            if (!matchesSession) return false;
          }
          return true;
        });
        return res.status(200).json([...typed, ...legacy].map(normalizePaymentRecord));
      }
      if (Model) {
        let filter = {};
        if (!isAdminRole(user.role) && type === 'invoices') {
          const officerCodeMatch = String(user.officerCode || '').match(/\d+/);
          const officerCodeDigits = officerCodeMatch ? String(Number(officerCodeMatch[0])) : '';
          const conditions = [
            ...(user.officerId ? [{ officerId: user.officerId }] : []),
            ...(officerCodeDigits ? [
              { officerId: `OFF-${officerCodeDigits.padStart(2, '0')}` },
              { officerCode: `SO-${officerCodeDigits.padStart(2, '0')}` }
            ] : []),
            ...(user.officerCode ? [
              { officerCode: user.officerCode },
              ...(officerCodeDigits ? [{ officerCode: officerCodeDigits }] : [])
            ] : [])
          ];
          filter = conditions.length ? { $or: conditions } : { id: '__no_records__' };
        }
        const query = Model.find(filter);
        if (type === 'invoices') query.sort({ createdAt: -1 });
        if (type === 'products') query.sort({ id: 1 });
        return res.status(200).json(await query.lean());
      }
      let filter = { type };
      if (!isAdminRole(user.role)) {
        if (type === 'salesAgreements') {
          return res.status(403).json({ error: 'এই রেকর্ড দেখার অনুমতি নেই।' });
        }
        if (type === 'officers') {
          filter = { type, recordId: user.officerId };
        } else if (['stockInLogs', 'damageLogs', 'payments'].includes(type)) {
          const officerCodeMatch = String(user.officerCode || '').match(/\d+/);
          const officerCodeDigits = officerCodeMatch ? String(Number(officerCodeMatch[0])) : '';
          const ownerConditions = [
            ...(user.officerId ? [{ 'data.officerId': user.officerId }] : []),
            ...(user.officerCode ? [
              { 'data.officerCode': user.officerCode },
              ...(officerCodeDigits ? [{ 'data.officerCode': officerCodeDigits }] : [])
            ] : [])
          ];
          filter = { type, ...(ownerConditions.length ? { $or: ownerConditions } : { recordId: '__no_records__' }) };
        }
      }
      const recordsQuery = BusinessRecord.find(filter);
      if (type === 'stockInLogs') {
        recordsQuery.sort({ 'data.date': -1, createdAt: -1 });
      }
      const records = await recordsQuery.lean();
      return res.status(200).json(records.map((record) => record.data));
    }

    const records = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Expected an array of records.' });

    if (type === 'payments') {
      const validTypes = new Set(PAYMENT_TYPES.map((entry) => entry.value));
      if (records.some((record) => {
        const paymentType = resolvePaymentRecordType(record);
        const hasPaymentType = getPaymentRecordTypeValue(record);
        return !record || typeof record !== 'object'
          || !Number.isFinite(Number(record.amount))
          || Number(record.amount) < 0
          || (hasPaymentType && !validTypes.has(paymentType));
      })) {
        return res.status(400).json({ error: 'পেমেন্টের ধরন ও টাকার পরিমাণ সঠিক নয়।' });
      }
      const normalized = records.map((record, index) => ({
        ...record,
        id: getRecordId(record, index),
        session: String(record.session || getInvoiceSessionForDate(record.date) || '').trim(),
        paymentType: normalizePaymentType(resolvePaymentRecordType(record)),
        amount: roundCurrency(record.amount),
        paymentMethod: normalizePaymentMethod(record.paymentMethod)
      }));
      await withTransactionFallback(async (session) => {
        const options = transactionOptions(session);
        await Payment.deleteMany({}, options);
        await BusinessRecord.deleteMany({ type: 'payments' }, options);
        if (normalized.length) await Payment.insertMany(normalized, options);
      });
      return res.status(200).json({ saved: records.length });
    }

    if (Model) {
      let normalizedRecords = records;
      if (type === 'dealers') {
        const officerRecords = await BusinessRecord.find({ type: 'officers' }).select('data').lean();
        const officers = officerRecords.map((record) => record.data).filter(Boolean);
        normalizedRecords = records.map((record) => normalizeDealerAssignment(record, officers));
      }
      await Model.deleteMany({});
      if (normalizedRecords.length) await Model.insertMany(normalizedRecords);
    } else {
      await BusinessRecord.deleteMany({ type });
      if (records.length) {
        await BusinessRecord.insertMany(records.map((record, index) => ({
          type,
          recordId: getRecordId(record, index),
          data: record
        })));
      }
    }
    return res.status(200).json({ saved: records.length });
  } catch (error) {
    console.error(`Record sync failed for ${type}:`, error);
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: 'রেকর্ডের তথ্য সঠিক নয়।' });
    }
    return res.status(500).json({ error: 'রেকর্ড পড়া বা সংরক্ষণ করা যায়নি।' });
  }
}
