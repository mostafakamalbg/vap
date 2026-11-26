import { getDealerCollectionAmount } from './dealerLedger.js';
import { formatDealerCode, normalizeOfficerCode } from './codes.js';
import { parseSessionDateRange, sessionsMatch } from './reportDateFilters.js';
import { getInvoiceSalesAmount, roundCurrency } from './invoiceTotals.js';
import { isDealerCollection } from './paymentMethods.js';
import { getInvoiceSessionForDate, normalizeSessionText } from './sessions.js';

const MONEY_FIELDS = [
  'lastMonthDues',
  'sales',
  'return',
  'salary',
  'collection',
  'fare',
  'l_c'
];

export function roundAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

export function validateMonthlySalesReport(report) {
  if (!String(report?.personName || '').trim()) return 'অফিসারের নাম দিন।';
  if (!String(report?.monthOfReport || '').trim()) return 'রিপোর্টের মাস দিন।';
  if (!String(report?.session || '').trim()) return 'সেশন নির্বাচন করুন।';
  const date = String(report?.reportingDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(new Date(`${date}T00:00:00.000Z`).valueOf())
    || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    return 'সঠিক রিপোর্টিং তারিখ দিন।';
  }
  if (!Array.isArray(report.parties) || report.parties.length < 1 || report.parties.length > 500) {
    return 'কমপক্ষে ১টি এবং সর্বোচ্চ ৫০০টি পার্টির তথ্য দিন।';
  }
  for (const [index, party] of report.parties.entries()) {
    if (!String(party?.nameOfTheParty || '').trim()) {
      return `সারি ${index + 1}-এ পার্টির নাম দিন।`;
    }
    for (const field of MONEY_FIELDS) {
      const value = field === 'lastMonthDues'
        ? party.lastMonthDues
        : field === 'sales'
          ? party.presentMonth?.sales
          : field === 'return'
            ? party.presentMonth?.return
            : party.lastAndPresent?.[field];
      if (value != null && !Number.isFinite(Number(value))) {
        return `সারি ${index + 1}-এর টাকার পরিমাণ সঠিক নয়।`;
      }
    }
  }
  return '';
}

export function normalizeMonthlySalesReport(report) {
  const parties = report.parties.map((party, index) => {
    const lastMonthDues = roundAmount(party.lastMonthDues);
    const sales = roundAmount(party.presentMonth?.sales);
    const returned = roundAmount(party.presentMonth?.return);
    const netSales = sales - returned;
    const salary = roundAmount(party.lastAndPresent?.salary);
    const collection = roundAmount(party.lastAndPresent?.collection);
    const fare = roundAmount(party.lastAndPresent?.fare);
    const lc = roundAmount(party.lastAndPresent?.l_c);
    const totalCollection = salary + collection + fare + lc;
    const totalNetSales = lastMonthDues + netSales;

    return {
      slNo: roundAmount(party.slNo) || index + 1,
      nameOfTheParty: String(party.nameOfTheParty).trim(),
      lastMonthDues,
      presentMonth: { sales, return: returned, netSales },
      lastAndPresent: {
        netSales: totalNetSales,
        salary,
        collection,
        fare,
        l_c: lc
      },
      presentMonthTotalCollection: totalCollection,
      presentMonthNetDues: totalNetSales - totalCollection
    };
  });

  return {
    personName: String(report.personName).trim(),
    designation: String(report.designation || '').trim(),
    areaName: String(report.areaName || '').trim(),
    mobileNo: String(report.mobileNo || '').trim(),
    monthOfReport: String(report.monthOfReport).trim(),
    session: String(report.session).trim(),
    reportingDate: String(report.reportingDate),
    officerId: String(report.officerId || ''),
    officerCode: String(report.officerCode || ''),
    parties
  };
}

function getRecordMonth(record) {
  return String(record?.date || record?.reportingDate || '').slice(0, 7);
}

function getRecordSession(record) {
  const date = String(record?.date || record?.reportingDate || '');
  const session = normalizeSessionText(record?.session || getInvoiceSessionForDate(date));
  const range = parseSessionDateRange(session);
  return range ? getInvoiceSessionForDate(range.start) : session;
}

function matchesFilters(record, monthFilter, sessionFilter) {
  const month = getRecordMonth(record);
  if (monthFilter !== 'ALL'
    && month !== monthFilter
    && (!/^\d{4}-\d{2}$/.test(month) || reportMonthLabel(month) !== monthFilter)) return false;
  return sessionFilter === 'ALL' || sessionsMatch(getRecordSession(record), sessionFilter);
}

