import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice, Payment, SalesOfficer, User } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import { getOfficerSalesTarget } from '../shared/officerSalesTargets.js';
import {
  FARE_AMOUNT_FIELDS,
  getPaymentAmount,
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
import {
  getInvoiceSessionForDate,
  INVOICE_SESSIONS,
  LEGACY_INVOICE_SESSION,
  normalizeSessionText
} from '../shared/sessions.js';
import { ADMIN_ROLES, ASM_ROLE, LOGISTIC_OFFICER_ROLE, RSM_ROLE } from '../shared/roles.js';
import { HIERARCHY_ROLE_VALUES } from '../shared/roles.js';
import { resolveHierarchyScope } from '../lib/hierarchy.js';
import { buildOfficerOwnerFilter, matchesOfficerScope } from '../shared/hierarchy.js';
import { mergeOfficerRecords, officerRecordsMatch } from '../shared/officerIdentity.js';
import { getOfficerPreviousDueByDealer } from '../shared/officerLedger.js';

const DAMAGE_TYPES = ['factory_damage', 'depot_factory_return'];
const RECEIPT_TYPES = new Set(['dealer_collection']);
const LEGACY_PAYMENT_RECORD_TYPES = ['payments', 'payment', 'expenses', 'expense', 'vouchers', 'voucher'];
const EXPENSE_FIELDS = {
  office_payment: 'officePayment',
  salary: 'salary',
  vehicle_rent: 'fare',
  lc_commission: 'lc'
};
const INVOICE_CANCELLATION_FLAGS = [
  'isCancelled',
  'isCanceled',
  'cancelled',
  'canceled',
  'isDeleted',
  'deleted'
];
const INVOICE_CANCELLATION_DATES = ['cancelledAt', 'canceledAt', 'deletedAt'];

function isAllSelection(value) {
  return ['all', 'all sessions', 'all months', 'সকল সেশন', 'সকল মাস', 'সকল সেশন / সকল মাস']
    .includes(String(value || '').trim().toLocaleLowerCase());
}

export function normalizeReportPeriod(period, value) {
  const resolvedPeriod = ['session', 'month'].includes(period) && isAllSelection(value)
    ? 'all'
    : period;
  return {
    period: resolvedPeriod,
    value: resolvedPeriod === 'all' ? 'ALL' : value
  };
}

function canonicalSession(session) {
  const range = parseSessionDateRange(session);
  if (!range) return '';
  const year = range.start.slice(0, 4);
  return range.start.endsWith('-01-01')
    ? `জানুয়ারি - জুন ${year}`
    : `জুলাই - ডিসেম্বর ${year}`;
}

function invoiceValidityCondition() {
  return {
    $and: [
      { status: { $not: /cancel|void|delete|বাতিল/i } },
      { invoiceStatus: { $not: /cancel|void|delete|বাতিল/i } },
      ...INVOICE_CANCELLATION_FLAGS.map((field) => ({ [field]: { $ne: true } })),
      ...INVOICE_CANCELLATION_DATES.map((field) => ({ [field]: { $in: [null, ''] } }))
    ]
  };
}

async function settleReportSources(sources) {
  const results = await Promise.allSettled(sources.map(([, query]) => query));
  const values = {};
  const warnings = [];
  results.forEach((result, index) => {
    const [name] = sources[index];
    if (result.status === 'fulfilled') {
      values[name] = result.value;
      return;
    }
    console.error(`Dashboard report ${name} source failed:`, result.reason);
    warnings.push(name);
    values[name] = [];
  });
  return { values, warnings };
}

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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDealerOwnerFilter(scope) {
  if (scope.global) return {};
  const conditions = [];
  const officerIds = [...scope.officerIds];
  const hierarchyIds = [
    ...scope.userIds,
    ...(scope.users || []).map((entry) => entry._id).filter(Boolean)
  ];
  if (officerIds.length) {
    conditions.push(
      { officerId: { $in: officerIds } },
      { assignedOfficerId: { $in: officerIds } }
    );
  }
  if (hierarchyIds.length) {
    ['soId', 'asmId', 'rsmId', 'userId', 'officerUserId', 'salesOfficerId'].forEach((field) => {
      conditions.push({ [field]: { $in: hierarchyIds } });
    });
    conditions.push({ previousDueOfficerId: { $in: hierarchyIds } });
  }
  if (scope.officerIds.size) {
    conditions.push({ previousDueOfficerId: { $in: [...scope.officerIds] } });
  }
  [...scope.officerCodes].forEach((code) => {
    const regex = { $regex: `^${escapeRegex(code)}$`, $options: 'i' };
    conditions.push(
      { officerCode: regex },
      { assignedOfficerCode: regex }
    );
  });
  return conditions.length ? { $or: conditions } : { _id: null };
}

export function buildReportOwnerMatch(scope, dealerIds = []) {
  const ownerMatch = buildOfficerOwnerFilter(scope);
  if (scope.global || !dealerIds.length) return ownerMatch;
  const directConditions = ownerMatch.$or || [ownerMatch];
  return {
    $or: [
      ...directConditions,
      {
        officerId: { $in: ['', null] },
        officerCode: { $in: ['', null] },
        officerName: { $in: ['', null] },
        userId: { $in: ['', null] },
        officerUserId: { $in: ['', null] },
        employeeId: { $in: ['', null] },
        dealerId: { $in: dealerIds }
      }
    ]
  };
}

export function priorSessionCondition(value) {
  const selectedRange = parseSessionDateRange(value);
  if (!selectedRange) return null;
  const priorSessions = INVOICE_SESSIONS.filter((session) => {
    const range = parseSessionDateRange(session);
    return range && range.end <= selectedRange.start;
  });
  const priorSessionAliases = priorSessions.flatMap((session) => {
    const range = parseSessionDateRange(session);
    const year = range.start.slice(0, 4);
    const aliases = range.start.endsWith('-01-01')
      ? [`January-June ${year}`, `January - June ${year}`]
      : [`July-December ${year}`, `July - December ${year}`];
    return [session, ...aliases];
  });
  return {
    $or: [
      { session: { $in: [...new Set(priorSessionAliases)] } },
      {
        $and: [
          { session: { $in: ['', null, LEGACY_INVOICE_SESSION] } },
          { date: { $lt: selectedRange.start } }
        ]
      }
    ]
  };
}

function reportOwnerField(field, dealerFields) {
  const dealerValue = dealerFields.reduceRight(
    (value, dealerField) => ({
      $cond: [
        { $ne: [{ $ifNull: [`$dealerProfile.${dealerField}`, ''] }, ''] },
        `$dealerProfile.${dealerField}`,
        value
      ]
    }),
    ''
  );
  const strongFields = field === 'officerId'
    ? ['officerId', 'userId', 'officerUserId', 'employeeId']
    : [field];
  const weakFields = field === 'officerId'
    ? ['createdBy']
    : field === 'officerName'
      ? ['name']
      : [];
  const fieldValue = (fields) => fields.reduceRight(
    (value, directField) => ({
      $cond: [
        { $ne: [{ $ifNull: [`$${directField}`, ''] }, ''] },
        `$${directField}`,
        value
      ]
    }),
    ''
  );
  const strongValue = fieldValue(strongFields);
  const weakValue = fieldValue(weakFields);
  return {
    $cond: [
      { $ne: [strongValue, ''] },
      strongValue,
      {
        $cond: [
          { $ne: [dealerValue, ''] },
          dealerValue,
          weakValue
        ]
      },
    ]
  };
}

function invoicePipeline(match, { openingBalance = false } = {}) {
  return [
    {
      $match: {
        $and: [
          match,
          { invoiceType: { $nin: DAMAGE_TYPES } },
          invoiceValidityCondition()
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
    {
      $set: {
        reportAmount: {
          $abs: {
            $cond: [
              { $ne: [{ $ifNull: ['$totalAmount', 0] }, 0] },
              '$totalAmount',
              { $ifNull: ['$grandTotal', '$totalAmount'] }
            ]
          }
        },
        reportOfficerId: reportOwnerField(
          'officerId',
          ['assignedOfficerId', 'officerId', 'salesOfficerId', 'officerUserId', 'soId', 'asmId', 'rsmId']
        ),
        reportOfficerCode: reportOwnerField(
          'officerCode',
          ['assignedOfficerCode', 'officerCode', 'soCode', 'asmCode', 'rsmCode']
        ),
        reportOfficerName: reportOwnerField('officerName', ['assignedOfficerName', 'officerName'])
      }
    },
    { $sort: { date: 1, createdAt: 1 } },
    {
      $group: {
        _id: {
          officerId: '$reportOfficerId',
          officerCode: '$reportOfficerCode',
          officerName: '$reportOfficerName',
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

function prefixMatchFields(match, prefix = 'data.') {
  return Object.fromEntries(Object.entries(match).map(([field, value]) => {
    if (['$and', '$or', '$nor'].includes(field)) {
      return [field, value.map((condition) => prefixMatchFields(condition, prefix))];
    }
    return [field.startsWith('$') ? field : `${prefix}${field}`, value];
  }));
}

export function legacyInvoicePipeline(match, options = {}, excludedInvoiceIds = []) {
  const excluded = excludedInvoiceIds.length
    ? {
        $nor: [
          { 'data.id': { $in: excludedInvoiceIds } },
          { 'data.invoiceNo': { $in: excludedInvoiceIds } }
        ]
      }
    : {};
  return [
    {
      $match: {
        type: 'invoices',
        ...prefixMatchFields(match),
        ...excluded
      }
    },
    { $replaceRoot: { newRoot: '$data' } },
    ...invoicePipeline(match, options)
  ];
}

export function getActivityRoster(rows) {
  return rows.map((row) => {
    const owner = row._id || {};
    return {
      id: String(owner.officerId || ''),
      officerId: String(owner.officerId || ''),
      code: normalizeOfficerCode(owner.officerCode),
      officerCode: String(owner.officerCode || ''),
      name: String(owner.officerName || ''),
      officerName: String(owner.officerName || '')
    };
  });
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
  const numericExpression = (input) => ({
    $convert: {
      input,
      to: 'double',
      onError: 0,
      onNull: 0
    }
  });
  const namedFieldAmount = (field) => ({
    $add: [
      numericExpression(`$${field}`),
      numericExpression(`$paymentAndExpense.${field}`)
    ]
  });
  const blankCategoryFields = PAYMENT_TYPE_FIELDS
    .filter((field) => field !== 'type')
    .map((field) => ({ $eq: [normalizeTypeField(field), ''] }));
  const namedExpenseBranches = [
    ['office_payment', 'officePayment'],
    ['office_payment', 'officePay'],
    ['salary', 'salary'],
    ['lc_commission', 'lc'],
    ['lc_commission', 'l/c']
  ].map(([type, field]) => ({
    case: {
      $gt: [namedFieldAmount(field), 0]
    },
    then: type
  }));
  FARE_AMOUNT_FIELDS.forEach((field) => {
    namedExpenseBranches.push({
      case: {
        $gt: [namedFieldAmount(field), 0]
      },
      then: 'vehicle_rent'
    });
  });
  const resolvedPaymentType = {
    $switch: {
      branches: [...paymentTypeBranches, ...namedExpenseBranches],
      default: {
        $cond: [
          { $and: blankCategoryFields },
          'dealer_collection',
          ''
        ]
      }
    }
  };
  const choosePositiveAmount = (first, second) => ({
    $cond: [
      { $gt: [numericExpression(first), 0] },
      numericExpression(first),
      numericExpression(second)
    ]
  });
  const amountFieldExpression = (field) => {
    if (field === 'officePayment') {
      return choosePositiveAmount(
        '$officePayment',
        choosePositiveAmount(
          '$officePay',
          choosePositiveAmount('$paymentAndExpense.officePayment', '$paymentAndExpense.officePay')
        )
      );
    }
    if (field === 'fare') {
      return FARE_AMOUNT_FIELDS.reduceRight(
        (value, alias) => choosePositiveAmount(`$${alias}`, value),
        FARE_AMOUNT_FIELDS.reduceRight(
          (value, alias) => choosePositiveAmount(`$paymentAndExpense.${alias}`, value),
          choosePositiveAmount('$fare', '$paymentAndExpense.fare')
        )
      );
    }
    return choosePositiveAmount(`$${field}`, `$paymentAndExpense.${field}`);
  };
  const amountExpression = (field) => ({
    $cond: [
      { $gt: [numericExpression('$amount'), 0] },
      numericExpression('$amount'),
      choosePositiveAmount('$totalAmount', amountFieldExpression(field))
    ]
  });
  const standardAmount = amountExpression('totalAmount');
  const reportAmount = {
    $switch: {
      branches: [
        { case: { $eq: ['$resolvedPaymentType', 'office_payment'] }, then: amountExpression('officePayment') },
        { case: { $eq: ['$resolvedPaymentType', 'salary'] }, then: amountExpression('salary') },
        { case: { $eq: ['$resolvedPaymentType', 'vehicle_rent'] }, then: amountExpression('fare') },
        { case: { $eq: ['$resolvedPaymentType', 'lc_commission'] }, then: amountExpression('lc') }
      ],
      default: standardAmount
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
    {
      $set: {
        resolvedPaymentType,
        reportOfficerId: reportOwnerField(
          'officerId',
          ['assignedOfficerId', 'officerId', 'salesOfficerId', 'officerUserId', 'employeeId', 'soId', 'asmId', 'rsmId']
        ),
        reportOfficerCode: reportOwnerField(
          'officerCode',
          ['assignedOfficerCode', 'officerCode', 'soCode', 'asmCode', 'rsmCode']
        ),
        reportOfficerName: reportOwnerField('officerName', ['assignedOfficerName', 'officerName', 'name'])
      }
    },
    { $set: { reportAmount } },
    {
      $group: {
        _id: {
          officerId: '$reportOfficerId',
          officerCode: '$reportOfficerCode',
          officerName: '$reportOfficerName',
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
              '$reportAmount',
              0
            ]
          }
        },
        officePayment: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'office_payment'] },
              '$reportAmount',
              0
            ]
          }
        },
        salary: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'salary'] },
              '$reportAmount',
              0
            ]
          }
        },
        fare: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'vehicle_rent'] },
              '$reportAmount',
              0
            ]
          }
        },
        lc: {
          $sum: {
            $cond: [
              { $eq: ['$resolvedPaymentType', 'lc_commission'] },
              '$reportAmount',
              0
            ]
          }
        }
      }
    }
  ];
}

