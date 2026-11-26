import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice, Payment, SalesOfficer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import { getOfficerSalesTarget } from '../shared/officerSalesTargets.js';
import {
  getPaymentRecordTypeValue,
  getPaymentTypeAliases,
  PAYMENT_TYPE_FIELDS,
  PAYMENT_TYPES,
  resolvePaymentRecordType
} from '../shared/paymentMethods.js';
import {
  dateRangeCondition,
  parseReportMonth,
  parseSessionDateRange,
  sessionPrimaryCondition,
  sessionsMatch
} from '../shared/reportDateFilters.js';
import { getInvoiceSessionForDate, INVOICE_SESSIONS, normalizeSessionText } from '../shared/sessions.js';
import { ADMIN_ROLES, ASM_ROLE, LOGISTIC_OFFICER_ROLE, RSM_ROLE } from '../shared/roles.js';
import { HIERARCHY_ROLE_VALUES } from '../shared/roles.js';
import { resolveHierarchyScope } from '../lib/hierarchy.js';
import { buildOfficerOwnerFilter, matchesOfficerScope } from '../shared/hierarchy.js';
import { mergeOfficerRecords } from '../shared/officerIdentity.js';

const DAMAGE_TYPES = ['factory_damage', 'depot_factory_return'];
const RECEIPT_TYPES = new Set(['dealer_collection']);
const EXPENSE_FIELDS = {
  office_payment: 'officePayment',
  salary: 'salary',
  vehicle_rent: 'fare',
  lc_commission: 'lc'
};