function getDealerAliases(record) {
  const aliases = [record?.dealerId, record?.dealerName]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  [record?.dealerCode].filter(Boolean).forEach((value) => {
    aliases.push(String(value).trim().toLowerCase(), formatDealerCode(value).toLowerCase());
  });
  return [...new Set(aliases.filter(Boolean))];
}

function getOfficerIdentity(record, dealers, officers) {
  const recordId = String(record?.officerId || '').trim();
  const recordCode = normalizeOfficerCode(record?.officerCode || record?.code, record?.designation);
  const recordName = String(record?.officerName || record?.name || '').trim();
  const officer = officers.find((entry) => (
    (recordId && [entry.id, entry.officerId].some((id) => String(id || '').trim() === recordId))
  )) || officers.find((entry) => (
    recordCode && normalizeOfficerCode(entry.code || entry.officerCode, entry.designation) === recordCode
  )) || officers.find((entry) => (
    !recordId && !recordCode
    && recordName
    && String(entry.name || entry.officerName || '').trim() === recordName
  ));
  if (officer) return officer;
  if (recordId || recordCode || recordName) {
    return {
      id: recordId,
      officerId: recordId,
      code: recordCode,
      officerCode: recordCode,
      name: recordName,
      officerName: recordName,
      designation: String(record?.officerDesignation || record?.designation || '')
    };
  }

  const aliases = new Set(getDealerAliases(record));
  const dealer = dealers.find((entry) => (
    [entry.id, entry.code, formatDealerCode(entry.code), entry.shopName]
      .filter(Boolean)
      .some((value) => aliases.has(String(value).trim().toLowerCase()))
  ));
  if (!dealer) return null;
  return officers.find((entry) => (
    (dealer.assignedOfficerId || dealer.officerId)
      && [entry.id, entry.officerId].some((id) => (
        String(id || '').trim() === String(dealer.assignedOfficerId || dealer.officerId)
      ))
  )) || officers.find((entry) => (
    normalizeOfficerCode(dealer.officerCode || dealer.assignedOfficerCode)
      && normalizeOfficerCode(entry.code || entry.officerCode, entry.designation)
        === normalizeOfficerCode(dealer.officerCode || dealer.assignedOfficerCode)
  )) || {
    id: String(dealer.assignedOfficerId || dealer.officerId || ''),
    officerId: String(dealer.assignedOfficerId || dealer.officerId || ''),
    code: normalizeOfficerCode(dealer.officerCode || dealer.assignedOfficerCode),
    officerCode: normalizeOfficerCode(dealer.officerCode || dealer.assignedOfficerCode),
    name: '',
    officerName: ''
  };
}

function officerKey(officer) {
  const id = String(officer?.id || officer?.officerId || '').trim();
  const code = normalizeOfficerCode(officer?.code || officer?.officerCode, officer?.designation);
  const name = String(officer?.name || officer?.officerName || '').trim();
  return id || code || name.toLowerCase();
}