function officerMatches(row, officer) {
  return officerRecordsMatch(row, officer);
}

function matchesHierarchyUser(officer, entry) {
  return officerRecordsMatch(officer, {
    ...entry,
    hierarchyUserId: entry._id || entry.id
  });
}

export function addPaymentRows(groups, rows, { period, periodValue, periodRange, beforePeriod, scope }) {
  rows.forEach((payment) => {
    const date = String(payment.date || '');
    const explicitSession = normalizeSessionText(payment.session);
    if (period === 'all' && beforePeriod) return;
    if (period === 'session') {
      if (explicitSession) {
        if (beforePeriod) {
          const paymentSessionRange = parseSessionDateRange(explicitSession);
          if (!paymentSessionRange || paymentSessionRange.end > periodRange.start) return;
        } else if (!sessionsMatch(explicitSession, periodValue)) {
          return;
        }
      } else if (date && (beforePeriod
        ? date >= periodRange.start
        : date < periodRange.start || date >= periodRange.end)) {
        return;
      } else if (!date) {
        return;
      }
    } else if (period !== 'all') {
      if (!date) return;
      if (beforePeriod ? date >= periodRange.start : date < periodRange.start || date >= periodRange.end) return;
    }
    if (!matchesOfficerScope(payment, scope)) return;
    if (payment.sourceInvoiceId || /(?:invoice|চালান)\s*#/i.test(String(payment.reference || ''))) return;
    const owner = {
      officerId: payment.officerId
        || payment.userId
        || payment.officerUserId
        || payment.employeeId
        || payment.createdBy
        || '',
      officerCode: payment.officerCode || '',
      officerName: payment.officerName || payment.name || ''
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
    const namedAmount = (field) => Number(
      payment[field] ?? payment.paymentAndExpense?.[field]
    ) || 0;
    const type = resolvePaymentRecordType(payment)
      || (namedAmount('officePayment') || namedAmount('officePay') ? 'office_payment' : '')
      || (namedAmount('salary') ? 'salary' : '')
      || (getPaymentAmount(payment) ? 'vehicle_rent' : '')
      || (namedAmount('lc') || namedAmount('l/c') ? 'lc_commission' : '')
      || (!getPaymentRecordTypeValue(payment) ? 'dealer_collection' : '');
    const typeField = EXPENSE_FIELDS[type];
    const typeAmount = type === 'office_payment'
      ? namedAmount('officePayment') || namedAmount('officePay')
      : namedAmount(typeField || '');
    const amount = Number(payment.amount)
      || Number(payment.totalAmount)
      || (type === 'vehicle_rent' ? getPaymentAmount(payment) : typeAmount);
    if (RECEIPT_TYPES.has(type)) group.collection += amount;
    if (typeField) group[typeField] += amount;
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

  const requestedPeriod = String(req.query?.period || 'all');
  const requestedValue = String(req.query?.value || (requestedPeriod === 'all' ? 'ALL' : ''));
  const { period, value } = normalizeReportPeriod(requestedPeriod, requestedValue);
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
    const dealerSource = await settleReportSources([[
      'dealerRecords',
      Dealer.find(scope.global ? {} : buildDealerOwnerFilter(scope))
        .select('id code shopName phone mobile officerId assignedOfficerId officerCode assignedOfficerCode officerName assignedOfficerName salesOfficerId officerUserId soId soCode asmId asmCode rsmId rsmCode openingDue lastSessionDue previousDue previousDueDate previousDueSession previousDueOfficerId previousDueHistory')
        .lean()
    ]]);
    const scopedDealers = dealerSource.values.dealerRecords;
    const reportDealers = scopedDealers.map((dealer) => ({
      ...dealer,
      officerId: dealer.assignedOfficerId
        || dealer.officerId
        || dealer.salesOfficerId
        || dealer.officerUserId
        || dealer.soId
        || dealer.asmId
        || dealer.rsmId
        || '',
      officerCode: dealer.assignedOfficerCode
        || dealer.officerCode
        || dealer.soCode
        || dealer.asmCode
        || dealer.rsmCode
        || ''
    }));
    const scopedDealerIds = scopedDealers.map((dealer) => String(dealer.id || '')).filter(Boolean);
    const ownerMatch = buildOfficerOwnerFilter(scope);
    const reportOwnerMatch = buildReportOwnerMatch(scope, scopedDealerIds);
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
    const userRosterQuery = scope.global
      ? User.find({
          role: { $in: HIERARCHY_ROLE_VALUES },
          status: { $in: ['active', 'একটিভ', 'এডমিন', 'সুপার এডমিন'] }
        }).select('_id id userId name role officerId officerCode phone territory asmId rsmId').lean()
      : Promise.resolve(scope.users);
    const periodMatch = period === 'all'
      ? reportOwnerMatch
      : period === 'session'
        ? { $and: [sessionPrimaryCondition(value), reportOwnerMatch] }
        : { ...dateRangeCondition('date', periodRange), ...reportOwnerMatch };
    const periodPaymentMatch = period === 'session'
      ? {
          $and: [
            sessionPrimaryCondition(value),
            reportOwnerMatch
          ]
        }
      : periodMatch;
    const priorMatch = period === 'all' ? { _id: null } : {
      $and: [
        period === 'session'
          ? priorSessionCondition(value)
          : { date: { $lt: periodRange.start } },
        reportOwnerMatch
      ]
    };
    const { values: reportSources, warnings: sourceWarnings } = await settleReportSources([
      ['officerRecords', BusinessRecord.find({ type: 'officers' }).select('data').lean()],
      ['salesOfficerRecords', SalesOfficer.find(ownerMatch).sort({ slNo: 1 }).lean()],
      ['periodInvoices', Invoice.aggregate(invoicePipeline(periodMatch, { openingBalance: period === 'all' }))],
      ['priorInvoices', Invoice.aggregate(invoicePipeline(priorMatch))],
      ['invoiceIdentities', Invoice.find({ $or: [periodMatch, priorMatch] }).select('id invoiceNo').lean()],
      ['periodPayments', Payment.aggregate(paymentPipeline(periodPaymentMatch))],
      ['priorPayments', Payment.aggregate(paymentPipeline(priorMatch))],
      ['typedPaymentIds', Payment.find(reportOwnerMatch).select('id sourceInvoiceId').lean()],
      ['legacyPaymentRecords', BusinessRecord.find({
        type: { $in: LEGACY_PAYMENT_RECORD_TYPES }
      }).select('data').lean()],
      ['userRecords', userRosterQuery]
    ]);
    const officerRecords = reportSources.officerRecords;
    const salesOfficerRecords = reportSources.salesOfficerRecords;
    const periodInvoices = reportSources.periodInvoices;
    const priorInvoices = reportSources.priorInvoices;
    const invoiceIdentities = reportSources.invoiceIdentities;
    const periodPayments = reportSources.periodPayments;
    const priorPayments = reportSources.priorPayments;
    const typedPayments = reportSources.typedPaymentIds;
    const legacyRecords = reportSources.legacyPaymentRecords;
    const userRecords = reportSources.userRecords;
    const excludedInvoiceIds = [...new Set(invoiceIdentities.flatMap((invoice) => (
      [invoice.id, invoice.invoiceNo].filter(Boolean).map(String)
    )))];
    const legacyInvoiceSources = sourceWarnings.includes('invoiceIdentities')
      ? { values: { legacyPeriodInvoices: [], legacyPriorInvoices: [] }, warnings: [] }
      : await settleReportSources([
          ['legacyPeriodInvoices', BusinessRecord.aggregate(legacyInvoicePipeline(
            periodMatch,
            { openingBalance: period === 'all' },
            excludedInvoiceIds
          ))],
          ['legacyPriorInvoices', period === 'all'
            ? Promise.resolve([])
            : BusinessRecord.aggregate(legacyInvoicePipeline(priorMatch, {}, excludedInvoiceIds))]
        ]);
    const reportWarnings = [
      ...dealerSource.warnings,
      ...sourceWarnings,
      ...legacyInvoiceSources.warnings
    ];
    const legacyPeriodInvoices = legacyInvoiceSources.values.legacyPeriodInvoices;
    const legacyPriorInvoices = legacyInvoiceSources.values.legacyPriorInvoices;
    periodInvoices.push(...legacyPeriodInvoices);
    priorInvoices.push(...legacyPriorInvoices);

    const typedPaymentIds = new Set(typedPayments.map((payment) => String(payment.id)));
    const typedInvoiceSources = new Set(typedPayments.map((payment) => String(payment.sourceInvoiceId || '')).filter(Boolean));
    const rawLegacyPayments = (sourceWarnings.includes('typedPaymentIds') ? [] : legacyRecords)
      .map((record) => record.data).filter((payment) => (
      payment
      && !(payment.id && typedPaymentIds.has(String(payment.id)))
      && !(payment.sourceInvoiceId && typedInvoiceSources.has(String(payment.sourceInvoiceId)))
    ));
    const legacyDealerIds = [...new Set(rawLegacyPayments
      .map((payment) => String(payment.dealerId || ''))
      .filter(Boolean))];
    const legacyDealerIdSet = new Set(legacyDealerIds);
    const legacyDealerRecords = reportDealers.filter((dealer) => (
      legacyDealerIdSet.has(String(dealer.id || ''))
    ));
    const legacyDealerCodes = new Map(legacyDealerRecords.map((dealer) => [
      String(dealer.id),
      {
        officerId: String(
          dealer.assignedOfficerId
          || dealer.officerId
          || dealer.salesOfficerId
          || dealer.officerUserId
          || dealer.soId
          || dealer.asmId
          || dealer.rsmId
          || ''
        ),
        officerCode: String(
          dealer.assignedOfficerCode
          || dealer.officerCode
          || dealer.soCode
          || dealer.asmCode
          || dealer.rsmCode
          || ''
        ),
        officerName: String(dealer.assignedOfficerName || dealer.officerName || '')
      }
    ]));
    const legacyPayments = rawLegacyPayments.map((payment) => {
      if (
        payment.officerId
        || payment.officerCode
        || payment.officerName
        || payment.userId
        || payment.officerUserId
        || payment.employeeId
      ) return payment;
      const owner = legacyDealerCodes.get(String(payment.dealerId || ''));
      return owner
        ? {
            ...payment,
            officerId: owner.officerId,
            officerCode: owner.officerCode,
            officerName: owner.officerName
          }
        : payment;
    });
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
    const activityRoster = getActivityRoster([
      ...periodInvoices,
      ...priorInvoices,
      ...allPeriodPayments,
      ...allPriorPayments
    ]);
    const roster = mergeOfficerRecords([
      ...officerRecords.map((record) => record.data),
      ...salesOfficerRecords,
      ...activityRoster,
      ...userRecords.map((entry) => ({
        id: String(entry.officerId || entry.id || entry.userId || entry._id || ''),
        userId: String(entry.userId || entry._id || entry.id || ''),
        hierarchyUserId: String(entry._id || entry.id || entry.userId || ''),
        officerId: String(entry.officerId || ''),
        code: normalizeOfficerCode(entry.officerCode),
        officerCode: entry.officerCode || '',
        name: entry.name || '',
        phone: entry.phone || '',
        territory: entry.territory || '',
        role: entry.role,
        asmId: String(entry.asmId || ''),
        rsmId: String(entry.rsmId || '')
      }))
    ]);

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

      const dueSession = period === 'session'
        ? value
        : period === 'session-range' || period === 'date-range'
          ? getInvoiceSessionForDate(periodRange.start)
          : period === 'year' ? `জানুয়ারি - জুন ${periodRange.start.slice(0, 4)}` : 'ALL';
      const dueByDealer = getOfficerPreviousDueByDealer(reportDealers, {
        officerIds: [
          officer.id,
          officer.officerId,
          officer.userId,
          officer.hierarchyUserId
        ].filter(Boolean),
        officerCode: officer.code || officer.officerCode,
        designation: officer.designation
      }, {
        session: dueSession,
        month: period === 'month' ? periodRange.start.slice(0, 7) : 'ALL',
        openingBalance: period === 'all'
      });
      dueByDealer.forEach((due, dealerId) => {
        const dealer = reportDealers.find((entry) => String(entry.id) === dealerId);
        const party = partyMap.get(dealerId) || {
          dealerId,
          dealerName: dealer?.shopName || dealer?.code || 'নাম নেই',
          mobileNo: dealer?.phone || dealer?.mobile || '',
          previousDue: 0,
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
        party.previousDue = roundAmount(due.amount);
        partyMap.set(dealerId, party);
      });

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
        ? derivedPreviousDue || roundAmount(officer.lastSessionDue)
        : derivedPreviousDue;
      const previousPlusNetSales = previousDue + totalNetSales;
      const totalExpenses = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
      const actualCollections = parties.reduce(
        (sum, party) => sum + party.invoicePaid,
        0
      );
      const dealerCollection = periodOfficerPayments.reduce(
        (sum, payment) => sum + roundAmount(payment.collection),
        0
      );
      const totalReceivedAmount = roundAmount(totalExpenses + actualCollections);
      const session = period === 'session'
        ? value
        : period === 'month'
          ? getInvoiceSessionForDate(periodRange.start)
          : period === 'year' ? `জানুয়ারি - জুন ${value}` : '';
      const targetSessions = new Set([
        ...INVOICE_SESSIONS,
        ...Object.keys(officer.salesTargets || {})
      ].map(canonicalSession).filter(Boolean));
      const allTargets = [...targetSessions].reduce(
        (sum, entry) => sum + getOfficerSalesTarget(officer, entry),
        0
      );
      const sessionTarget = period === 'all'
        ? allTargets
        : period === 'session-range' || period === 'date-range'
        ? INVOICE_SESSIONS.filter((entry) => {
            const range = parseSessionDateRange(entry);
            return Boolean(range && range.start >= periodRange.start && range.end <= periodRange.end);
          }).reduce((sum, entry) => sum + getOfficerSalesTarget(officer, entry), 0)
        : session ? getOfficerSalesTarget(officer, session) : 0;
      const targetYear = periodRange.start.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
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
        dealerCollection: roundAmount(dealerCollection),
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
    return res.status(200).json({
      period,
      value,
      asms,
      officers: resultRows,
      warnings: [...new Set(reportWarnings)]
    });
  } catch (error) {
    console.error('Dashboard report aggregation failed:', error);
    return res.status(500).json({ error: 'লাইভ ড্যাশবোর্ড রিপোর্ট তৈরি করা যায়নি।' });
  }
}