export function getPeriodRange(period, value, startSession, endSession, startDate, endDate) {
  if (period === 'all') return { start: '0001-01-01', end: '9999-12-31' };
  if (period === 'month') return parseReportMonth(value);
  if (period === 'session') return parseSessionDateRange(value);
  if (period === 'session-range') {
    const start = parseSessionDateRange(startSession)?.start;
    const endRange = parseSessionDateRange(endSession);
    if (!start || !endRange) return null;
    if (start >= endRange.end) return null;
    return { start, end: endRange.end };
  }
  if (period === 'date-range') {
    const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date)
      && !Number.isNaN(new Date(`${date}T00:00:00.000Z`).valueOf())
      && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return null;
    const nextDay = new Date(`${endDate}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return { start: startDate, end: nextDay.toISOString().slice(0, 10) };
  }
  if (period === 'year' && /^20\d{2}$/.test(value)) {
    return { start: `${value}-01-01`, end: `${Number(value) + 1}-01-01` };
  }
  return null;
}

function invoicePipeline(match, { openingBalance = false } = {}) {
  return [
    { $match: { ...match, invoiceType: { $nin: DAMAGE_TYPES } } },
    {
      $lookup: {
        from: Dealer.collection.name,
        localField: 'dealerId',
        foreignField: 'id',
        as: 'dealerProfile'
      }
    },
    {
      $set: {
        dealerProfile: { $first: '$dealerProfile' },
        reportAmount: {
          $abs: {
            $cond: [
              { $ne: [{ $ifNull: ['$totalAmount', 0] }, 0] },
              '$totalAmount',
              { $ifNull: ['$grandTotal', '$totalAmount'] }
            ]
          }
        }
      }
    },
    { $sort: { date: 1, createdAt: 1 } },
    {
      $group: {
        _id: {
          officerId: '$officerId',
          officerCode: '$officerCode',
          officerName: '$officerName',
          dealerId: '$dealerId',
          dealerCode: '$dealerCode',
          dealerName: {
            $cond: [
              { $ne: [{ $ifNull: ['$dealerName', ''] }, ''] },
              '$dealerName',
              '$dealerProfile.shopName'
            ]
          },
          mobileNo: {
            $cond: [
              { $ne: [{ $ifNull: ['$dealerPhone', ''] }, ''] },
              '$dealerPhone',
              { $ifNull: ['$dealerProfile.phone', '$dealerProfile.mobile'] }
            ]
          },
          openingDue: {
            $ifNull: [
              openingBalance ? '$dealerProfile.openingDue' : '$dealerProfile.lastSessionDue',
              openingBalance ? '$dealerProfile.lastSessionDue' : '$dealerProfile.openingDue'
            ]
          }
        },
        salesAmount: {
          $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, 0, '$reportAmount'] }
        },
        returnAmount: {
          $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, '$reportAmount', 0] }
        },
        invoicePaid: {
          $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, 0, { $ifNull: ['$paidAmount', 0] }] }
        },
        invoiceCount: { $sum: 1 },
        recordedPreviousDue: { $first: { $ifNull: ['$previousDue', 0] } }
      }
    }
  ];
}

export function paymentPipeline(match) {
  const directMatch = { ...match };
  const matchConditions = Array.isArray(directMatch.$and) ? directMatch.$and : [];
  delete directMatch.$and;
  const normalizeTypeField = (field) => ({
    $toLower: {
      $trim: {
        input: {
          $regexReplace: {
            input: {
              $regexReplace: {
                input: {
                  $regexReplace: {
                    input: {
                      $convert: {
                        input: `$${field}`,
                        to: 'string',
                        onError: '',
                        onNull: ''
                      }
                    },
                    regex: '[._-]+',
                    replacement: ' '
                  }
                },
                regex: '\\s*/\\s*',
                replacement: '/'
              }
            },
            regex: '\\s+',
            replacement: ' '
          }
        }
      }
    }
  });
  const paymentTypeBranches = PAYMENT_TYPE_FIELDS.flatMap((field) => (
    PAYMENT_TYPES.map((type) => ({
      case: { $in: [normalizeTypeField(field), getPaymentTypeAliases(type.value)] },
      then: type.value
    }))
  ));
  const blankCategoryFields = PAYMENT_TYPE_FIELDS
    .filter((field) => field !== 'type')
    .map((field) => ({ $eq: [normalizeTypeField(field), ''] }));
  const resolvedPaymentType = {
    $switch: {
      branches: paymentTypeBranches,
      default: {
        $cond: [
          { $and: blankCategoryFields },
          'dealer_collection',
          ''
        ]
      }
    }
  };
  return [
    {
      $match: {
        ...directMatch,
        $and: [
          ...matchConditions,
          {
            $or: [
              { sourceInvoiceId: { $exists: false } },
              { sourceInvoiceId: '' },
              { sourceInvoiceId: null }
            ]
          },
          { reference: { $not: /(?:invoice|চালান)\s*#/i } }
        ]
      }
    },
    {
      $lookup: {
        from: Dealer.collection.name,
        localField: 'dealerId',
        foreignField: 'id',
        as: 'dealerProfile'
      }
    },
    { $set: { dealerProfile: { $first: '$dealerProfile' } } },
    { $set: { resolvedPaymentType } },
    {
      $group: {
        _id: {
          officerId: '$officerId',
          officerCode: '$officerCode',
          officerName: '$officerName',
          dealerId: '$dealerId',
          dealerName: {
            $cond: [
              { $ne: [{ $ifNull: ['$dealerName', ''] }, ''] },
              '$dealerName',
              '$dealerProfile.shopName'
            ]
          },
          mobileNo: {
            $cond: [
              { $ne: [{ $ifNull: ['$dealerPhone', ''] }, ''] },
              '$dealerPhone',
              { $ifNull: ['$dealerProfile.phone', '$dealerProfile.mobile'] }
            ]
          },
          openingDue: {
            $ifNull: ['$dealerProfile.lastSessionDue', '$dealerProfile.openingDue']
          }
        },
        collection: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'dealer_collection'] },
              { $ifNull: ['$amount', 0] },
              0
            ]
          }
        },
        officePayment: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'office_payment'] },
              { $ifNull: ['$amount', 0] },
              0
            ]
          }
        },
        salary: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'salary'] },
              { $ifNull: ['$amount', 0] },
              0
            ]
          }
        },
        fare: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'vehicle_rent'] },
              { $ifNull: ['$amount', 0] },
              0
            ]
          }
        },
        lc: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'lc_commission'] },
              { $ifNull: ['$amount', 0] },
              0
            ]
          }
        }
      }
    }
  ];
}

function officerMatches(row, officer) {
  const rowCode = normalizeOfficerCode(row.officerCode);
  const officerCode = normalizeOfficerCode(officer.code || officer.officerCode);
  return Boolean(
    (row.officerId && String(row.officerId) === String(officer.id || officer.officerId))
    || (rowCode && officerCode && rowCode === officerCode)
    || (!row.officerId && !row.officerCode
      && row.officerName && row.officerName === (officer.name || officer.officerName))
  );
}

function matchesHierarchyUser(officer, entry) {
  return Boolean(
    (entry.officerId && String(officer.id || officer.officerId || '') === String(entry.officerId))
    || (entry.officerCode
      && normalizeOfficerCode(officer.code || officer.officerCode) === normalizeOfficerCode(entry.officerCode))
    || (entry.name && (officer.name || officer.officerName) === entry.name)
  );
}

function addPaymentRows(groups, rows, { period, periodValue, periodRange, beforePeriod, scope }) {
  rows.forEach((payment) => {
    const date = String(payment.date || '');
    const explicitSession = normalizeSessionText(payment.session);
    if (period === 'session') {
      if (beforePeriod && sessionsMatch(explicitSession, periodValue)) return;
      if (!beforePeriod && explicitSession) {
        if (!sessionsMatch(explicitSession, periodValue)) return;
      } else if (date && (beforePeriod
        ? date >= periodRange.start
        : date < periodRange.start || date >= periodRange.end)) {
        return;
      } else if (!date && (!explicitSession || beforePeriod)) {
        return;
      }
    } else if (date) {
      if (beforePeriod ? date >= periodRange.start : date < periodRange.start || date >= periodRange.end) return;
    } else return;
    if (!matchesOfficerScope(payment, scope)) return;
    if (payment.sourceInvoiceId || /(?:invoice|চালান)\s*#/i.test(String(payment.reference || ''))) return;
    const owner = {
      officerId: payment.officerId || '',
      officerCode: payment.officerCode || '',
      officerName: payment.officerName || ''
    };
    const dealerKey = payment.dealerId || payment.dealerName || payment.dealerPhone || '';
    const key = `${owner.officerId}|${normalizeOfficerCode(owner.officerCode)}|${owner.officerName}|${dealerKey}`;
    const group = groups.get(key) || {
      _id: {
        ...owner,
        dealerId: payment.dealerId || '',
        dealerName: payment.dealerName || '',
        mobileNo: payment.dealerPhone || ''
      },
      collection: 0,
      officePayment: 0,
      salary: 0,
      fare: 0,
      lc: 0
    };
    const amount = Number(payment.amount) || 0;
    const type = resolvePaymentRecordType(payment)
      || (!getPaymentRecordTypeValue(payment) ? 'dealer_collection' : '');
    if (RECEIPT_TYPES.has(type)) group.collection += amount;
    const field = EXPENSE_FIELDS[type];
    if (field) group[field] += amount;
    groups.set(key, group);
  });
}

function roundAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const user = await authorize(
    req,
    res,
    [...ADMIN_ROLES, ...HIERARCHY_ROLE_VALUES, LOGISTIC_OFFICER_ROLE]
  );
  if (!user) return;

  const period = String(req.query?.period || 'all');
  const value = String(req.query?.value || (period === 'all' ? 'ALL' : ''));
  const periodRange = getPeriodRange(
    period,
    value,
    String(req.query?.startSession || ''),
    String(req.query?.endSession || ''),
    String(req.query?.startDate || ''),
    String(req.query?.endDate || '')
  );
  if (!periodRange) return res.status(400).json({ error: 'রিপোর্টের সময়সীমা সঠিক নয়।' });

  try {
    const scope = await resolveHierarchyScope(user);
    const ownerMatch = buildOfficerOwnerFilter(scope);
    const asmFilter = String(req.query?.asm || '');
    const selectedAsm = asmFilter
      ? user.role === RSM_ROLE
        ? scope.users.find((entry) => (
          entry.role === ASM_ROLE && String(entry._id || entry.id) === asmFilter
        ))
        : null
      : null;
    if (asmFilter && !selectedAsm) {
      return res.status(403).json({ error: 'নির্বাচিত ASM আপনার অনুমোদিত অধীনস্থ নন।' });
    }
    const hierarchyUsers = selectedAsm
      ? scope.users.filter((entry) => (
        String(entry._id || entry.id) === asmFilter || String(entry.asmId || '') === asmFilter
      ))
      : scope.users;
    const periodMatch = period === 'all'
      ? ownerMatch
      : period === 'session'
        ? { $and: [sessionPrimaryCondition(value), ownerMatch] }
        : { ...dateRangeCondition('date', periodRange), ...ownerMatch };
    const periodPaymentMatch = period === 'session'
      ? {
          $and: [
            sessionPrimaryCondition(value),
            ownerMatch
          ]
        }
      : periodMatch;
    const priorMatch = period === 'all' ? { _id: null } : {
      date: { $lt: periodRange.start },
      ...ownerMatch
    };
    const [officerRecords, salesOfficerRecords, periodInvoices, priorInvoices, periodPayments, priorPayments, typedPayments, legacyRecords] = await Promise.all([
      BusinessRecord.find({ type: 'officers' }).select('data').lean(),
      SalesOfficer.find(ownerMatch).sort({ slNo: 1 }).lean(),
      Invoice.aggregate(invoicePipeline(periodMatch, { openingBalance: period === 'all' })),
      Invoice.aggregate(invoicePipeline(priorMatch)),
      Payment.aggregate(paymentPipeline(periodPaymentMatch)),
      Payment.aggregate(paymentPipeline(priorMatch)),
      Payment.find(ownerMatch).select('id sourceInvoiceId').lean(),
      BusinessRecord.find({ type: 'payments' }).select('data').lean()
    ]);

    const roster = mergeOfficerRecords([
      ...officerRecords.map((record) => record.data),
      ...salesOfficerRecords,
      ...scope.users.map((entry) => ({
        id: String(entry.officerId || ''),
        officerId: String(entry.officerId || ''),
        code: normalizeOfficerCode(entry.officerCode),
        officerCode: entry.officerCode || '',
        name: entry.name || '',
        phone: entry.phone || '',
        territory: entry.territory || '',
        role: entry.role,
        asmId: String(entry.asmId || ''),
        rsmId: String(entry.rsmId || ''),
        hierarchyUserId: String(entry._id || entry.id || '')
      }))
    ]);

    const typedPaymentIds = new Set(typedPayments.map((payment) => String(payment.id)));
    const typedInvoiceSources = new Set(typedPayments.map((payment) => String(payment.sourceInvoiceId || '')).filter(Boolean));
    const legacyPayments = legacyRecords.map((record) => record.data).filter((payment) => (
      payment
      && !(payment.id && typedPaymentIds.has(String(payment.id)))
      && !(payment.sourceInvoiceId && typedInvoiceSources.has(String(payment.sourceInvoiceId)))
    ));
    const periodPaymentGroups = new Map();
    const priorPaymentGroups = new Map();
    addPaymentRows(periodPaymentGroups, legacyPayments, {
      period,
      periodValue: value,
      periodRange,
      beforePeriod: false,
      scope
    });
    addPaymentRows(priorPaymentGroups, legacyPayments, {
      period,
      periodValue: value,
      periodRange,
      beforePeriod: true,
      scope
    });
    const allPeriodPayments = [...periodPayments, ...periodPaymentGroups.values()];
    const allPriorPayments = [...priorPayments, ...priorPaymentGroups.values()];

    const filteredRoster = roster.filter((officer) => (
      matchesOfficerScope({
        officerId: officer.id || officer.officerId,
        officerCode: officer.code || officer.officerCode,
        officerName: officer.name || officer.officerName
      }, scope)
      && (!selectedAsm || hierarchyUsers.some((entry) => matchesHierarchyUser(officer, entry)))
    ));
    const rows = filteredRoster.map((officer, index) => {
      const periodOfficerInvoices = periodInvoices.filter((row) => officerMatches(row._id, officer));
      const priorOfficerInvoices = priorInvoices.filter((row) => officerMatches(row._id, officer));
      const periodOfficerPayments = allPeriodPayments.filter((row) => officerMatches(row._id, officer));
      const priorOfficerPayments = allPriorPayments.filter((row) => officerMatches(row._id, officer));
      const partyMap = new Map();
      const addInvoice = (row, isPrior) => {
        const dealer = row._id;
        const key = dealer.dealerId || dealer.dealerName || dealer.mobileNo || `${officer.id}-unknown`;
        const party = partyMap.get(key) || {
          dealerId: dealer.dealerId || '',
          dealerName: dealer.dealerName || dealer.dealerCode || 'নাম নেই',
          mobileNo: dealer.mobileNo || '',
          previousDue: roundAmount(dealer.openingDue ?? dealer.recordedPreviousDue),
          sales: 0,
          returns: 0,
          invoicePaid: 0,
          invoiceCount: 0,
          salary: 0,
          officePayment: 0,
          fare: 0,
          lc: 0,
          collection: 0
        };
        if (isPrior) {
          party.previousDue += roundAmount(row.salesAmount) - roundAmount(row.returnAmount)
            - roundAmount(row.invoicePaid);
        } else {
          party.sales += roundAmount(row.salesAmount);
          party.returns += roundAmount(row.returnAmount);
          party.invoicePaid += roundAmount(row.invoicePaid);
          party.invoiceCount += roundAmount(row.invoiceCount);
        }
        partyMap.set(key, party);
      };
      priorOfficerInvoices.forEach((row) => addInvoice(row, true));
      periodOfficerInvoices.forEach((row) => addInvoice(row, false));
      const expenses = { officePayment: 0, fare: 0, salary: 0, lc: 0 };
      const collectPayments = (paymentRows, isPrior) => paymentRows.forEach((row) => {
        const group = row._id;
        const dealerKey = group.dealerId || group.dealerName || group.mobileNo;
        if (dealerKey) {
          const party = partyMap.get(dealerKey) || {
            dealerId: group.dealerId || '',
            dealerName: group.dealerName || 'নাম নেই',
            mobileNo: group.mobileNo || '',
            previousDue: roundAmount(group.openingDue),
            sales: 0,
            returns: 0,
            invoicePaid: 0,
            invoiceCount: 0,
            salary: 0,
            officePayment: 0,
            fare: 0,
            lc: 0,
            collection: 0
          };
          if (isPrior) {
            party.previousDue -= roundAmount(row.collection)
              + roundAmount(row.officePayment)
              + roundAmount(row.salary)
              + roundAmount(row.fare)
              + roundAmount(row.lc);
          }
          else {
            party.collection += roundAmount(row.collection);
            party.officePayment += roundAmount(row.officePayment);
            party.salary += roundAmount(row.salary);
            party.fare += roundAmount(row.fare);
            party.lc += roundAmount(row.lc);
          }
          partyMap.set(dealerKey, party);
        }
        if (!isPrior) {
          expenses.officePayment += roundAmount(row.officePayment);
          expenses.fare += roundAmount(row.fare);
          expenses.salary += roundAmount(row.salary);
          expenses.lc += roundAmount(row.lc);
        }
      });
      collectPayments(priorOfficerPayments, true);
      collectPayments(periodOfficerPayments, false);

      const parties = [...partyMap.values()].map((party, partyIndex) => {
        const netSales = party.sales - party.returns;
        const expensesForParty = party.officePayment + party.salary + party.fare + party.lc;
        const actualReceived = party.invoicePaid + party.collection + expensesForParty;
        const previousPlusNetSales = party.previousDue + netSales;
        const totalCollection = expensesForParty + party.collection;
        return {
          ...party,
          slNo: partyIndex + 1,
          sales: roundAmount(party.sales),
          returns: roundAmount(party.returns),
          netSales: roundAmount(netSales),
          actualReceived: roundAmount(actualReceived),
          previousPlusNetSales: roundAmount(previousPlusNetSales),
          totalCollection: roundAmount(totalCollection),
          dues: roundAmount(previousPlusNetSales - actualReceived),
          ledgerDues: roundAmount(previousPlusNetSales - totalCollection)
        };
      }).sort((left, right) => left.dealerName.localeCompare(right.dealerName));

      const salesAmount = parties.reduce((sum, party) => sum + party.sales, 0);
      const returnAmount = parties.reduce((sum, party) => sum + party.returns, 0);
      const totalNetSales = salesAmount - returnAmount;
      const derivedPreviousDue = parties.reduce((sum, party) => sum + party.previousDue, 0);
      const previousDue = period === 'all'
        ? derivedPreviousDue
        : derivedPreviousDue || roundAmount(officer.lastSessionDue);
      const previousPlusNetSales = previousDue + totalNetSales;
      const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
      const actualCollections = parties.reduce(
        (sum, party) => sum + party.invoicePaid + party.collection,
        0
      );
      const totalReceivedAmount = roundAmount(totalExpenses + actualCollections);
      const session = period === 'session'
        ? value
        : period === 'month'
          ? getInvoiceSessionForDate(`${value}-01`)
          : period === 'year' ? `জানুয়ারি - জুন ${value}` : '';
      const allTargets = [...new Set([
        ...INVOICE_SESSIONS,
        ...Object.keys(officer.salesTargets || {})
      ])].reduce((sum, entry) => sum + getOfficerSalesTarget(officer, entry), 0);
      const sessionTarget = period === 'all'
        ? allTargets
        : period === 'session-range' || period === 'date-range'
        ? INVOICE_SESSIONS.filter((entry) => {
            const range = parseSessionDateRange(entry);
            return Boolean(range && range.start >= periodRange.start && range.end <= periodRange.end);
          }).reduce((sum, entry) => sum + getOfficerSalesTarget(officer, entry), 0)
        : session ? getOfficerSalesTarget(officer, session) : 0;
      const targetYear = value.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
      const julyDecemberTarget = getOfficerSalesTarget(officer, `জুলাই - ডিসেম্বর ${targetYear}`);
      const yearlyTarget = period === 'all'
        ? allTargets
        : period === 'year'
        ? getOfficerSalesTarget(officer, `জানুয়ারি - জুন ${value}`)
          + getOfficerSalesTarget(officer, `জুলাই - ডিসেম্বর ${value}`)
        : getOfficerSalesTarget(officer, `জানুয়ারি - জুন ${value.slice(0, 4)}`)
          + getOfficerSalesTarget(officer, `জুলাই - ডিসেম্বর ${value.slice(0, 4)}`);
      const target = period === 'year' ? yearlyTarget : sessionTarget;
      return {
        slNo: officer.slNo || index + 1,
        officerId: officer.id || officer.officerId || '',
        officerCode: officer.code || officer.officerCode || '',
        officerName: officer.name || officer.officerName || user.name || '',
        mobileNo: officer.phone || officer.mobileNo || '',
        yearlyTarget: roundAmount(yearlyTarget),
        sessionTarget: roundAmount(sessionTarget),
        julyDecemberTarget: roundAmount(julyDecemberTarget),
        lastDue: roundAmount(previousDue),
        salesAmount: roundAmount(salesAmount),
        returnAmount: roundAmount(returnAmount),
        previousPlusNetSales: roundAmount(previousPlusNetSales),
        paymentAndExpense: Object.fromEntries(
          Object.entries(expenses).map(([field, amount]) => [field, roundAmount(amount)])
        ),
        totalReceivedAmount,
        totalAmountDues: roundAmount(previousPlusNetSales - totalReceivedAmount),
        totalNetSales: roundAmount(totalNetSales),
        totalSalesDues: roundAmount(target - previousPlusNetSales),
        salesPercentage: target ? roundAmount(previousPlusNetSales / target * 100) : 0,
        paymentPercentage: Number.isFinite(previousPlusNetSales)
          && previousPlusNetSales > 0
          && Number.isFinite(totalReceivedAmount)
          ? roundAmount(totalReceivedAmount / previousPlusNetSales * 100)
          : 0,
        invoiceCount: parties.reduce((sum, party) => sum + party.invoiceCount, 0),
        totalExpenses: roundAmount(totalExpenses),
        expensePercentage: totalNetSales ? roundAmount(totalExpenses / totalNetSales * 100) : 0,
        parties
      };
    });

    const officerFilter = String(req.query?.officer || '');
    const resultRows = officerFilter
      ? rows.filter((row) => row.officerId === officerFilter || row.officerCode === officerFilter)
      : rows;
    const asms = user.role === RSM_ROLE
      ? scope.users.filter((entry) => entry.role === ASM_ROLE).map((entry) => ({
        id: String(entry._id || entry.id || ''),
        name: String(entry.name || ''),
        officerCode: String(entry.officerCode || '')
      }))
      : [];
    return res.status(200).json({ period, value, asms, officers: resultRows });
  } catch (error) {
    console.error('Dashboard report aggregation failed:', error);
    return res.status(500).json({ error: 'লাইভ ড্যাশবোর্ড রিপোর্ট তৈরি করা যায়নি।' });
  }
}
