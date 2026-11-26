import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice, Payment, Product } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import {
  isDealerAssignedToOfficer,
  normalizeDealerAssignment,
  normalizeOfficerCode
} from '../shared/codes.js';
import { getDealersWithOfficerCodes } from '../lib/dealerAssignments.js';
import {
  dateRangeCondition,
  parseReportMonth,
  parseSessionDateRange,
  sessionPrimaryCondition,
  sessionsMatch
} from '../shared/reportDateFilters.js';
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
import { ADMIN_ROLES, isAdminRole, HIERARCHY_ROLE_VALUES, LOGISTIC_OFFICER_ROLE } from '../shared/roles.js';
import { resolveHierarchyScope } from '../lib/hierarchy.js';
import {
  buildOfficerOwnerFilter,
  matchesOfficerScope
} from '../shared/hierarchy.js';
import { sortProductsByCode } from '../shared/productSorting.js';

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
    req.method === 'PUT'
      ? [...ADMIN_ROLES, LOGISTIC_OFFICER_ROLE]
      : [...ADMIN_ROLES, ...HIERARCHY_ROLE_VALUES, LOGISTIC_OFFICER_ROLE]
  );
  if (!user) return;

  const type = String(req.query?.type || '');
  if (!recordTypes.has(type)) return res.status(400).json({ error: 'Unknown record type.' });
  if (req.method === 'PUT' && type === 'invoices') {
    return res.status(405).json({ error: 'ইনভয়েস সংরক্ষণ, সম্পাদনা ও মুছতে নির্দিষ্ট ইনভয়েস অপশন ব্যবহার করুন।' });
  }
  if (user.role === LOGISTIC_OFFICER_ROLE
    && !['products', 'officers', 'dealers', 'invoices', 'payments', 'stockInLogs', 'damageLogs'].includes(type)) {
    return res.status(403).json({ error: 'এই রেকর্ড দেখার অনুমতি নেই।' });
  }

  try {
    const Model = databaseModels[type];
    if (req.method === 'GET') {
      const scope = await resolveHierarchyScope(user);
      if (type === 'dealers') {
        const { officers, dealers } = await getDealersWithOfficerCodes();
        if (isAdminRole(user.role)) return res.status(200).json(dealers);
        if (user.role === LOGISTIC_OFFICER_ROLE) return res.status(200).json(dealers);
        const codes = new Set([...scope.officerCodes].map((code) => normalizeOfficerCode(code)).filter(Boolean));
        const ids = scope.officerIds;
        const visible = dealers.filter((dealer) => (
          codes.has(normalizeOfficerCode(dealer.officerCode))
          || ids.has(String(dealer.previousDueOfficerId || ''))
          || scope.users.some((entry) => (
            isDealerAssignedToOfficer(
              dealer,
              entry.officerCode,
              officers.find((officer) => String(officer.id || officer.officerId) === String(entry.officerId))
                ?.designation
            )
            || dealerHasOfficerPreviousDue(dealer, {
              officerIds: [entry.officerId],
              officerCode: entry.officerCode,
              designation: entry.role
            })
          ))
        ));
        return res.status(200).json(visible);
      }
      if (type === 'payments') {
        const conditions = [];
        if (!isAdminRole(user.role) && user.role !== LOGISTIC_OFFICER_ROLE) {
          conditions.push(buildOfficerOwnerFilter(scope));
        }
        if (req.query?.session != null) {
          const range = parseSessionDateRange(req.query.session);
          if (!range) return res.status(400).json({ error: 'সঠিক সেশন নির্বাচন করুন।' });
          conditions.push(sessionPrimaryCondition(req.query.session));
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
        const legacy = legacyRecords.map((record) => record.data).filter((payment) => {
          if (!payment || (payment.id && ids.has(String(payment.id)))) return false;
          if (payment.sourceInvoiceId && sources.has(String(payment.sourceInvoiceId))) return false;
          if (user.role !== LOGISTIC_OFFICER_ROLE && !matchesOfficerScope(payment, scope)) return false;
          if (req.query?.date != null && payment.date !== String(req.query.date)) return false;
          if (monthRange && !(String(payment.date || '') >= monthRange.start
            && String(payment.date || '') < monthRange.end)) return false;
          if (sessionRange) {
            const paymentDate = String(payment.date || '');
            const matchesSession = payment.session
              ? sessionsMatch(payment.session, req.query.session)
              : paymentDate >= sessionRange.start && paymentDate < sessionRange.end;
            if (!matchesSession) return false;
          }
          return true;
        });
        return res.status(200).json([...typed, ...legacy].map(normalizePaymentRecord));
      }
      if (Model) {
        const filter = !isAdminRole(user.role)
          && user.role !== LOGISTIC_OFFICER_ROLE
          && type === 'invoices'
          ? buildOfficerOwnerFilter(scope)
          : {};
        const query = Model.find(filter);
        if (type === 'invoices') query.sort({ createdAt: -1 });
        if (type === 'products') query.sort({ id: 1 });
        const records = await query.lean();
        return res.status(200).json(type === 'products' ? sortProductsByCode(records) : records);
      }
      let filter = { type };
      if (!isAdminRole(user.role)) {
        if (type === 'salesAgreements') {
          return res.status(403).json({ error: 'এই রেকর্ড দেখার অনুমতি নেই।' });
        }
        if (type === 'officers') {
          filter = {
            type,
            $or: [
              { recordId: { $in: [...scope.officerIds] } },
              buildOfficerOwnerFilter(scope, {
                idField: 'data.id',
                codeField: 'data.code',
                nameField: 'data.name'
              })
            ]
          };
        } else if (
          user.role === LOGISTIC_OFFICER_ROLE
          && ['stockInLogs', 'damageLogs'].includes(type)
        ) {
          filter = { type };
        } else if (['stockInLogs', 'damageLogs', 'payments'].includes(type)) {
          const ownerFilter = buildOfficerOwnerFilter(scope, {
            idField: 'data.officerId',
            codeField: 'data.officerCode',
            nameField: 'data.officerName'
          });
          filter = type === 'stockInLogs'
            ? {
              type,
              $or: [
                ...(ownerFilter.$or || []),
                {
                  'data.officerId': { $in: ['', null] },
                  'data.officerCode': { $in: ['', null] },
                  'data.officerName': { $in: ['', null] }
                }
              ]
            }
            : { type, ...ownerFilter };
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
        for (const payment of normalized) {
          await Payment.updateOne(
            { id: payment.id },
            { $setOnInsert: payment },
            { ...options, upsert: true }
          );
        }
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
      for (const [index, record] of normalizedRecords.entries()) {
        const recordId = getRecordId(record, index);
        const { _id, ...recordValues } = record;
        await Model.updateOne(
          { id: recordId },
          { $set: { ...recordValues, id: recordId } },
          { upsert: true, runValidators: true }
        );
      }
    } else {
      for (const [index, record] of records.entries()) {
        const recordId = getRecordId(record, index);
        const values = Object.fromEntries(Object.entries(record)
          .filter(([key]) => key !== '_id')
          .map(([key, value]) => [`data.${key}`, value]));
        await BusinessRecord.updateOne(
          { type, recordId },
          { $set: values },
          { upsert: true }
        );
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
