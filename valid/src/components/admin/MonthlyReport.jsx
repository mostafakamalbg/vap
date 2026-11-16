import React, { useState } from 'react';
import {
  BarChart3,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  CheckCircle,
  Package,
  TrendingUp,
  Search,
  Filter,
  Clock
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { toBn, toBnDate } from '../../utils/bengali';
import {
  formatDealerCode,
  formatOfficerCode,
  normalizeDealerOfficerCode,
  normalizeOfficerCode
} from '../../../shared/codes';
import { isDealerCollection, normalizePaymentType, PAYMENT_TYPES } from '../../../shared/paymentMethods';
import {
  getPackageQuantityUnit,
  getStockPackageCount
} from '../../../shared/quantityUnits';
import {
  getInvoicePackageCount as getInvoicePackageTotal,
  getItemPackageCount as getItemPackageTotal
} from '../../../shared/invoiceCartons';
import { getInvoiceStockChanges } from '../../../shared/invoiceStock';
import { buildDailyStockLedger, buildStockLedger } from '../../../shared/stockLedger';
import { STOCK_RECONCILIATION_START_DATE } from '../../../shared/stockReconciliation';
import { getInvoiceSalesAmount } from '../../../shared/invoiceTotals';
import { getInvoiceSessionForDate, INVOICE_SESSIONS, LEGACY_INVOICE_SESSION } from '../../../shared/sessions';
import { getOfficerSalesTarget } from '../../../shared/officerSalesTargets';
import SearchableRecordSelect from './SearchableRecordSelect';
import CompanyLetterhead from './CompanyLetterhead';

function getBengaliDesignation(designation = '') {
  return String(designation)
    .replace(/\bFSO\b/g, 'এফ.এস.ও.')
    .replace(/\bSO\b/g, 'এস.ও.')
    .replace(/\bTSO\b/g, 'টি.এস.ও.')
    .replace(/\bASM\b/g, 'এ.এস.এম.')
    .replace(/\bRSM\b/g, 'আর.এস.এম.');
}

function wholeAmount(value) {
  return Math.round(Number(value) || 0);
}

function formatWhole(value) {
  return wholeAmount(value).toLocaleString('en-US');
}

function formatWholeOrBlank(value) {
  return wholeAmount(value) ? formatWhole(value) : '';
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(2)}%`;
}

export default function MonthlyReport() {
  const {
    products,
    invoices,
    stockInLogs,
    damageLogs,
    payments,
    officers,
    dealers,
    currentUser
  } = useAgro();

  // Mode: 'month' | 'year' | 'dealer' | 'officer' | 'session'
  const [filterMode, setFilterMode] = useState('excel');

  // Filter States
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [reportDateYear, reportDateMonth, reportDateDay] = todayStr.split('-');
  const excelReportDate = `${reportDateDay}.${reportDateMonth}.${reportDateYear}`;
  const currentYearStr = new Date().getFullYear().toString();
  const stockTransactionDates = [...invoices, ...stockInLogs]
    .map((entry) => String(entry.date || ''))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= STOCK_RECONCILIATION_START_DATE)
    .sort();
  const earliestStockDate = stockTransactionDates[0] || STOCK_RECONCILIATION_START_DATE;
  const latestStockDate = stockTransactionDates[stockTransactionDates.length - 1] || todayStr;

  // Date Range for Dealer & Officer filtering
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(todayStr);
  const [stockStartDate, setStockStartDate] = useState('');
  const [stockEndDate, setStockEndDate] = useState('');
  const activeStockStartDate = stockStartDate || earliestStockDate;
  const activeStockEndDate = stockEndDate || (latestStockDate > todayStr ? latestStockDate : todayStr);
  const validStockDateRange = activeStockStartDate <= activeStockEndDate;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedStockOfficerId, setSelectedStockOfficerId] = useState(officers[0]?.id || '');
  const [selectedStockSession, setSelectedStockSession] = useState(
    getInvoiceSessionForDate(`${currentMonthStr}-01`) || LEGACY_INVOICE_SESSION
  );
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedDealerId, setSelectedDealerId] = useState(dealers[0]?.id || '');
  const [selectedOfficerCode, setSelectedOfficerCode] = useState(officers[0]?.code || '5');
  const [selectedOfficerMonth, setSelectedOfficerMonth] = useState(currentMonthStr);
  const [selectedOfficerSession, setSelectedOfficerSession] = useState(
    invoices.find((invoice) => invoice.session)?.session || INVOICE_SESSIONS[0]
  );
  const [selectedSession, setSelectedSession] = useState(
    invoices.find((invoice) => invoice.session)?.session || INVOICE_SESSIONS[0]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const selectedStockOfficer = officers.find((officer) => officer.id === selectedStockOfficerId)
    || officers[0]
    || null;
  const availableSessions = [...new Set([
    ...INVOICE_SESSIONS,
    ...invoices.map((invoice) => invoice.session || LEGACY_INVOICE_SESSION)
  ])].map((session) => ({ id: session }));
  const stockReportSession = availableSessions.some((session) => session.id === selectedStockSession)
    ? selectedStockSession
    : LEGACY_INVOICE_SESSION;
  const activeSession = availableSessions.some((session) => session.id === selectedSession)
    ? selectedSession
    : availableSessions[0]?.id || LEGACY_INVOICE_SESSION;
  const activeOfficerSession = selectedOfficerSession === 'ALL'
    || availableSessions.some((session) => session.id === selectedOfficerSession)
    ? selectedOfficerSession
    : 'ALL';
  const availableYears = [...new Set([
    currentYearStr,
    ...invoices.map((invoice) => invoice.date?.slice(0, 4)),
    ...damageLogs.map((entry) => entry.date?.slice(0, 4))
  ].filter(Boolean))].sort((a, b) => b.localeCompare(a));
  // Date Preset Handlers
  const handlePresetDate = (months) => {
    const end = new Date();
    const start = new Date();
    if (months === 'all') {
      setStartDate('2024-01-01');
      setEndDate(end.toISOString().slice(0, 10));
      return;
    }
    start.setMonth(start.getMonth() - months);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  // Determine filtered invoices & returns based on current mode & date range
  let filteredInvoices = [];
  let filteredDamages = [];
  let reportTitle = '';
  let reportSubtitle = '';

  if (filterMode === 'month') {
    filteredInvoices = invoices.filter((inv) => inv.date?.startsWith(selectedMonth));
    filteredDamages = damageLogs.filter((d) => d.date?.startsWith(selectedMonth));
    const [y, m] = selectedMonth.split('-');
    const bMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const bMonthName = bMonths[parseInt(m, 10) - 1] || 'অক্টোবর';
    reportTitle = `মাসিক সেলস ও ইনভেন্টরি রিপোর্ট (${bMonthName}, ${toBn(y)})`;
    reportSubtitle = `নির্দিষ্ট মাস অনুযায়ী বিক্রয়, কার্টুন প্রবাহ ও রিটার্ন বিবরণী`;
  } else if (filterMode === 'excel') {
    reportTitle = 'মাসিক সেলস ও কালেকশন রিপোর্ট';
    reportSubtitle = `${activeSession} • ${selectedMonth}`;
  } else if (filterMode === 'year') {
    filteredInvoices = invoices.filter((inv) => inv.date?.startsWith(selectedYear));
    filteredDamages = damageLogs.filter((d) => d.date?.startsWith(selectedYear));
    reportTitle = `বার্ষিক সেলস ও ইনভেন্টরি স্টেটমেন্ট (সালঃ ${toBn(selectedYear)})`;
    reportSubtitle = `এক বছরে সম্পন্ন হওয়া সকল বিক্রয়, কার্টুন সরবরাহ ও আর্থিক সমন্বয়`;
  } else if (filterMode === 'dealer') {
    const d = dealers.find((dl) => dl.id === selectedDealerId);
    filteredInvoices = invoices.filter((inv) => {
      const isDealer = inv.dealerId === selectedDealerId || inv.dealerCode === d?.code;
      const inDateRange = (!startDate || inv.date >= startDate) && (!endDate || inv.date <= endDate);
      return isDealer && inDateRange;
    });
    filteredDamages = damageLogs.filter((dmg) => {
      const isDealer = dmg.dealerId === selectedDealerId || dmg.dealerCode === d?.code;
      const inDateRange = (!startDate || dmg.date >= startDate) && (!endDate || dmg.date <= endDate);
      return isDealer && inDateRange;
    });
    reportTitle = `ডিলারভিত্তিক বিক্রয় ও রিটার্ন স্টেটমেন্ট: ${d?.shopName || 'ডিলার'}`;
    reportSubtitle = `ডিলার কোড: ${toBn(d?.code)} | প্রোপ্রাইটার: ${d?.proprietor} | এলাকা: ${d?.address} | মোবাইল: ${toBn(d?.phone)} • সময়কাল: ${toBnDate(startDate)} হতে ${toBnDate(endDate)}`;
    reportSubtitle = reportSubtitle.replace(toBn(d?.code), formatDealerCode(d?.code));
  } else if (filterMode === 'officer') {
    const off = officers.find((o) => String(o.code) === String(selectedOfficerCode) || o.id === selectedOfficerCode);
    filteredInvoices = invoices.filter((inv) => {
      const isOfficer = inv.officerId === off?.id
        || normalizeOfficerCode(inv.officerCode, off?.designation)
          === normalizeOfficerCode(off?.code, off?.designation);
      return isOfficer && inv.date?.startsWith(selectedOfficerMonth);
    });
    filteredDamages = damageLogs.filter((dmg) => {
      const isOfficer = dmg.officerId === off?.id || dmg.officerName === off?.name;
      return isOfficer && dmg.date?.startsWith(selectedOfficerMonth);
    });
    reportTitle = `অফিসার মাসিক সেলস, কালেকশন ও খরচ অ্যাপ্রেইজাল: ${off?.name || 'অফিসার'}`;
    reportTitle = reportTitle.replace(
      off?.name || 'অফিসার',
      `${off?.name || 'অফিসার'} (${formatOfficerCode(off?.code, off?.designation)})`
    );
    reportSubtitle = `টেরিটরি: ${off?.territory || '—'} | পদবী: ${off?.designation || '—'} • মাস: ${selectedOfficerMonth} • সেশন পণ্য: ${activeOfficerSession === 'ALL' ? 'সব সেশন' : activeOfficerSession}`;
  } else if (filterMode === 'session') {
    filteredInvoices = invoices.filter(
      (invoice) => (invoice.session || LEGACY_INVOICE_SESSION) === activeSession
    );
    const invoiceIds = new Set(filteredInvoices.map((invoice) => invoice.id));
    filteredDamages = damageLogs.filter(
      (entry) => entry.session === activeSession || invoiceIds.has(entry.invoiceRef)
    );
    reportTitle = 'সেশনভিত্তিক সেলস ও রিটার্ন রিপোর্ট';
    reportSubtitle = `নির্বাচিত সেশন: ${activeSession}`;
  } else if (filterMode === 'stock') {
    filteredInvoices = invoices.filter((invoice) => (
      invoice.date >= activeStockStartDate && invoice.date <= activeStockEndDate
    ));
    filteredDamages = damageLogs.filter((entry) => (
      entry.date >= activeStockStartDate && entry.date <= activeStockEndDate
    ));
    reportTitle = 'তারিখভিত্তিক স্টক লেজার';
    reportSubtitle = `${toBnDate(activeStockStartDate)} হতে ${toBnDate(activeStockEndDate)} • স্টক ইন, আউট ও রানিং ব্যালান্স`;
  }

  // Search filter
  if (searchTerm && filterMode !== 'stock') {
    filteredInvoices = filteredInvoices.filter(
      (inv) =>
        String(inv.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(inv.dealerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(inv.officerName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Summary Computations
  let totalSalesValue = 0;
  let totalCartonsSold = 0;
  let totalDealerReturnCartons = 0;
  let totalFactoryReturnCartons = 0;
  let totalDueOutstanding = 0;
  const productCartonStockChange = {};

  filteredInvoices.forEach((inv) => {
    const cartons = getInvoicePackageTotal(inv);
    const isDealerReturn = inv.invoiceType === 'dealer_return';
    const isFactoryReturn = ['factory_damage', 'depot_factory_return'].includes(inv.invoiceType);

    if (isDealerReturn) {
      totalSalesValue -= getInvoiceSalesAmount(inv);
      totalDealerReturnCartons += cartons;
    } else if (isFactoryReturn) {
      totalFactoryReturnCartons += cartons;
    } else {
      totalSalesValue += getInvoiceSalesAmount(inv);
      totalCartonsSold += cartons;
      totalDueOutstanding += Number(inv.currentDue ?? inv.dueAmount) || 0;
    }

    (inv.items || []).forEach((item) => {
      const key = `${item.productName} (${item.size})`;
      if (item.stockCondition === 'damaged'
        && ['dealer_return', 'depot_factory_return'].includes(inv.invoiceType)) return;
      const direction = isDealerReturn ? 1 : -1;
      productCartonStockChange[key] =
        (productCartonStockChange[key] || 0) + direction * getItemPackageTotal(item);
    });
  });

  const totalDamagesCount = filteredDamages.reduce(
    (acc, curr) => acc + (Number(curr.quantityPieces) || 0),
    0
  );
  const totalDamageValue = filteredDamages.reduce(
    (acc, curr) => acc + (Number(curr.totalDamageValue) || 0),
    0
  );

  const selectedOfficer = officers.find((officer) => (
    String(officer.code) === String(selectedOfficerCode) || officer.id === selectedOfficerCode
  ));
  const officerMatches = (record) => (
    record.officerId === selectedOfficer?.id
    || record.officerId === selectedOfficer?.officerId
    || record.officerId === `OFF-${String(selectedOfficer?.code || '').match(/\d+$/)?.[0]?.padStart(2, '0')}`
    || record.officerName === selectedOfficer?.name
    || Boolean(normalizeOfficerCode(record.officerCode, selectedOfficer?.designation))
      && normalizeOfficerCode(record.officerCode, selectedOfficer?.designation)
        === normalizeOfficerCode(selectedOfficer?.code, selectedOfficer?.designation)
  );
  const monthlyOfficerPayments = filterMode === 'officer'
    ? payments.filter((payment) => (
      officerMatches(payment) && String(payment.date || '').startsWith(selectedOfficerMonth)
    ))
    : [];
  const officerExpenseTransactions = monthlyOfficerPayments.filter((payment) => (
    ['salary', 'vehicle_rent', 'lc_commission'].includes(normalizePaymentType(payment.paymentType))
  ));
  const officerCollectionTransactions = monthlyOfficerPayments.filter(isDealerCollection);
  const reportPaymentTransactions = payments.filter((payment) => {
    if (filterMode === 'month') {
      return String(payment.date || '').startsWith(selectedMonth);
    }
    if (filterMode === 'stock') {
      return payment.date >= activeStockStartDate && payment.date <= activeStockEndDate;
    }
    if (filterMode === 'year') return String(payment.date || '').startsWith(selectedYear);
    if (filterMode === 'dealer') {
      const dealer = dealers.find((entry) => entry.id === selectedDealerId);
      return (payment.dealerId === selectedDealerId || payment.dealerName === dealer?.shopName)
        && (!startDate || payment.date >= startDate)
        && (!endDate || payment.date <= endDate);
    }
    if (filterMode === 'officer') {
      return officerMatches(payment) && String(payment.date || '').startsWith(selectedOfficerMonth);
    }
    if (filterMode === 'session') {
      const invoiceIds = new Set(filteredInvoices.map((invoice) => invoice.id));
      return invoiceIds.has(payment.sourceInvoiceId) || payment.session === activeSession;
    }
    return false;
  });
  const reportExpenseTransactions = reportPaymentTransactions.filter((payment) => (
    ['salary', 'vehicle_rent', 'lc_commission'].includes(normalizePaymentType(payment.paymentType))
  ));
  const reportUnloggedInvoiceCollection = filteredInvoices
    .filter((invoice) => !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType))
    .filter((invoice) => !reportPaymentTransactions.some((payment) => (
      payment.sourceInvoiceId === invoice.id
      || (
        payment.reference === `চালান #${invoice.id}`
        && payment.note === `ইনভয়েস #${invoice.id} এর বিপরীতে পরিশোধ`
      )
    )))
    .reduce((sum, invoice) => sum + (Number(invoice.paidAmount) || 0), 0);
  const reportCollection = reportPaymentTransactions
    .filter(isDealerCollection)
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), reportUnloggedInvoiceCollection);
  const reportExpenses = reportExpenseTransactions
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const sessionSalesInvoices = filterMode === 'officer'
    ? invoices.filter((invoice) => (
      officerMatches(invoice)
      && (activeOfficerSession === 'ALL'
        || (invoice.session || LEGACY_INVOICE_SESSION) === activeOfficerSession)
      && !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
    ))
    : [];
  const summarizeProducts = (entries) => {
    const totals = new Map();
    entries.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        const key = `${item.productId || item.productName}::${item.sku || item.size}`;
        const summary = totals.get(key) || {
          key,
          name: item.productName || 'পণ্য',
          sku: item.sku || '',
          size: item.size || '',
          unit: item.unit || 'পিস/বোতল',
          quantityUnit: getPackageQuantityUnit(item),
          cartons: 0,
          pieces: 0
        };
        summary.cartons += getItemPackageTotal(item);
        summary.pieces += Number(item.totalPieces)
          || getItemPackageTotal(item) * (Number(item.packPerBox) || 1);
        totals.set(key, summary);
      });
    });
    return [...totals.values()];
  };
  const officerSessionProducts = summarizeProducts(sessionSalesInvoices);
  const reportProductRows = summarizeProducts(filteredInvoices.filter((invoice) => (
    !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  )))
    .filter((row) => row.cartons > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
  const sessionYear = activeSession.match(/(\d{4})$/)?.[1] || selectedMonth.slice(0, 4);
  const isFirstHalfSession = activeSession.includes('জানুয়ারি') || activeSession.includes('জানুয়ারি');
  const sessionStartDate = `${sessionYear}-${isFirstHalfSession ? '01-01' : '07-01'}`;
  const sessionEndDate = `${sessionYear}-${isFirstHalfSession ? '06-30' : '12-31'}`;
  const isSalesInvoice = (invoice) => ![
    'dealer_return',
    'factory_damage',
    'depot_factory_return'
  ].includes(invoice.invoiceType);
  const isReturnInvoice = (invoice) => invoice.invoiceType === 'dealer_return';
  const matchesOfficer = (record, officer) => (
    record.officerId === officer.id
    || record.officerName === officer.name
    || (
      Boolean(normalizeOfficerCode(record.officerCode, officer.designation))
      && normalizeOfficerCode(record.officerCode, officer.designation)
        === normalizeOfficerCode(officer.code, officer.designation)
    )
  );
  const belongsToOfficerSession = (record) => (
    (record.session || getInvoiceSessionForDate(record.date) || LEGACY_INVOICE_SESSION) === activeSession
  );
  const matchesDealer = (record, dealer) => (
    record.dealerId === dealer.id
    || record.dealerCode === dealer.code
    || record.dealerName === dealer.shopName
  );
  const getDealerDueAt = (dealer, cutoffDate) => {
    const historicalInvoices = invoices.filter((invoice) => (
      matchesDealer(invoice, dealer)
      && invoice.date < cutoffDate
      && !['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
    ));
    const historicalSales = historicalInvoices
      .filter((invoice) => !isReturnInvoice(invoice))
      .reduce((sum, invoice) => sum + getInvoiceSalesAmount(invoice), 0);
    const historicalReturns = historicalInvoices
      .filter(isReturnInvoice)
      .reduce((sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)), 0);
    const historicalCollections = payments
      .filter((payment) => (
        isDealerCollection(payment)
        && matchesDealer(payment, dealer)
        && payment.date < cutoffDate
      ))
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const historicalDamageCredits = damageLogs
      .filter((damage) => (
        matchesDealer(damage, dealer)
        && damage.actionType === 'ledger_credit'
        && !damage.invoiceRef
        && damage.date < cutoffDate
      ))
      .reduce((sum, damage) => sum + (Number(damage.totalDamageValue) || 0), 0);
    return wholeAmount(
      (Number(dealer.openingDue) || 0)
      + historicalSales
      - historicalReturns
      - historicalCollections
      - historicalDamageCredits
    );
  };
  const officerSessionRows = officers.map((officer) => {
    const officerInvoices = invoices.filter((invoice) => (
      matchesOfficer(invoice, officer) && belongsToOfficerSession(invoice)
    ));
    const salesInvoices = officerInvoices.filter(isSalesInvoice);
    const returnInvoices = officerInvoices.filter(isReturnInvoice);
    const assignedDealers = dealers.filter((dealer) => (
      normalizeDealerOfficerCode(dealer, officers)
        === normalizeOfficerCode(officer.code, officer.designation)
    ));
    const previousDue = assignedDealers.reduce(
      (sum, dealer) => sum + getDealerDueAt(dealer, sessionStartDate),
      0
    );
    const officerPayments = payments.filter((payment) => (
      matchesOfficer(payment, officer)
      && belongsToOfficerSession(payment)
      && payment.date >= sessionStartDate
      && payment.date <= sessionEndDate
    ));
    const getPaymentTotal = (type) => wholeAmount(officerPayments
      .filter((payment) => normalizePaymentType(payment.paymentType) === type)
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0));
    const officePay = getPaymentTotal('company_transfer');
    const fare = getPaymentTotal('vehicle_rent');
    const salary = getPaymentTotal('salary');
    const lc = getPaymentTotal('lc_commission');
    const salesAmount = wholeAmount(salesInvoices.reduce(
      (sum, invoice) => sum + getInvoiceSalesAmount(invoice),
      0
    ));
    const returnAmount = wholeAmount(returnInvoices.reduce(
      (sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)),
      0
    ));
    const totalNetSales = previousDue + salesAmount - returnAmount;
    const totalReceived = officePay + fare + salary + lc;
    const target = getOfficerSalesTarget(officer, activeSession);
    const previousInvoices = officerInvoices.filter((invoice) => (
      invoice.date >= sessionStartDate && invoice.date < `${selectedMonth}-01`
    )).length;
    const salesInvoiceCount = salesInvoices.length;
    const returnInvoiceCount = returnInvoices.length;
    const totalInvoiceCount = salesInvoiceCount + returnInvoiceCount;
    const expenseTotal = officePay + fare + salary + lc;
    return {
      id: officer.id,
      officer,
      target,
      previousDue,
      salesAmount,
      returnAmount,
      totalNetSales,
      officePay,
      fare,
      salary,
      lc,
      totalReceived,
      totalAmountDue: totalNetSales - totalReceived,
      totalSalesDue: target - totalNetSales,
      expensePercent: totalNetSales ? (expenseTotal / totalNetSales) * 100 : 0,
      salesPercent: target ? (totalNetSales / target) * 100 : 0,
      paymentPercent: totalNetSales ? (totalReceived / totalNetSales) * 100 : 0,
      salesInvoiceCount,
      returnInvoiceCount,
      totalInvoiceCount,
      previousInvoices,
      runningInvoices: Math.max(0, totalInvoiceCount - previousInvoices)
    };
  });
  const officerSessionTotals = officerSessionRows.reduce((totals, row) => {
    Object.keys(totals).forEach((key) => { totals[key] += row[key]; });
    return totals;
  }, {
    target: 0,
    previousDue: 0,
    salesAmount: 0,
    returnAmount: 0,
    totalNetSales: 0,
    officePay: 0,
    fare: 0,
    salary: 0,
    lc: 0,
    totalReceived: 0,
    totalAmountDue: 0,
    totalSalesDue: 0,
    salesInvoiceCount: 0,
    returnInvoiceCount: 0,
    totalInvoiceCount: 0,
    previousInvoices: 0,
    runningInvoices: 0
  });
  officerSessionTotals.expensePercent = officerSessionTotals.totalNetSales
    ? ((officerSessionTotals.officePay + officerSessionTotals.fare
      + officerSessionTotals.salary + officerSessionTotals.lc)
      / officerSessionTotals.totalNetSales) * 100
    : 0;
  officerSessionTotals.salesPercent = officerSessionTotals.target
    ? (officerSessionTotals.totalNetSales / officerSessionTotals.target) * 100
    : 0;
  officerSessionTotals.paymentPercent = officerSessionTotals.totalNetSales
    ? (officerSessionTotals.totalReceived / officerSessionTotals.totalNetSales) * 100
    : 0;
  const excelOfficer = selectedOfficer || officers[0] || null;
  const excelOfficerDealers = excelOfficer
    ? dealers.filter((dealer) => (
      normalizeDealerOfficerCode(dealer, officers)
        === normalizeOfficerCode(excelOfficer.code, excelOfficer.designation)
    ))
    : [];
  const excelMonthStart = `${selectedMonth}-01`;
  const excelDealerRows = excelOfficerDealers.map((dealer) => {
    const previousDue = getDealerDueAt(dealer, excelMonthStart);
    const monthInvoices = invoices.filter((invoice) => (
      matchesDealer(invoice, dealer) && String(invoice.date || '').startsWith(selectedMonth)
    ));
    const salesInvoices = monthInvoices.filter(isSalesInvoice);
    const returnInvoices = monthInvoices.filter(isReturnInvoice);
    const sales = wholeAmount(salesInvoices.reduce(
      (sum, invoice) => sum + getInvoiceSalesAmount(invoice),
      0
    ));
    const returns = wholeAmount(returnInvoices.reduce(
      (sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)),
      0
    ));
    const monthPayments = payments.filter((payment) => (
      matchesDealer(payment, dealer) && String(payment.date || '').startsWith(selectedMonth)
    ));
    const paymentTotal = (type) => wholeAmount(monthPayments
      .filter((payment) => normalizePaymentType(payment.paymentType) === type)
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0));
    const salary = paymentTotal('salary');
    const collection = paymentTotal('dealer_collection');
    const fare = paymentTotal('vehicle_rent');
    const lc = paymentTotal('lc_commission');
    const invoiceCollectionsWithoutPayment = salesInvoices.reduce((sum, invoice) => {
      const hasPayment = monthPayments.some((payment) => (
        payment.sourceInvoiceId === invoice.id
        || (
          payment.reference === `চালান #${invoice.id}`
          && payment.note === `ইনভয়েস #${invoice.id} এর বিপরীতে পরিশোধ`
        )
      ));
      return sum + (hasPayment ? 0 : Number(invoice.paidAmount) || 0);
    }, 0);
    const totalCollection = collection + wholeAmount(invoiceCollectionsWithoutPayment) + salary + fare + lc;
    const totalNetSales = previousDue + sales - returns;
    return {
      id: dealer.id,
      dealer,
      previousDue,
      sales,
      returns,
      netSales: sales - returns,
      totalNetSales,
      salary,
      collection: collection + wholeAmount(invoiceCollectionsWithoutPayment),
      fare,
      lc,
      totalCollection,
      netDue: totalNetSales - totalCollection
    };
  });
  const excelDealerTotals = excelDealerRows.reduce((totals, row) => {
    Object.keys(totals).forEach((key) => { totals[key] += row[key]; });
    return totals;
  }, {
    previousDue: 0,
    sales: 0,
    returns: 0,
    netSales: 0,
    totalNetSales: 0,
    salary: 0,
    collection: 0,
    fare: 0,
    lc: 0,
    totalCollection: 0,
    netDue: 0
  });

  const stockVariantByKey = new Map(products.flatMap((product) => (product.variants || []).map((variant) => [
    `${product.id}::${variant.sku}`,
    { ...variant, productName: product.name, generic: product.generic }
  ])));
  const getStockInUnit = (entry, variant) => entry.quantityUnit
    || getPackageQuantityUnit({
      ...entry,
      productName: entry.productName || variant?.productName,
      generic: variant?.generic
    });
  const getStockInCount = (entry) => Math.trunc(Number(entry.cartons ?? entry.quantity) || 0);
  const getInvoicePackageCount = (change) => Math.trunc(Number(change.cartons) || 0);
  const stockInvoices = invoices.filter((invoice) => invoice.date >= STOCK_RECONCILIATION_START_DATE);
  const effectiveStockInLogs = stockInLogs.filter((entry) => (
    entry.date >= STOCK_RECONCILIATION_START_DATE
  ));
  const periodInvoices = stockInvoices.filter((invoice) => (
    invoice.date >= activeStockStartDate && invoice.date <= activeStockEndDate
  ));
  const stockReportRows = validStockDateRange ? products.flatMap((product) => (product.variants || []).map((variant) => {
    const productKey = `${product.id}::${variant.sku}`;
    const itemData = { ...variant, productName: product.name, generic: product.generic };
    const quantityUnit = getPackageQuantityUnit(itemData);
    const invoiceMovementQuantity = (invoice) => [...getInvoiceStockChanges(null, invoice).values()]
      .filter((change) => change.productId === product.id && change.sku === variant.sku)
      .reduce((sum, change) => sum + getInvoicePackageCount(change), 0);
    const stockInQuantity = (entry) => (
      getStockInUnit(entry, itemData) === 'পিস' ? 0 : getStockInCount(entry)
    );
    const isVariantStockIn = (entry) => (
      entry.productId === product.id && entry.sku === variant.sku
    );
    const stockInsInRange = effectiveStockInLogs.filter((entry) => (
      isVariantStockIn(entry)
      && entry.date >= activeStockStartDate && entry.date <= activeStockEndDate
    ));
    const stockInQuantityInRange = stockInsInRange.reduce(
      (sum, entry) => sum + stockInQuantity(entry),
      0
    );
    const periodInvoiceMovement = periodInvoices.reduce(
      (sum, invoice) => sum + invoiceMovementQuantity(invoice),
      0
    );
    const salesQuantity = periodInvoices
      .filter((invoice) => !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType))
      .reduce((sum, invoice) => sum + Math.max(0, -invoiceMovementQuantity(invoice)), 0);
    const dealerReturnQuantity = periodInvoices
      .filter((invoice) => invoice.invoiceType === 'dealer_return')
      .reduce((sum, invoice) => sum + Math.max(0, invoiceMovementQuantity(invoice)), 0);
    const factoryReturnQuantity = periodInvoices
      .filter((invoice) => ['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType))
      .reduce((sum, invoice) => sum + Math.max(0, -invoiceMovementQuantity(invoice)), 0);
    const futureStockInQuantity = effectiveStockInLogs
      .filter((entry) => isVariantStockIn(entry) && entry.date > activeStockEndDate)
      .reduce((sum, entry) => sum + stockInQuantity(entry), 0);
    const futureInvoiceMovement = stockInvoices
      .filter((invoice) => invoice.date > activeStockEndDate)
      .reduce((sum, invoice) => sum + invoiceMovementQuantity(invoice), 0);
    const currentQuantity = getStockPackageCount(itemData);
    const closingQuantity = currentQuantity - futureStockInQuantity - futureInvoiceMovement;
    const openingQuantity = closingQuantity - stockInQuantityInRange - periodInvoiceMovement;
    return {
      key: productKey,
      productName: product.name,
      size: variant.size || '',
      quantityUnit,
      openingQuantity,
      stockInQuantity: stockInQuantityInRange,
      dealerReturnQuantity,
      totalStockQuantity: openingQuantity + stockInQuantityInRange + dealerReturnQuantity,
      factoryReturnQuantity,
      soldQuantity: salesQuantity,
      closingQuantity
    };
  })) : [];
  const formatStockQuantity = (quantity) => toBn(Math.trunc(Number(quantity) || 0));
  const stockReportTotals = stockReportRows.reduce((totals, row) => ({
      openingQuantity: totals.openingQuantity + row.openingQuantity,
      stockInQuantity: totals.stockInQuantity + row.stockInQuantity,
      dealerReturnQuantity: totals.dealerReturnQuantity + row.dealerReturnQuantity,
      totalStockQuantity: totals.totalStockQuantity + row.totalStockQuantity,
      factoryReturnQuantity: totals.factoryReturnQuantity + row.factoryReturnQuantity,
      soldQuantity: totals.soldQuantity + row.soldQuantity,
      closingQuantity: totals.closingQuantity + row.closingQuantity
    }), {
      openingQuantity: 0,
      stockInQuantity: 0,
      dealerReturnQuantity: 0,
      totalStockQuantity: 0,
      factoryReturnQuantity: 0,
      soldQuantity: 0,
      closingQuantity: 0
    });
  const stockLedgerAllEvents = [
    ...effectiveStockInLogs.map((entry) => {
      const variant = stockVariantByKey.get(`${entry.productId}::${entry.sku}`);
      const quantityUnit = getStockInUnit(entry, variant);
      return {
        date: String(entry.date || ''),
        type: 'স্টক ইন',
        category: 'factoryIn',
        reference: entry.batchNo || entry.id || '—',
        productName: `${entry.productName || variant?.productName || 'পণ্য'}${entry.size ? ` • ${entry.size}` : ''}`,
        unit: quantityUnit,
        changeCount: getStockInCount(entry)
      };
    }),
    ...stockInvoices.flatMap((invoice) => [...getInvoiceStockChanges(null, invoice).values()].map((change) => {
      const variant = stockVariantByKey.get(`${change.productId}::${change.sku}`);
      const quantityUnit = getPackageQuantityUnit({
        ...variant,
        productName: variant?.productName || change.productId
      });
      const type = invoice.invoiceType === 'dealer_return'
        ? 'ডিলার ফেরত'
        : invoice.invoiceType === 'depot_factory_return'
          ? 'ফ্যাক্টরি ফেরত'
          : invoice.invoiceType === 'factory_damage'
            ? 'ড্যামেজ / ফেরত'
            : 'বিক্রয়';
      return {
        date: String(invoice.date || ''),
        type,
        category: invoice.invoiceType === 'dealer_return'
          ? 'marketReturn'
          : ['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
            ? 'factoryReturn'
            : 'sales',
        reference: invoice.invoiceNo || invoice.id || '—',
        productName: `${variant?.productName || change.productId} • ${variant?.size || change.sku}`,
        unit: quantityUnit,
        changeCount: getInvoicePackageCount(change)
      };
    }))
  ].filter((entry) => (
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && Number.isFinite(entry.changeCount)
    && entry.changeCount !== 0
  ));
  const stockLedgerBeforeRangeRows = stockLedgerAllEvents
    .filter((entry) => entry.date < activeStockStartDate && entry.unit !== 'পিস')
    .sort((left, right) => left.date.localeCompare(right.date));
  const stockLedgerBeforeRangeNetChange = stockLedgerBeforeRangeRows
    .reduce((sum, entry) => sum + entry.changeCount, 0);
  const currentStockPackageCount = products.reduce((total, product) => {
    (product.variants || []).forEach((variant) => {
      const itemData = { ...variant, productName: product.name, generic: product.generic };
      total += getStockPackageCount(itemData);
    });
    return total;
  }, 0);
  const { openingBalance: stockLedgerOpeningBalance, rows: ledgerRows } = buildStockLedger(
    stockLedgerAllEvents,
    activeStockStartDate,
    activeStockEndDate,
    currentStockPackageCount
  );
  const stockLedgerRows = ledgerRows.map((entry, index) => ({
    ...entry,
    id: `${entry.date}-${entry.reference}-${index}`
  }));
  const stockLedgerTotals = stockLedgerRows.reduce((totals, entry) => ({
    stockIn: totals.stockIn + (entry.category === 'factoryIn' ? Math.max(0, entry.changeCount) : 0),
    marketReturns: totals.marketReturns + (entry.category === 'marketReturn' ? Math.max(0, entry.changeCount) : 0),
    factoryReturns: totals.factoryReturns + (entry.category === 'factoryReturn' ? Math.max(0, -entry.changeCount) : 0),
    sales: totals.sales + (entry.category === 'sales' ? Math.max(0, -entry.changeCount) : 0)
  }), { stockIn: 0, marketReturns: 0, factoryReturns: 0, sales: 0 });
  const stockLedgerClosingBalance = stockLedgerRows.length
    ? stockLedgerRows[stockLedgerRows.length - 1].runningTotal
    : stockLedgerOpeningBalance;
  const stockLedgerDailyRows = buildDailyStockLedger(
    stockLedgerRows,
    stockLedgerOpeningBalance
  );
  const stockLedgerDailyTotals = stockLedgerDailyRows.reduce((totals, row) => ({
    factoryIn: totals.factoryIn + row.factoryIn,
    marketReturns: totals.marketReturns + row.marketReturns,
    factoryReturns: totals.factoryReturns + row.factoryReturns,
    sales: totals.sales + row.sales
  }), { factoryIn: 0, marketReturns: 0, factoryReturns: 0, sales: 0 });
  const stockLedgerExpectedClosingBalance = stockLedgerOpeningBalance
    + stockLedgerTotals.stockIn
    + stockLedgerTotals.marketReturns
    - stockLedgerTotals.factoryReturns
    - stockLedgerTotals.sales;
  const stockLedgerBalancesReconcile = stockLedgerExpectedClosingBalance === stockLedgerClosingBalance;

  const printReport = () => {
    const printClass = 'monthly-report-printing';
    const stockPrintClass = 'monthly-report-stock-printing';
    const cleanup = () => document.body.classList.remove(printClass);
    document.body.classList.toggle(stockPrintClass, filterMode === 'stock');
    document.body.classList.add(printClass);
    window.addEventListener('afterprint', () => {
      cleanup();
      document.body.classList.remove(stockPrintClass);
    }, { once: true });
    window.print();
  };

  return (
    <div className="monthly-report-page py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </span>
            রিপোর্ট ও এনালাইটিক্স (মাসিক, বার্ষিক, ডিলার ও অফিসারভিত্তিক)
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            এক মাসে কত সেলস/রিটার্ন, এক বছরে কত এবং যেকোনো ডিলার বা অফিসারের আলাদা আলাদা রিপোর্ট তৈরি ও প্রিন্ট
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={printReport}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition"
          >
            <Printer className="w-4 h-4" />
            <span>রিপোর্ট প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {/* Unified report selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4 no-print">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200 pb-3 sm:grid-cols-3">
          <label className="text-xs font-bold text-slate-700">
            রিপোর্টের ধরন নির্বাচন করুন:
            <select
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold"
            >
              <option value="excel">মাসিক সেলস ও কালেকশন (Excel Format)</option>
              <option value="month">মাসিক রিপোর্ট (Monthly)</option>
              <option value="year">বার্ষিক হিসাব (Yearly / Annual)</option>
              <option value="dealer">ডিলারভিত্তিক রিপোর্ট (By Dealer)</option>
              <option value="officer">অফিসারভিত্তিক রিপোর্ট (By Officer)</option>
              <option value="session">সেশনভিত্তিক রিপোর্ট</option>
              <option value="stock">তারিখভিত্তিক স্টক লেজার</option>
            </select>
          </label>
        </div>

        {/* Dynamic Controls based on selected mode */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center text-xs">
            {filterMode === 'month' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">মাস নির্বাচন করুন:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800"
                />
              </div>
            )}

            {filterMode === 'excel' && (
              <>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">রিপোর্ট মাস:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সেলস সেশন:</label>
                  <select
                    value={activeSession}
                    onChange={(event) => setSelectedSession(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-800"
                  >
                    {availableSessions.map((session) => (
                      <option key={session.id} value={session.id}>{session.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <SearchableRecordSelect
                    label="অফিসারভিত্তিক ডিটেইল শিট:"
                    items={officers.map((officer) => ({ ...officer, id: officer.code }))}
                    value={selectedOfficerCode}
                    onChange={setSelectedOfficerCode}
                    placeholder="অফিসার নির্বাচন করুন"
                    searchPlaceholder="কোড বা নাম দিয়ে খুঁজুন"
                    optionLabel={(officer) => `${formatOfficerCode(officer.code, officer.designation)} • ${officer.name}`}
                    searchText={(officer) => `${formatOfficerCode(officer.code, officer.designation)} ${officer.name}`}
                  />
                </div>
              </>
            )}

            {filterMode === 'stock' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="stock-report-officer">স্টক রিপোর্ট প্রস্তুতকারী অফিসার:</label>
                <select
                  id="stock-report-officer"
                  value={selectedStockOfficer?.id || ''}
                  onChange={(event) => setSelectedStockOfficerId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800"
                >
                  <option value="">অফিসার নির্বাচন করুন</option>
                  {officers.map((officer) => (
                    <option key={officer.id} value={officer.id}>{officer.name}</option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'stock' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="stock-report-session">সেশন নির্বাচন করুন:</label>
                <select
                  id="stock-report-session"
                  value={stockReportSession}
                  onChange={(event) => setSelectedStockSession(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800"
                >
                  {availableSessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.id}</option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'year' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">বছর নির্বাচন করুন:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800"
                >
                  {availableYears.map((year) => <option key={year} value={year}>{toBn(year)} সাল</option>)}
                </select>
              </div>
            )}

            {filterMode === 'dealer' && (
              <div className="sm:col-span-2">
                <SearchableRecordSelect
                  label={`ডিলার নির্বাচন করুন (${dealers.length} জন):`}
                  items={dealers}
                  value={selectedDealerId}
                  onChange={setSelectedDealerId}
                  placeholder="ডিলার নির্বাচন করুন"
                  searchPlaceholder="কোড বা নাম দিয়ে দ্রুত খুঁজুন"
                  optionLabel={(dealer) => `${formatDealerCode(dealer.code)} • ${dealer.shopName}`}
                  searchText={(dealer) => `${formatDealerCode(dealer.code)} ${dealer.shopName} ${dealer.proprietor || ''}`}
                />
              </div>
            )}

            {filterMode === 'officer' && (
              <div className="sm:col-span-2">
                <SearchableRecordSelect
                  label="ফিল্ড অফিসার নির্বাচন করুন:"
                  items={officers.map((officer) => ({ ...officer, id: officer.code }))}
                  value={selectedOfficerCode}
                  onChange={setSelectedOfficerCode}
                  placeholder="অফিসার নির্বাচন করুন"
                  searchPlaceholder="কোড বা নাম দিয়ে দ্রুত খুঁজুন"
                  optionLabel={(officer) => `${formatOfficerCode(officer.code, officer.designation)} • ${officer.name} • ${officer.designation}`}
                  searchText={(officer) => `${formatOfficerCode(officer.code, officer.designation)} ${officer.name} ${officer.designation || ''}`}
                />
              </div>
            )}

            {(filterMode === 'month' || filterMode === 'stock') && (
              <section className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><span className="text-xs font-semibold text-slate-500">{filterMode === 'stock' ? 'নির্বাচিত সময়ের মোট কালেকশন / আয়' : 'মাসের মোট কালেকশন / আয়'}</span><p className="mt-1 text-lg font-black text-emerald-800">৳{toBn(reportCollection)}</p></div>
                  <div><span className="text-xs font-semibold text-slate-500">{filterMode === 'stock' ? 'নির্বাচিত সময়ের মোট খরচ' : 'মাসের মোট খরচ'}</span><p className="mt-1 text-lg font-black text-rose-700">৳{toBn(reportExpenses)}</p></div>
                  <div><span className="text-xs font-semibold text-slate-500">নিট নগদ প্রবাহ</span><p className="mt-1 text-lg font-black text-slate-900">৳{toBn(reportCollection - reportExpenses)}</p></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <h5 className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800">{filterMode === 'stock' ? 'নির্বাচিত সময়ের কোম্পানি আয়-ব্যয়ের পোস্টিং' : 'কোম্পানির মাসিক আয়-ব্যয়ের পোস্টিং'}</h5>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr><th className="p-2">তারিখ</th><th className="p-2">ধরন</th><th className="p-2">ডিলার / অফিসার</th><th className="p-2">রেফারেন্স</th><th className="p-2 text-right">আয়</th><th className="p-2 text-right">ব্যয়</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportPaymentTransactions.map((payment) => {
                        const income = isDealerCollection(payment);
                        const label = PAYMENT_TYPES.find((type) => type.value === normalizePaymentType(payment.paymentType))?.label;
                        return (
                          <tr key={payment.id}>
                            <td className="p-2">{toBnDate(payment.date)}</td>
                            <td className="p-2">{label}</td>
                            <td className="p-2">{payment.dealerName || payment.officerName || '—'}</td>
                            <td className="p-2">{payment.reference || payment.note || '—'}</td>
                            <td className="p-2 text-right text-emerald-800">{income ? `৳${toBn(payment.amount)}` : '—'}</td>
                            <td className="p-2 text-right text-rose-700">{income ? '—' : `৳${toBn(payment.amount)}`}</td>
                          </tr>
                        );
                      })}
                      {!reportPaymentTransactions.length && <tr><td colSpan={6} className="p-3 text-center text-slate-500">{filterMode === 'stock' ? 'এই সময়ে কোনো পেমেন্ট বা খরচ পোস্টিং নেই।' : 'এই মাসে কোনো পেমেন্ট বা খরচ পোস্টিং নেই।'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {filterMode === 'officer' && (
              <>
                <label className="block font-bold text-slate-700">
                  মাসিক রিপোর্টের মাস:
                  <input
                    type="month"
                    value={selectedOfficerMonth}
                    onChange={(event) => setSelectedOfficerMonth(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono font-bold"
                  />
                </label>
                <SearchableRecordSelect
                  label="সেশনের পণ্য রিপোর্ট:"
                  items={[{ id: 'ALL' }, ...availableSessions]}
                  value={activeOfficerSession}
                  onChange={setSelectedOfficerSession}
                  placeholder="সেশন নির্বাচন করুন"
                  searchPlaceholder="সেশনের নাম দিয়ে খুঁজুন"
                  optionLabel={(session) => session.id === 'ALL' ? 'সব সেশন' : session.id}
                  searchText={(session) => session.id}
                />
              </>
            )}

            {filterMode === 'session' && (
              <div className="sm:col-span-2">
                <SearchableRecordSelect
                  label="সেশন নির্বাচন করুন:"
                  items={availableSessions}
                  value={activeSession}
                  onChange={setSelectedSession}
                  placeholder="সেশন নির্বাচন করুন"
                  searchPlaceholder="সেশনের নাম দিয়ে দ্রুত খুঁজুন"
                  optionLabel={(session) => session.id}
                  searchText={(session) => session.id}
                />
              </div>
            )}

            {/* Quick search input */}
            {filterMode !== 'stock' && (
              <div className="relative">
                <label className="block font-bold text-slate-700 mb-1">তালিকায় দ্রুত সার্চ:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="চালান নং বা নাম দিয়ে খুঁজুন..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {filterMode === 'stock' && (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 flex items-center gap-1 font-bold text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-emerald-700" />
                  স্টক লেজারের তারিখ পরিসর
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="font-semibold text-slate-600">
                    তারিখ থেকে
                    <input
                      type="date"
                      value={activeStockStartDate}
                      max={activeStockEndDate}
                      onChange={(event) => setStockStartDate(event.target.value)}
                      className="mt-1 block rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </label>
                  <label className="font-semibold text-slate-600">
                    তারিখ পর্যন্ত
                    <input
                      type="date"
                      value={activeStockEndDate}
                      min={activeStockStartDate}
                      onChange={(event) => setStockEndDate(event.target.value)}
                      className="mt-1 block rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setStockStartDate(''); setStockEndDate(''); }}
                className="self-start rounded border border-emerald-200 bg-white px-3 py-1.5 font-bold text-emerald-800 hover:bg-emerald-100 sm:self-auto"
              >
                কোম্পানি শুরু থেকে
              </button>
            </div>
          )}

          {/* Date Range Selector for Dealer and Officer Modes */}
          {filterMode === 'dealer' && (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  ক্যালেন্ডার ও তারিখ পরিসর (Date Range):
                </span>
                <div className="flex items-center gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">হতে:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-xs font-semibold"
                    />
                  </div>
                  <span className="text-slate-400 self-end pb-1.5">—</span>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">পর্যন্ত:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">শর্টকাট:</span>
                <button
                  type="button"
                  onClick={() => handlePresetDate(1)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ১ মাস
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(3)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ৩ মাস
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(6)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ৬ মাস
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(12)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ১ বছর
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(24)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ২ বছর
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate('all')}
                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold"
                >
                  সব সময়
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards for the filtered data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট কার্টুন সরবরাহ</p>
            <p className="text-2xl font-black text-emerald-800 mt-1 font-mono">{totalCartonsSold} কার্টুন</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ডিলার ফেরত: {totalDealerReturnCartons} • ফ্যাক্টরি ফেরত: {totalFactoryReturnCartons}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">নিট সেলস ভ্যালু</p>
            <p className="text-2xl font-black text-slate-800 mt-1 font-mono">৳{totalSalesValue.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">বিক্রয় − ডিলার ফেরত ক্রেডিট</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট ক্যাশ কালেকশন</p>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">৳{reportCollection.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">নগদ ও চেক জমা</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মেয়াদোত্তীর্ণ / ফেরত মাল</p>
            <p className="text-2xl font-black text-rose-600 mt-1 font-mono">{totalDamagesCount} বোতল</p>
            <p className="text-[11px] text-slate-400 mt-0.5">মূল্য: ৳{totalDamageValue.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Official Printable Statement Sheet */}
      <div className={`monthly-report-sheet ${filterMode === 'stock' ? 'monthly-report-stock-mode' : ''} ${filterMode === 'excel' ? 'monthly-report-excel-mode' : ''} bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6`}>
        {filterMode === 'excel' && (
          <div className="monthly-report-excel-reports">
            <section className="monthly-report-excel-page">
              <div className="monthly-report-excel-heading">
                <CompanyLetterhead className="monthly-report-excel-letterhead" />
                <div className="monthly-report-excel-heading-meta">
                  <p>Pirganj Depot</p>
                  <p>Month Of {selectedMonth}</p>
                  <p>Sub: {activeSession} Sales, Payment &amp; Expense</p>
                </div>
                <h2>Top Sheet</h2>
                <p>Date : {excelReportDate}</p>
              </div>
              <div className="monthly-report-excel-table-wrap">
                <table className="monthly-report-excel-table monthly-report-top-sheet">
                  <thead>
                    <tr>
                      <th rowSpan={2}>SL No</th>
                      <th rowSpan={2}>Mobile No</th>
                      <th rowSpan={2}>{activeSession}<br />Sales Target</th>
                      <th rowSpan={2}>Last Session<br />Due</th>
                      <th rowSpan={2}>Sales<br />Amount Tk</th>
                      <th rowSpan={2}>Return<br />Amount Tk</th>
                      <th rowSpan={2}>Previous + Net Sales<br />Amount Tk</th>
                      <th colSpan={4}>Payment &amp; Expense</th>
                      <th className="excel-orange-header" rowSpan={2}>Total Received<br />Amount</th>
                      <th className="excel-orange-header" rowSpan={2}>Total Amount<br />Dues</th>
                      <th className="excel-orange-header" rowSpan={2}>Total Net<br />Sales</th>
                      <th className="excel-orange-header" rowSpan={2}>Total Sales<br />Dues</th>
                      <th className="excel-orange-header" rowSpan={2}>Expense<br />Percentage</th>
                      <th className="excel-orange-header" rowSpan={2}>Sales<br />Percentage</th>
                      <th className="excel-orange-header" rowSpan={2}>Payment<br />Percentage</th>
                      <th className="excel-yellow-header" rowSpan={2}>Sales<br />Invoice</th>
                      <th className="excel-yellow-header" rowSpan={2}>Return<br />Invoice</th>
                      <th className="excel-yellow-header" rowSpan={2}>Total<br />Invoice</th>
                      <th className="excel-yellow-header" rowSpan={2}>Previous</th>
                      <th className="excel-yellow-header" rowSpan={2}>Running</th>
                    </tr>
                    <tr>
                      <th>Office Pay</th>
                      <th>Fare</th>
                      <th>Salary</th>
                      <th>L/C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officerSessionRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td className="text-left">{row.officer.phone || ''}</td>
                        <td>{formatWhole(row.target)}</td>
                        <td>{formatWhole(row.previousDue)}</td>
                        <td>{formatWhole(row.salesAmount)}</td>
                        <td>{formatWhole(row.returnAmount)}</td>
                        <td className="excel-emphasis">{formatWhole(row.totalNetSales)}</td>
                        <td>{formatWhole(row.officePay)}</td>
                        <td>{formatWhole(row.fare)}</td>
                        <td>{formatWhole(row.salary)}</td>
                        <td>{formatWhole(row.lc)}</td>
                        <td>{formatWhole(row.totalReceived)}</td>
                        <td>{formatWhole(row.totalAmountDue)}</td>
                        <td className="excel-emphasis">{formatWhole(row.totalNetSales)}</td>
                        <td>{formatWhole(row.totalSalesDue)}</td>
                        <td>{formatPercent(row.expensePercent)}</td>
                        <td>{formatPercent(row.salesPercent)}</td>
                        <td>{formatPercent(row.paymentPercent)}</td>
                        <td>{formatWhole(row.salesInvoiceCount)}</td>
                        <td>{formatWhole(row.returnInvoiceCount)}</td>
                        <td>{formatWhole(row.totalInvoiceCount)}</td>
                        <td>{formatWhole(row.previousInvoices)}</td>
                        <td>{formatWhole(row.runningInvoices)}</td>
                      </tr>
                    ))}
                    <tr className="excel-total-row">
                      <th colSpan={2}>Total Tk</th>
                      <td>{formatWhole(officerSessionTotals.target)}</td>
                      <td>{formatWhole(officerSessionTotals.previousDue)}</td>
                      <td>{formatWhole(officerSessionTotals.salesAmount)}</td>
                      <td>{formatWhole(officerSessionTotals.returnAmount)}</td>
                      <td>{formatWhole(officerSessionTotals.totalNetSales)}</td>
                      <td>{formatWhole(officerSessionTotals.officePay)}</td>
                      <td>{formatWhole(officerSessionTotals.fare)}</td>
                      <td>{formatWhole(officerSessionTotals.salary)}</td>
                      <td>{formatWhole(officerSessionTotals.lc)}</td>
                      <td>{formatWhole(officerSessionTotals.totalReceived)}</td>
                      <td>{formatWhole(officerSessionTotals.totalAmountDue)}</td>
                      <td>{formatWhole(officerSessionTotals.totalNetSales)}</td>
                      <td>{formatWhole(officerSessionTotals.totalSalesDue)}</td>
                      <td>{formatPercent(officerSessionTotals.expensePercent)}</td>
                      <td>{formatPercent(officerSessionTotals.salesPercent)}</td>
                      <td>{formatPercent(officerSessionTotals.paymentPercent)}</td>
                      <td>{formatWhole(officerSessionTotals.salesInvoiceCount)}</td>
                      <td>{formatWhole(officerSessionTotals.returnInvoiceCount)}</td>
                      <td>{formatWhole(officerSessionTotals.totalInvoiceCount)}</td>
                      <td>{formatWhole(officerSessionTotals.previousInvoices)}</td>
                      <td>{formatWhole(officerSessionTotals.runningInvoices)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="monthly-report-excel-page">
              <header className="monthly-report-excel-detail-heading">
                <div>
                  <p><b>Name of the Person:</b> {excelOfficer?.name || '—'}</p>
                  <p><b>Designation:</b> {excelOfficer?.designation || '—'}</p>
                  <p><b>Name of the area:</b> {excelOfficer?.territory || '—'}</p>
                  <p><b>Mobile no:</b> {excelOfficer?.phone || '—'}</p>
                  <p><b>Month of:</b> {selectedMonth}</p>
                </div>
                <div className="monthly-report-excel-company">
                  <CompanyLetterhead className="monthly-report-excel-letterhead" />
                  <p>Monthly sales and collection Report form</p>
                  <p>Session : {activeSession}</p>
                </div>
                <p className="monthly-report-excel-date"><b>Reporting date:</b> {excelReportDate}</p>
              </header>
              <div className="monthly-report-excel-table-wrap">
                <table className="monthly-report-excel-table monthly-report-detail-sheet">
                  <thead>
                    <tr>
                      <th rowSpan={2}>SL<br />NO</th>
                      <th rowSpan={2}>Name of the party</th>
                      <th rowSpan={2}>Last month<br />Dues</th>
                      <th colSpan={3}>Present month</th>
                      <th rowSpan={2}>Last &amp; present<br />net sales</th>
                      <th colSpan={4}>Present month</th>
                      <th rowSpan={2}>Present month<br />Total Collection</th>
                      <th rowSpan={2}>Present month<br />Net Dues</th>
                    </tr>
                    <tr>
                      <th>Sales</th>
                      <th>Return</th>
                      <th>Net sales</th>
                      <th>Salary</th>
                      <th>Collection</th>
                      <th>Fare</th>
                      <th>L/C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelDealerRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td className="text-left">{row.dealer.shopName}</td>
                        <td>{formatWholeOrBlank(row.previousDue)}</td>
                        <td>{formatWholeOrBlank(row.sales)}</td>
                        <td>{formatWholeOrBlank(row.returns)}</td>
                        <td>{formatWholeOrBlank(row.netSales)}</td>
                        <td>{formatWholeOrBlank(row.totalNetSales)}</td>
                        <td>{formatWholeOrBlank(row.salary)}</td>
                        <td>{formatWholeOrBlank(row.collection)}</td>
                        <td>{formatWholeOrBlank(row.fare)}</td>
                        <td>{formatWholeOrBlank(row.lc)}</td>
                        <td>{formatWholeOrBlank(row.totalCollection)}</td>
                        <td>{formatWholeOrBlank(row.netDue)}</td>
                      </tr>
                    ))}
                    {!excelDealerRows.length && (
                      <tr><td colSpan={13}>এই অফিসারের অধীনে কোনো ডিলার নেই।</td></tr>
                    )}
                    <tr className="excel-total-row">
                      <th colSpan={2}>Total Tk</th>
                      <td>{formatWhole(excelDealerTotals.previousDue)}</td>
                      <td>{formatWhole(excelDealerTotals.sales)}</td>
                      <td>{formatWhole(excelDealerTotals.returns)}</td>
                      <td>{formatWhole(excelDealerTotals.netSales)}</td>
                      <td>{formatWhole(excelDealerTotals.totalNetSales)}</td>
                      <td>{formatWhole(excelDealerTotals.salary)}</td>
                      <td>{formatWhole(excelDealerTotals.collection)}</td>
                      <td>{formatWhole(excelDealerTotals.fare)}</td>
                      <td>{formatWhole(excelDealerTotals.lc)}</td>
                      <td>{formatWhole(excelDealerTotals.totalCollection)}</td>
                      <td>{formatWhole(excelDealerTotals.netDue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <footer className="monthly-report-excel-signatures">
                {[
                  ['Prepared by', 'S. O.'],
                  ['Checked by', 'ASM'],
                  ['Checked by', 'L.O.'],
                  ['Approved by', 'C.E.O']
                ].map(([label, role]) => (
                  <div key={role}><span>{label}</span><b>{role}</b></div>
                ))}
              </footer>
            </section>
          </div>
        )}
        <div className="monthly-report-print-header border-b-2 border-emerald-800 pb-4">
          <CompanyLetterhead className="monthly-report-letterhead" />
          <div className="mt-2 text-center">
            <div className="inline-block rounded bg-emerald-800 px-5 py-1 text-xs font-black uppercase tracking-wider text-white">
              {toBn(reportTitle)}
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium text-center">{toBn(reportSubtitle)}</p>
          {filterMode === 'stock' && (
            <div className="monthly-report-stock-officer-details">
              <span><b>প্রস্তুতকারী:</b> {selectedStockOfficer?.name || '—'}</span>
              <span><b>পদবি:</b> {getBengaliDesignation(selectedStockOfficer?.designation || '—')}</span>
              <span><b>ঠিকানা:</b> {selectedStockOfficer?.territory || '—'}</span>
              <span><b>মোবাইল:</b> {selectedStockOfficer?.phone ? toBn(selectedStockOfficer.phone) : '—'}</span>
            </div>
          )}
        </div>

        <section className="monthly-report-summary rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs" aria-label="সারসংক্ষেপ ও আর্থিক হিসাব">
          <h3 className="mb-2 text-sm font-black text-slate-800">আর্থিক সারসংক্ষেপ</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <span className="text-slate-500 font-medium">মোট বিক্রিত কার্টুন:</span>
              <p className="text-base font-black text-emerald-800 font-mono">{toBn(totalCartonsSold)} কার্টুন</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">নিট চালান মূল্য:</span>
              <p className="text-base font-black text-slate-900 font-mono">৳{toBn(totalSalesValue)}</p>
              <p className="text-[10px] text-slate-500">বিক্রয় − ডিলার ফেরত</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">আদায়কৃত কালেকশন:</span>
              <p className="text-base font-black text-emerald-700 font-mono">৳{toBn(reportCollection)}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">অবশিষ্ট বকেয়া / ডিউ:</span>
              <p className="text-base font-black text-rose-700 font-mono">৳{toBn(totalDueOutstanding)}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">ফেরত / ক্ষতিগ্রস্ত প্যাকেজ:</span>
              <p className="text-base font-black text-amber-700 font-mono">{toBn(totalDealerReturnCartons + totalFactoryReturnCartons)} প্যাকেজ</p>
              <p className="text-[10px] text-slate-500">ডিলার {toBn(totalDealerReturnCartons)} • ফ্যাক্টরি {toBn(totalFactoryReturnCartons)}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">মোট খরচ (বেতন, ভাড়া, এল/সি):</span>
              <p className="text-base font-black text-rose-700 font-mono">৳{toBn(reportExpenses)}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">নিট কালেকশন − খরচ:</span>
              <p className="text-base font-black text-slate-900 font-mono">৳{toBn(reportCollection - reportExpenses)}</p>
            </div>
          </div>
        </section>

        <section className="monthly-report-product-section space-y-2" aria-label="SKU অনুযায়ী পণ্য বিবরণ">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-800">পণ্য ও প্যাকেজ বিবরণ</h3>
              <p className="text-[11px] text-slate-500">শুধুমাত্র পূর্ণ কার্টুন / প্যাকেজ; খুচরা পিস অন্তর্ভুক্ত নয়</p>
            </div>
            <span className="text-xs font-bold text-emerald-800">
              মোট {toBn(reportProductRows.reduce((sum, row) => sum + row.cartons, 0))} প্যাকেজ
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="monthly-report-product-table w-full min-w-[620px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-center">নং</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">পণ্যের নাম</th>
                  <th className="px-3 py-2">প্যাক সাইজ</th>
                  <th className="px-3 py-2 text-right">পরিমাণ (কার্টুন / প্যাকেজ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportProductRows.map((row, index) => (
                  <tr key={row.key}>
                    <td className="px-3 py-1.5 text-center text-slate-500">{toBn(index + 1)}</td>
                    <td className="px-3 py-1.5 font-mono font-semibold text-slate-600">{row.sku || '—'}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{row.name}</td>
                    <td className="px-3 py-1.5 text-slate-600">{row.size || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-emerald-800">{toBn(row.cartons)} {row.quantityUnit}</td>
                  </tr>
                ))}
                {!reportProductRows.length && (
                  <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-500">নির্বাচিত সময়ে কোনো পূর্ণ প্যাকেজ বিক্রয় নেই।</td></tr>
                )}
              </tbody>
              {reportProductRows.length > 0 && (
                <tfoot className="border-t border-slate-300 bg-slate-50 font-black">
                  <tr>
                    <th colSpan={4} className="px-3 py-1.5 text-right">সর্বমোট প্যাকেজ</th>
                    <td className="px-3 py-1.5 text-right text-emerald-800">
                      {toBn(reportProductRows.reduce((sum, row) => sum + row.cartons, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {filterMode === 'officer' && (
          <section className="space-y-4">
            <h4 className="text-sm font-black text-slate-800">নির্বাচিত সেশনে অফিসারের পণ্য সরবরাহ</h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <h5 className="bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
                {activeOfficerSession === 'ALL' ? 'সব সেশন' : toBn(activeOfficerSession)}
              </h5>
              <table className="monthly-report-product-table w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr><th className="px-3 py-2">SKU</th><th className="px-3 py-2">পণ্য</th><th className="px-3 py-2">প্যাক সাইজ</th><th className="px-3 py-2 text-right">কার্টুন / প্যাকেজ</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officerSessionProducts.filter((row) => row.cartons > 0).map((row) => (
                    <tr key={row.key}>
                      <td className="px-3 py-1.5 font-mono">{row.sku || '—'}</td>
                      <td className="px-3 py-1.5 font-semibold">{row.name}</td>
                      <td className="px-3 py-1.5">{row.size || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-bold">{toBn(row.cartons)} {row.quantityUnit}</td>
                    </tr>
                  ))}
                  {!officerSessionProducts.some((row) => row.cartons > 0) && (
                    <tr><td colSpan={4} className="p-3 text-center text-slate-500">এই সেশনে কোনো পূর্ণ প্যাকেজ সরবরাহ নেই।</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <h5 className="bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900">মাসিক খরচের পোস্টিং</h5>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr><th className="p-2">তারিখ</th><th className="p-2">খরচের ধরন</th><th className="p-2">রেফারেন্স / নোট</th><th className="p-2 text-right">পরিমাণ</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officerExpenseTransactions.map((payment) => (
                    <tr key={payment.id}>
                      <td className="p-2">{toBnDate(payment.date)}</td>
                      <td className="p-2">{PAYMENT_TYPES.find((type) => type.value === normalizePaymentType(payment.paymentType))?.label}</td>
                      <td className="p-2">{payment.reference || payment.note || '—'}</td>
                      <td className="p-2 text-right font-bold text-rose-700">৳{toBn(payment.amount)}</td>
                    </tr>
                  ))}
                  {!officerExpenseTransactions.length && <tr><td colSpan={4} className="p-3 text-center text-slate-500">নির্বাচিত মাসে কোনো খরচ পোস্টিং নেই।</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <h5 className="bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">মাসিক কালেকশন পোস্টিং</h5>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr><th className="p-2">তারিখ</th><th className="p-2">ডিলার</th><th className="p-2">মাধ্যম / রেফারেন্স</th><th className="p-2 text-right">পরিমাণ</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officerCollectionTransactions.map((payment) => (
                    <tr key={payment.id}>
                      <td className="p-2">{toBnDate(payment.date)}</td>
                      <td className="p-2">{payment.dealerName || payment.dealerId || '—'}</td>
                      <td className="p-2">{payment.reference || payment.paymentMethod || '—'}</td>
                      <td className="p-2 text-right font-bold text-emerald-800">৳{toBn(payment.amount)}</td>
                    </tr>
                  ))}
                  {!officerCollectionTransactions.length && <tr><td colSpan={4} className="p-3 text-center text-slate-500">নির্বাচিত মাসে কোনো কালেকশন পোস্টিং নেই।</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {filterMode === 'stock' && (
          <section className="monthly-report-stock-section space-y-3">
            {!validStockDateRange && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                স্টক রিপোর্টের শুরুর তারিখ শেষ তারিখের আগে বা সমান হতে হবে।
              </p>
            )}
            {validStockDateRange && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['গত মাসের স্টক / শুরুর ব্যালান্স', stockLedgerOpeningBalance],
                    ['ফ্যাক্টরি থেকে প্যাকেজ ইন', stockLedgerTotals.stockIn],
                    ['বাজার থেকে ফেরত', stockLedgerTotals.marketReturns],
                    ['ফ্যাক্টরিতে ফেরত', stockLedgerTotals.factoryReturns],
                    ['বিক্রয়', stockLedgerTotals.sales],
                    ['শেষ প্যাকেজ ব্যালান্স', stockLedgerClosingBalance]
                  ].map(([label, amount]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-500">{label}</p>
                      <p className={`mt-1 text-lg font-black ${amount < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                        {formatStockQuantity(amount)} প্যাকেজ
                      </p>
                    </div>
                  ))}
                </div>
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                  ফিজিক্যাল লেজার: গত মাসের স্টক + ফ্যাক্টরি রিসিভ + বাজার থেকে ফেরত − (ফ্যাক্টরিতে ফেরত + বিক্রয়) = নিট স্টক।
                  {' '}
                  হিসাব: {formatStockQuantity(stockLedgerOpeningBalance)} + {formatStockQuantity(stockLedgerTotals.stockIn)}
                  {' + '}{formatStockQuantity(stockLedgerTotals.marketReturns)}
                  {' - ('}{formatStockQuantity(stockLedgerTotals.factoryReturns)}
                  {' + '}{formatStockQuantity(stockLedgerTotals.sales)}{')'}
                  {' = '}{formatStockQuantity(stockLedgerExpectedClosingBalance)} প্যাকেজ
                  {stockLedgerBalancesReconcile
                    ? ' (শেষ ব্যালান্সের সঙ্গে মিলে গেছে)'
                    : ` (লেজারের শেষ ব্যালান্স ${formatStockQuantity(stockLedgerClosingBalance)}; পার্থক্য আছে)`}
                </p>
                {stockLedgerBeforeRangeRows.length > 0 && (
                  <details className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <summary className="cursor-pointer text-xs font-bold text-amber-900">
                      নির্বাচিত শুরুর তারিখের আগের {toBn(stockLedgerBeforeRangeRows.length)}টি প্যাকেজ লেনদেন দেখুন
                      {' • '}নিট পরিবর্তন {formatStockQuantity(stockLedgerBeforeRangeNetChange)}
                    </summary>
                    <div className="mt-3 overflow-x-auto rounded border border-amber-100 bg-white">
                      <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="p-2">তারিখ</th>
                            <th className="p-2">লেনদেন</th>
                            <th className="p-2">রেফারেন্স</th>
                            <th className="p-2">পণ্য</th>
                            <th className="p-2">ইউনিট</th>
                            <th className="p-2 text-right">পরিমাণ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stockLedgerBeforeRangeRows.map((row, index) => (
                            <tr key={`${row.date}-${row.reference}-${index}`}>
                              <td className="p-2 whitespace-nowrap">{toBnDate(row.date)}</td>
                              <td className="p-2">{row.type}</td>
                              <td className="p-2">{row.reference}</td>
                              <td className="p-2">{row.productName}</td>
                              <td className="p-2">{row.unit}</td>
                              <td className="p-2 text-right">{formatStockQuantity(row.changeCount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <h4 className="bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-900">
                    তারিখভিত্তিক পূর্ণ প্যাকেজ লেনদেন
                  </h4>
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-2">তারিখ</th>
                        <th className="p-2 text-right">ফ্যাক্টরি প্যাকেজ ইন</th>
                        <th className="p-2 text-right">বাজার থেকে ফেরত</th>
                        <th className="p-2 text-right">ফ্যাক্টরিতে ফেরত</th>
                        <th className="p-2 text-right">বিক্রয়</th>
                        <th className="p-2 text-right">চলতি প্যাকেজ ব্যালান্স</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockLedgerDailyRows.map((row) => (
                        <tr key={row.date}>
                          <td className="p-2 whitespace-nowrap">{toBnDate(row.date)}</td>
                          <td className="p-2 text-right text-emerald-800">{formatStockQuantity(row.factoryIn)}</td>
                          <td className="p-2 text-right">{formatStockQuantity(row.marketReturns)}</td>
                          <td className="p-2 text-right text-rose-700">{formatStockQuantity(row.factoryReturns)}</td>
                          <td className="p-2 text-right text-rose-700">{formatStockQuantity(row.sales)}</td>
                          <td className="p-2 text-right font-bold">{formatStockQuantity(row.runningTotal)}</td>
                        </tr>
                      ))}
                      {!stockLedgerDailyRows.length && (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-500">নির্বাচিত সময়ে কোনো প্যাকেজ লেনদেন নেই।</td></tr>
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-black">
                      <tr>
                        <th className="p-2 text-left">সর্বমোট</th>
                        <td className="p-2 text-right">{formatStockQuantity(stockLedgerDailyTotals.factoryIn)}</td>
                        <td className="p-2 text-right">{formatStockQuantity(stockLedgerDailyTotals.marketReturns)}</td>
                        <td className="p-2 text-right">{formatStockQuantity(stockLedgerDailyTotals.factoryReturns)}</td>
                        <td className="p-2 text-right">{formatStockQuantity(stockLedgerDailyTotals.sales)}</td>
                        <td className="p-2 text-right">{formatStockQuantity(stockLedgerClosingBalance)} (শেষ ব্যালান্স)</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <h4 className="bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-900">
                    সম্মিলিত প্যাকেজ লেজার
                  </h4>
                  <table className="w-full min-w-[980px] text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-2">তারিখ</th>
                        <th className="p-2">লেনদেন</th>
                        <th className="p-2">রেফারেন্স</th>
                        <th className="p-2">পণ্য / প্যাক সাইজ</th>
                        <th className="p-2">ইউনিট</th>
                        <th className="p-2 text-right">স্টক পরিবর্তন</th>
                        <th className="p-2 text-right">সম্মিলিত প্যাকেজ ব্যালান্স</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockLedgerRows.map((row) => (
                        <tr key={row.id}>
                          <td className="p-2 whitespace-nowrap">{toBnDate(row.date)}</td>
                          <td className="p-2 font-semibold">{row.type}</td>
                          <td className="p-2">{row.reference}</td>
                          <td className="p-2">{row.productName}</td>
                          <td className="p-2">{row.unit}</td>
                          <td className={`p-2 text-right font-semibold ${row.changeCount < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                            {row.changeCount > 0 ? '+' : ''}{formatStockQuantity(row.changeCount)}
                          </td>
                          <td className={`p-2 text-right font-bold ${row.runningTotal < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                            {formatStockQuantity(row.runningTotal)}
                          </td>
                        </tr>
                      ))}
                      {!stockLedgerRows.length && (
                        <tr><td colSpan={7} className="p-4 text-center text-slate-500">নির্বাচিত সময়ে কোনো স্টক লেনদেন নেই।</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="monthly-report-stock-table w-full min-w-[1200px] text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr className="monthly-report-stock-month-row">
                    <th colSpan={10} className="monthly-report-stock-continuation">
                      স্টক রিপোর্টের ধারাবাহিক অংশ
                    </th>
                  </tr>
                  <tr>
                    <th className="p-2">পণ্যের নাম</th>
                    <th className="p-2">প্যাক সাইজ</th>
                    <th className="p-2">ইউনিট</th>
                    <th className="p-2 text-right">ওপেনিং পরিমাণ</th>
                    <th className="p-2 text-right">স্টক ইন</th>
                    <th className="p-2 text-right">ডিলার ফেরত</th>
                    <th className="p-2 text-right">মোট স্টক</th>
                    <th className="p-2 text-right">ফ্যাক্টরি ফেরত</th>
                    <th className="p-2 text-right">বিক্রয়</th>
                    <th className="p-2 text-right">ক্লোজিং পরিমাণ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockReportRows.map((row) => (
                    <tr key={row.key}>
                      <td className="p-2 font-semibold">{row.productName}</td>
                      <td className="p-2">{row.size}</td>
                      <td className="p-2">{row.quantityUnit}</td>
                      <td className="p-2 text-right">{formatStockQuantity(row.openingQuantity)}</td>
                      <td className="p-2 text-right">{formatStockQuantity(row.stockInQuantity)}</td>
                      <td className="p-2 text-right">{formatStockQuantity(row.dealerReturnQuantity)}</td>
                      <td className="p-2 text-right font-semibold">{formatStockQuantity(row.totalStockQuantity)}</td>
                      <td className="p-2 text-right text-rose-700">{formatStockQuantity(row.factoryReturnQuantity)}</td>
                      <td className="p-2 text-right">{formatStockQuantity(row.soldQuantity)}</td>
                      <td className={`p-2 text-right font-bold ${row.closingQuantity < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{formatStockQuantity(row.closingQuantity)}</td>
                    </tr>
                  ))}
                  {!stockReportRows.length && <tr><td colSpan={10} className="p-5 text-center text-slate-500">পণ্যের কোনো তথ্য পাওয়া যায়নি।</td></tr>}
                </tbody>
                <tfoot className="monthly-report-stock-total bg-slate-100 font-bold">
                  <tr>
                    <th colSpan={3} className="p-2 text-left">সর্বমোট প্যাকেজ</th>
                    <td className="p-2 text-right">{formatStockQuantity(stockReportTotals.openingQuantity)}</td>
                    <td className="p-2 text-right">{formatStockQuantity(stockReportTotals.stockInQuantity)}</td>
                    <td className="p-2 text-right">{formatStockQuantity(stockReportTotals.dealerReturnQuantity)}</td>
                    <td className="p-2 text-right">{formatStockQuantity(stockReportTotals.totalStockQuantity)}</td>
                    <td className="p-2 text-right">{formatStockQuantity(stockReportTotals.factoryReturnQuantity)}</td>
                    <td className="p-2 text-right">{formatStockQuantity(stockReportTotals.soldQuantity)}</td>
                    <td className="p-2 text-right">{formatStockQuantity(stockReportTotals.closingQuantity)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="monthly-report-stock-signatures mt-12 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4" aria-label="স্টক রিপোর্টের স্বাক্ষর">
              {[
                { label: 'প্রস্তুত করেছেন', role: 'এস.ও.' },
                { label: 'যাচাই করেছেন', role: 'এ.এস.এম.' },
                { label: 'যাচাই করেছেন', role: 'এল.ও.' },
                { label: 'অনুমোদন করেছেন', role: 'সি.ই.ও.' }
              ].map(({ label, role }) => (
                <div key={role} className="pt-8 text-center text-xs font-semibold text-slate-800">
                  <div className="mb-1 border-t border-slate-500" />
                  <p>{label}</p>
                  <p className="font-bold">{role}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Product Carton Dispatch Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-700" />
            ইনভয়েসভিত্তিক কার্টুন স্টক পরিবর্তন (+ জমা, − বহিঃপ্রবাহ):
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-3 w-10">নং</th>
                  <th className="py-2.5 px-3">পণ্যের বিবরণ ও প্যাক সাইজ</th>
                  <th className="py-2.5 px-3 text-center">নিট স্টক পরিবর্তন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.keys(productCartonStockChange).map((pKey, idx) => (
                  <tr key={pKey} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{pKey}</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-800 font-mono text-sm">
                      {productCartonStockChange[pKey] > 0 ? '+' : ''}
                      {productCartonStockChange[pKey]} কার্টুন
                    </td>
                  </tr>
                ))}
                {Object.keys(productCartonStockChange).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400 italic">
                      নির্বাচিত ফিল্টারে কোনো স্টক পরিবর্তনের ইনভয়েস নেই।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoices Log Table */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            অন্তর্ভুক্ত চালানের বিস্তারিত তালিকা:
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-2">চালান নং</th>
                  <th className="p-2">তারিখ</th>
                  <th className="p-2">ডিলার প্রতিষ্ঠান</th>
                  <th className="p-2 text-center">অফিসার কোড</th>
                  <th className="p-2 text-center">কার্টুন</th>
                  <th className="p-2 text-right">চালান বিল (৳)</th>
                  <th className="p-2 text-right">জমা (৳)</th>
                  <th className="p-2 text-right">বকেয়া (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono font-bold text-emerald-800">{inv.id}</td>
                    <td className="p-2 font-mono">{inv.date}</td>
                    <td className="p-2 font-semibold text-slate-800">
                      {inv.dealerName} <span className="text-[10px] text-slate-400 font-mono">[{formatDealerCode(inv.dealerCode)}]</span>
                    </td>
                    <td className="p-2 text-center">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        কোড: {formatOfficerCode(inv.officerCode)}
                      </span>
                    </td>
                    <td className="p-2 text-center font-bold text-emerald-800 font-mono">{getInvoicePackageTotal(inv)}</td>
                    <td className="p-2 text-right font-mono font-bold">৳{getInvoiceSalesAmount(inv).toLocaleString()}</td>
                    <td className="p-2 text-right font-mono text-emerald-700 font-bold">৳{(Number(inv.paidAmount) || 0).toLocaleString()}</td>
                    <td className="p-2 text-right font-mono text-rose-700 font-bold">৳{(Number(inv.currentDue ?? inv.dueAmount) || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                      কোনো চালানের রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="monthly-report-signatures grid grid-cols-3 gap-6 pt-14 text-center text-xs" aria-label="রিপোর্ট অনুমোদন স্বাক্ষর">
          {[
            { label: 'প্রিপেয়ার্ড বাই', role: 'প্রস্তুতকারীর স্বাক্ষর' },
            { label: 'চেকড বাই', role: 'যাচাইকারীর স্বাক্ষর' },
            { label: 'সিইও সিগনেচার', role: 'অনুমোদিত স্বাক্ষর' }
          ].map(({ label, role }) => (
            <div key={label} className="pt-8 font-semibold">
              <div className="border-t border-slate-500" />
              <p className="mt-1">{label}</p>
              <p className="font-normal text-slate-600">{role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