function reportMonthLabel(month) {
  const label = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00.000Z`));
  return `${label}/${month.slice(2, 4)}`;
}

function getInvoiceReference(payment) {
  return String(payment?.sourceInvoiceId || '')
    || String(payment?.reference || '').match(/(?:invoice|চালান)\s*#?\s*([^\s,]+)/i)?.[1]
    || '';
}

export function buildMonthlySalesReports({
  invoices = [],
  payments = [],
  dealers = [],
  officers = [],
  monthFilter = 'ALL',
  sessionFilter = 'ALL'
} = {}) {
  const matchingInvoices = invoices.filter((invoice) => (
    matchesFilters(invoice, monthFilter, sessionFilter)
    && !['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  ));
  const matchingPayments = payments.filter((payment) => (
    matchesFilters(payment, monthFilter, sessionFilter)
    && isDealerCollection(payment)
  ));
  const invoicesById = new Map(matchingInvoices.map((invoice) => [
    String(invoice.id || invoice.invoiceNo || ''),
    invoice
  ]).filter(([id]) => id));
  const dealerAliases = new Map();
  dealers.forEach((dealer) => {
    const key = String(dealer.id || dealer.code || dealer.shopName || '');
    const aliases = [
      dealer.id,
      dealer.shopName,
      dealer.code,
      formatDealerCode(dealer.code)
    ].filter(Boolean);
    aliases.forEach((alias) => dealerAliases.set(String(alias).trim().toLowerCase(), key));
  });
  const groups = new Map();

  const getGroup = (record) => {
    const officer = getOfficerIdentity(record, dealers, officers);
    const identity = officerKey(officer);
    const month = getRecordMonth(record);
    const session = getRecordSession(record);
    if (!identity || !month || !session) return null;
    const groupKey = `${identity}|${month}|${session}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        officer,
        month,
        session,
        reportingDate: `${month}-${new Date(Date.UTC(
          Number(month.slice(0, 4)),
          Number(month.slice(5, 7)),
          0
        )).getUTCDate()}`,
        parties: new Map()
      });
    }
    return groups.get(groupKey);
  };

  const getParty = (group, record) => {
    const directAliases = getDealerAliases(record);
    const linkedInvoice = getInvoiceReference(record)
      ? invoicesById.get(getInvoiceReference(record))
      : null;
    const aliases = directAliases.length ? directAliases : getDealerAliases(linkedInvoice);
    const key = aliases.map((alias) => dealerAliases.get(alias)).find(Boolean)
      || aliases[0]
      || '';
    if (!key) return null;
    const dealer = dealers.find((entry) => (
      [entry.id, entry.code, entry.shopName].filter(Boolean)
        .some((alias) => String(alias).trim().toLowerCase() === String(key).trim().toLowerCase())
    ));
    if (!group.parties.has(key)) {
      group.parties.set(key, {
        name: String(record.dealerName || linkedInvoice?.dealerName || dealer?.shopName || key),
        lastMonthDues: roundCurrency(dealer?.lastSessionDue ?? dealer?.openingDue ?? 0),
        invoices: [],
        payments: []
      });
    }
    return group.parties.get(key);
  };

  const seenInvoices = new Set();
  matchingInvoices.forEach((invoice) => {
    const group = getGroup(invoice);
    if (!group) return;
    const party = getParty(group, invoice);
    if (!party) return;
    const id = String(invoice.id || invoice.invoiceNo || '');
    const dedupeKey = `${officerKey(group.officer)}|${id}`;
    if (id && seenInvoices.has(dedupeKey)) return;
    if (id) seenInvoices.add(dedupeKey);
    party.invoices.push(invoice);
  });

  const seenPayments = new Set();
  matchingPayments.forEach((payment) => {
    const invoiceId = getInvoiceReference(payment);
    const linkedInvoice = invoiceId ? invoicesById.get(invoiceId) : null;
    const record = linkedInvoice
      ? {
        ...linkedInvoice,
        ...payment,
        officerId: payment.officerId || linkedInvoice.officerId,
        officerCode: payment.officerCode || linkedInvoice.officerCode,
        officerName: payment.officerName || linkedInvoice.officerName
      }
      : payment;
    const group = getGroup(record);
    if (!group) return;
    const party = getParty(group, payment);
    if (!party) return;
    const id = String(payment.id || '');
    const dedupeKey = `${officerKey(group.officer)}|${id}`;
    if (id && seenPayments.has(dedupeKey)) return;
    if (id) seenPayments.add(dedupeKey);
    party.payments.push(payment);
  });

  return [...groups.entries()].map(([key, group]) => {
    const partyRows = [...group.parties.values()].map((party, index) => {
      const sales = party.invoices.reduce((sum, invoice) => (
        sum + (invoice.invoiceType === 'dealer_return' ? 0 : roundCurrency(getInvoiceSalesAmount(invoice)))
      ), 0);
      const returned = party.invoices.reduce((sum, invoice) => (
        sum + (invoice.invoiceType === 'dealer_return'
          ? Math.abs(roundCurrency(getInvoiceSalesAmount(invoice)))
          : 0)
      ), 0);
      const collection = getDealerCollectionAmount(party.invoices, party.payments);
      return {
        slNo: index + 1,
        nameOfTheParty: party.name,
        lastMonthDues: party.lastMonthDues,
        presentMonth: { sales, return: returned },
        lastAndPresent: { collection }
      };
    });
    const normalized = normalizeMonthlySalesReport({
      personName: group.officer?.name
        || group.officer?.officerName
        || group.officer?.code
        || group.officer?.officerCode
        || group.officer?.id
        || group.officer?.officerId,
      designation: group.officer?.designation,
      areaName: group.officer?.territory || group.officer?.areaName,
      mobileNo: group.officer?.phone || group.officer?.mobileNo,
      monthOfReport: reportMonthLabel(group.month),
      session: group.session,
      reportingDate: group.reportingDate,
      officerId: group.officer?.id || group.officer?.officerId,
      officerCode: group.officer?.code || group.officer?.officerCode,
      parties: partyRows
    });
    return { ...normalized, autoKey: `AUTO-${key}` };
  });
}

export function getMonthlySalesReportKey(report) {
  const identity = normalizeOfficerCode(report?.officerCode)
    || String(report?.officerId || '').trim()
    || String(report?.personName || '').trim().toLowerCase();
  const month = String(report?.reportingDate || '').slice(0, 7);
  const sessionRange = parseSessionDateRange(report?.session);
  const session = sessionRange?.start || normalizeSessionText(report?.session).toLowerCase();
  return `${identity}|${month}|${session}`;
}
