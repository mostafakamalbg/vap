import {
  normalizeDealerOfficerCode,
  normalizeOfficerCode
} from './codes.js';
import { getInvoiceSalesAmount } from './invoiceTotals.js';
import { normalizePaymentType } from './paymentMethods.js';
import { OFFICER_TARGET_SESSIONS, getOfficerSalesTarget } from './officerSalesTargets.js';
import { getInvoiceSessionForDate } from './sessions.js';

const SALES_TARGET_JULY_DEC_2026 = OFFICER_TARGET_SESSIONS[0];
const SALES_TARGET_JAN_JUNE_2027 = OFFICER_TARGET_SESSIONS[1];
const RETURN_TYPES = new Set(['dealer_return']);
const NON_SALES_TYPES = new Set(['dealer_return', 'factory_damage', 'depot_factory_return']);

function amount(value) {
  return Math.round(Number(value) || 0);
}

function matchesOfficer(record, officer) {
  const recordOfficerId = String(record?.officerId || '');
  const officerIds = [officer?.id, officer?.officerId].filter(Boolean).map(String);
  const recordCode = normalizeOfficerCode(record?.officerCode || recordOfficerId, officer?.designation);
  const officerCode = normalizeOfficerCode(officer?.code, officer?.designation);

  return officerIds.includes(recordOfficerId)
    || record?.officerName === officer?.name
    || Boolean(recordCode && officerCode && recordCode === officerCode);
}

function matchesDealer(record, dealer) {
  return String(record?.dealerId || '') === String(dealer?.id || '')
    || String(record?.dealerCode || '') === String(dealer?.code || '')
    || record?.dealerName === dealer?.shopName;
}

