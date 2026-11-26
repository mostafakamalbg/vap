import { getInvoiceSalesAmount, roundCurrency } from './invoiceTotals.js';
import { getInvoiceSessionForDate, normalizeSessionText } from './sessions.js';
import { parseSessionDateRange, sessionsMatch } from './reportDateFilters.js';
import { getPaymentRecordTypeValue, resolvePaymentRecordType } from './paymentMethods.js';

const SALES_EXCLUDED = new Set(['dealer_return', 'factory_damage', 'depot_factory_return']);
const RECEIPTS = new Set(['dealer_collection']);
const EXPENSE_FIELDS = {
  office_payment: 'officePayment',
  salary: 'salary',
  vehicle_rent: 'fare',
  lc_commission: 'lc'
};

function isInvoicePayment(payment) {
  return Boolean(payment?.sourceInvoiceId)
    || /(?:invoice|চালান)\s*#/i.test(String(payment?.reference || ''));
}

function inPeriod(record, { session = 'ALL', month = 'ALL', date = 'ALL' } = {}) {
  const sessionRange = session === 'ALL' ? null : parseSessionDateRange(session);
  const recordDate = String(record.date || '');
  const matchesSession = session === 'ALL'
    || (record.session
      ? sessionsMatch(record.session, session)
      : sessionRange
        ? recordDate >= sessionRange.start && recordDate < sessionRange.end
      : (record.session || getInvoiceSessionForDate(record.date)) === session);
  return matchesSession
    && (month === 'ALL' || String(record.date || '').startsWith(month))
    && (date === 'ALL' || String(record.date || '') === date);
}

export function filterOfficerRecordsByPeriod(records, filters) {
  return records.filter((record) => inPeriod(record, filters));
}

export function calculateOfficerFinancials({
  invoices = [],
  payments = [],
  salesTarget = 0,
  lastSessionDue = 0
} = {}) {
  const sales = invoices.filter((invoice) => !SALES_EXCLUDED.has(invoice.invoiceType));
  const returns = invoices.filter((invoice) => invoice.invoiceType === 'dealer_return');
  const salesAmount = roundCurrency(sales.reduce(
    (sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)), 0
  ));
  const returnAmount = roundCurrency(returns.reduce(
    (sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)), 0
  ));
  const totalNetSales = salesAmount - returnAmount;
  const invoiceReceipts = roundCurrency(sales.reduce(
    (sum, invoice) => sum + (Number(invoice.paidAmount) || 0), 0
  ));
  const standalone = payments.filter((payment) => !isInvoicePayment(payment));
  const paymentAndExpense = { officePayment: 0, fare: 0, salary: 0, lc: 0 };
  standalone.forEach((payment) => {
    const field = EXPENSE_FIELDS[resolvePaymentRecordType(payment)];
    if (field) paymentAndExpense[field] += roundCurrency(payment.amount);
  });
  Object.keys(paymentAndExpense).forEach((key) => {
    paymentAndExpense[key] = roundCurrency(paymentAndExpense[key]);
  });
  const totalReceivedAmount = roundCurrency(invoiceReceipts + standalone
    .filter((payment) => {
      const type = resolvePaymentRecordType(payment);
      return RECEIPTS.has(type || (!getPaymentRecordTypeValue(payment)
        ? 'dealer_collection'
        : ''));
    })
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    + Object.values(paymentAndExpense).reduce((sum, value) => sum + value, 0));
  const totalExpenses = Object.values(paymentAndExpense).reduce((sum, value) => sum + value, 0);
  const previousPlusNetSales = roundCurrency(lastSessionDue) + totalNetSales;
  const paymentDenominator = Math.max(0, previousPlusNetSales);
  return {
    salesAmount,
    returnAmount,
    totalNetSales,
    previousPlusNetSales,
    paymentAndExpense,
    totalReceivedAmount,
    totalAmountDues: previousPlusNetSales - totalReceivedAmount,
    totalSalesDues: roundCurrency(salesTarget) - previousPlusNetSales,
    totalExpenses,
    expensePercentage: totalNetSales ? roundCurrency(totalExpenses / totalNetSales * 100) : 0,
    salesPercentage: salesTarget ? roundCurrency(previousPlusNetSales / salesTarget * 100) : 0,
    paymentPercentage: paymentDenominator > 0 && Number.isFinite(totalReceivedAmount)
      ? roundCurrency(totalReceivedAmount / paymentDenominator * 100)
      : 0
  };
}