function getDealerDueAt(dealer, cutoffDate, invoices, payments, damageLogs) {
  const historicalInvoices = invoices.filter((invoice) => (
    matchesDealer(invoice, dealer)
    && invoice.date < cutoffDate
    && !['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  ));
  const sales = historicalInvoices
    .filter((invoice) => !RETURN_TYPES.has(invoice.invoiceType))
    .reduce((sum, invoice) => sum + getInvoiceSalesAmount(invoice), 0);
  const returns = historicalInvoices
    .filter((invoice) => RETURN_TYPES.has(invoice.invoiceType))
    .reduce((sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)), 0);
  const collections = payments
    .filter((payment) => (
      matchesDealer(payment, dealer)
      && normalizePaymentType(payment.paymentType) === 'dealer_collection'
      && payment.date < cutoffDate
    ))
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const damageCredits = damageLogs
    .filter((damage) => (
      matchesDealer(damage, dealer)
      && damage.actionType === 'ledger_credit'
      && !damage.invoiceRef
      && damage.date < cutoffDate
    ))
    .reduce((sum, damage) => sum + (Number(damage.totalDamageValue) || 0), 0);

  return amount((Number(dealer.openingDue) || 0) + sales - returns - collections - damageCredits);
}

function getSessionRange(session) {
  const year = String(session || '').match(/(\d{4})$/)?.[1];
  if (!year) return null;
  const isFirstHalf = /জানুয়ারি|জানুয়ারি/.test(session);
  return {
    startDate: `${year}-${isFirstHalf ? '01-01' : '07-01'}`,
    endDate: `${year}-${isFirstHalf ? '06-30' : '12-31'}`
  };
}

export function buildOfficerSessionSummary({
  officers = [],
  dealers = [],
  invoices = [],
  payments = [],
  damageLogs = [],
  session,
  asOfMonth
} = {}) {
  const sessionRange = getSessionRange(session);
  if (!sessionRange) return { rows: [], totals: createEmptyTotals() };

  const { startDate, endDate } = sessionRange;
  const monthStart = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(asOfMonth || ''))
    ? `${asOfMonth}-01`
    : endDate;
  const rows = officers.map((officer, index) => {
    const assignedDealers = dealers.filter((dealer) => (
      normalizeDealerOfficerCode(dealer, officers)
        === normalizeOfficerCode(officer.code, officer.designation)
    ));
    const lastSessionDue = assignedDealers.reduce(
      (sum, dealer) => sum + getDealerDueAt(dealer, startDate, invoices, payments, damageLogs),
      0
    );
    const sessionInvoices = invoices.filter((invoice) => (
      matchesOfficer(invoice, officer)
      && invoice.date >= startDate
      && invoice.date <= endDate
      && (invoice.session || getInvoiceSessionForDate(invoice.date)) === session
    ));
    const salesInvoices = sessionInvoices.filter((invoice) => !NON_SALES_TYPES.has(invoice.invoiceType));
    const returnInvoices = sessionInvoices.filter((invoice) => RETURN_TYPES.has(invoice.invoiceType));
    const officerPayments = payments.filter((payment) => (
      matchesOfficer(payment, officer)
      && payment.date >= startDate
      && payment.date <= endDate
      && (payment.session || getInvoiceSessionForDate(payment.date)) === session
    ));
    const paymentTotal = (type) => amount(officerPayments
      .filter((payment) => normalizePaymentType(payment.paymentType) === type)
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0));
    const salesAmount = amount(salesInvoices.reduce(
      (sum, invoice) => sum + getInvoiceSalesAmount(invoice),
      0
    ));
    const returnAmount = amount(returnInvoices.reduce(
      (sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)),
      0
    ));
    const officePay = paymentTotal('company_transfer');
    const fare = paymentTotal('vehicle_rent');
    const salary = paymentTotal('salary');
    const lc = paymentTotal('lc_commission');
    const totalReceivedAmount = officePay + fare + salary + lc;
    const previousPlusNetSales = lastSessionDue + salesAmount - returnAmount;
    const salesTargetJulyDec2026 = getOfficerSalesTarget(officer, SALES_TARGET_JULY_DEC_2026);
    const salesTargetJanJune2027 = getOfficerSalesTarget(officer, SALES_TARGET_JAN_JUNE_2027);
    const sessionTarget = getOfficerSalesTarget(officer, session);
    const totalAmountDues = previousPlusNetSales - totalReceivedAmount;
    const expensePercentage = previousPlusNetSales
      ? (totalReceivedAmount / previousPlusNetSales) * 100
      : 0;
    const salesPercentage = sessionTarget
      ? (previousPlusNetSales / sessionTarget) * 100
      : 0;
    const salesInvoiceCount = salesInvoices.length;
    const returnInvoiceCount = returnInvoices.length;
    const previousInvoices = sessionInvoices.filter((invoice) => (
      invoice.date >= startDate && invoice.date < monthStart
    )).length;

    return {
      id: officer.id,
      slNo: index + 1,
      officer,
      officerName: officer.name || '',
      mobileNo: officer.phone || officer.mobileNo || '',
      salesTargetJulyDec2026,
      salesTargetJanJune2027,
      target: sessionTarget,
      lastSessionDue,
      salesAmount,
      returnAmount,
      previousPlusNetSales,
      officePay,
      fare,
      salary,
      lc,
      paymentAndExpense: { officePay, fare, salary, lc },
      totalReceivedAmount,
      totalAmountDues,
      totalNetSales: previousPlusNetSales,
      totalSalesDues: sessionTarget - previousPlusNetSales,
      expensePercentage,
      salesPercentage,
      paymentPercentage: previousPlusNetSales
        ? (totalReceivedAmount / previousPlusNetSales) * 100
        : 0,
      salesInvoiceCount,
      returnInvoiceCount,
      totalInvoiceCount: salesInvoiceCount + returnInvoiceCount,
      previousInvoices,
      runningInvoices: Math.max(0, salesInvoiceCount + returnInvoiceCount - previousInvoices)
    };
  });

  const totals = rows.reduce((result, row) => {
    [
      'salesTargetJulyDec2026',
      'salesTargetJanJune2027',
      'target',
      'lastSessionDue',
      'salesAmount',
      'returnAmount',
      'previousPlusNetSales',
      'officePay',
      'fare',
      'salary',
      'lc',
      'totalReceivedAmount',
      'totalAmountDues',
      'totalNetSales',
      'totalSalesDues',
      'salesInvoiceCount',
      'returnInvoiceCount',
      'totalInvoiceCount',
      'previousInvoices',
      'runningInvoices'
    ].forEach((key) => { result[key] += row[key]; });
    return result;
  }, createEmptyTotals());
  totals.expensePercentage = totals.totalNetSales
    ? ((totals.officePay + totals.fare + totals.salary + totals.lc) / totals.totalNetSales) * 100
    : 0;
  totals.salesPercentage = totals.target
    ? (totals.totalNetSales / totals.target) * 100
    : 0;
  totals.paymentPercentage = totals.totalNetSales
    ? (totals.totalReceivedAmount / totals.totalNetSales) * 100
    : 0;

  return { rows, totals };
}

function createEmptyTotals() {
  return {
    salesTargetJulyDec2026: 0,
    salesTargetJanJune2027: 0,
    target: 0,
    lastSessionDue: 0,
    salesAmount: 0,
    returnAmount: 0,
    previousPlusNetSales: 0,
    officePay: 0,
    fare: 0,
    salary: 0,
    lc: 0,
    totalReceivedAmount: 0,
    totalAmountDues: 0,
    totalNetSales: 0,
    totalSalesDues: 0,
    expensePercentage: 0,
    salesPercentage: 0,
    paymentPercentage: 0,
    salesInvoiceCount: 0,
    returnInvoiceCount: 0,
    totalInvoiceCount: 0,
    previousInvoices: 0,
    runningInvoices: 0
  };
}
