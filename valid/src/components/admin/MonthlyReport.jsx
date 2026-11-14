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
import { formatDealerCode, formatOfficerCode, normalizeOfficerCode } from '../../../shared/codes';
import { isDealerCollection, normalizePaymentType, PAYMENT_TYPES } from '../../../shared/paymentMethods';
import { getPackageQuantityUnit } from '../../../shared/quantityUnits';
import { getInvoiceCartons, getItemCartons } from '../../../shared/invoiceCartons';
import { getInvoiceSalesAmount } from '../../../shared/invoiceTotals';
import { getInvoiceSessionForDate, INVOICE_SESSIONS, LEGACY_INVOICE_SESSION } from '../../../shared/sessions';
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

export default function MonthlyReport() {
  const { products, invoices, stockInLogs, damageLogs, payments, officers, dealers } = useAgro();

  // Mode: 'month' | 'year' | 'dealer' | 'officer' | 'session'
  const [filterMode, setFilterMode] = useState('dealer');

  // Filter States
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentYearStr = new Date().getFullYear().toString();

  // Date Range for Dealer & Officer filtering
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(todayStr);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedStockOfficerId, setSelectedStockOfficerId] = useState(officers[0]?.id || '');
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
  const stockReportSession = getInvoiceSessionForDate(`${selectedMonth}-01`);
  const availableSessions = [...new Set([
    ...INVOICE_SESSIONS,
    ...invoices.map((invoice) => invoice.session || LEGACY_INVOICE_SESSION)
  ])].map((session) => ({ id: session }));
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
  const stockReportMonth = selectedMonth
    ? new Intl.DateTimeFormat('bn-BD', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${selectedMonth}-01T00:00:00.000Z`))
    : '';

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
    filteredInvoices = invoices.filter((invoice) => invoice.date?.startsWith(selectedMonth));
    filteredDamages = damageLogs.filter((entry) => entry.date?.startsWith(selectedMonth));
    reportTitle = `মাসশেষ ইনভেন্টরি স্টক রিপোর্ট (${stockReportMonth})`;
    reportSubtitle = 'মাসের শেষ দিনের অবশিষ্ট স্টক, স্টক ইন, বিক্রয়, ফেরত ও ড্যামেজ';
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
    const cartons = getInvoiceCartons(inv);
    const isDealerReturn = inv.invoiceType === 'dealer_return';
    const isFactoryReturn = inv.invoiceType === 'factory_damage';

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
      const direction = isDealerReturn ? 1 : -1;
      productCartonStockChange[key] =
        (productCartonStockChange[key] || 0) + direction * getItemCartons(item);
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
  const officerMonthlyExpenses = monthlyOfficerPayments
    .filter((payment) => ['salary', 'vehicle_rent', 'lc_commission'].includes(normalizePaymentType(payment.paymentType)))
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const officerExpenseTransactions = monthlyOfficerPayments.filter((payment) => (
    ['salary', 'vehicle_rent', 'lc_commission'].includes(normalizePaymentType(payment.paymentType))
  ));
  const officerCollectionTransactions = monthlyOfficerPayments.filter(isDealerCollection);
  const reportPaymentTransactions = payments.filter((payment) => {
    if (filterMode === 'month' || filterMode === 'stock') {
      return String(payment.date || '').startsWith(selectedMonth);
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
    .filter((invoice) => !['dealer_return', 'factory_damage'].includes(invoice.invoiceType))
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
  const officerSalesInvoices = filteredInvoices.filter((invoice) => (
    !['dealer_return', 'factory_damage'].includes(invoice.invoiceType)
  ));
  const sessionSalesInvoices = filterMode === 'officer'
    ? invoices.filter((invoice) => (
      officerMatches(invoice)
      && (activeOfficerSession === 'ALL'
        || (invoice.session || LEGACY_INVOICE_SESSION) === activeOfficerSession)
      && !['dealer_return', 'factory_damage'].includes(invoice.invoiceType)
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
          size: item.size || '',
          unit: item.unit || 'পিস/বোতল',
          quantityUnit: getPackageQuantityUnit(item),
          cartons: 0,
          pieces: 0
        };
        summary.cartons += getItemCartons(item);
        summary.pieces += Number(item.totalPieces)
          || getItemCartons(item) * (Number(item.packPerBox) || 1);
        totals.set(key, summary);
      });
    });
    return [...totals.values()];
  };
  const officerMonthProducts = filterMode === 'officer' ? summarizeProducts(officerSalesInvoices) : [];
  const officerSessionProducts = summarizeProducts(sessionSalesInvoices);

  const monthEnd = selectedMonth ? new Date(`${selectedMonth}-01T00:00:00.000Z`) : new Date();
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const monthEndDate = monthEnd.toISOString().slice(0, 10);
  const stockReportRows = products.flatMap((product) => (product.variants || []).map((variant) => {
    const productKey = `${product.id}::${variant.sku}`;
    const packPerBox = Number(variant.packPerBox) || 1;
    const itemPieces = (item) => Number(item.totalPieces)
      || getItemCartons(item) * (Number(item.packPerBox) || packPerBox);
    const invoiceMovementPieces = (invoice) => {
      const direction = invoice.invoiceType === 'dealer_return' ? 1 : -1;
      const itemMovement = (invoice.items || [])
        .filter((item) => item.productId === product.id && item.sku === variant.sku)
        .reduce((sum, item) => sum + itemPieces(item) * direction, 0);
      const adjustedReturn = (invoice.returnAdjustments || [])
        .filter((item) => item.productId === product.id && item.sku === variant.sku)
        .reduce((sum, item) => sum + (Number(item.quantity ?? item.quantityPieces) || 0), 0);
      return itemMovement - adjustedReturn;
    };
    const periodInvoices = invoices.filter((invoice) => invoice.date?.startsWith(selectedMonth));
    const stockInsInRange = stockInLogs.filter((entry) => (
      entry.productId === product.id && entry.sku === variant.sku
      && entry.date >= `${selectedMonth}-01` && entry.date <= monthEndDate
    ));
    const stockInPieces = stockInsInRange.reduce(
      (sum, entry) => sum + (Number(entry.quantityPieces) || 0),
      0
    );
    const salesPieces = periodInvoices
      .filter((invoice) => !['dealer_return', 'factory_damage'].includes(invoice.invoiceType))
      .flatMap((invoice) => invoice.items || [])
      .filter((item) => item.productId === product.id && item.sku === variant.sku)
      .reduce((sum, item) => sum + itemPieces(item), 0);
    const dealerReturnPieces = periodInvoices
      .filter((invoice) => invoice.invoiceType === 'dealer_return')
      .flatMap((invoice) => invoice.items || [])
      .filter((item) => item.productId === product.id && item.sku === variant.sku)
      .reduce((sum, item) => sum + itemPieces(item), 0);
    const factoryReturnPieces = periodInvoices.reduce((sum, invoice) => {
      const damagedItems = invoice.invoiceType === 'factory_damage'
        ? (invoice.items || [])
          .filter((item) => item.productId === product.id && item.sku === variant.sku)
          .reduce((itemSum, item) => itemSum + itemPieces(item), 0)
        : 0;
      const adjustedReturns = (invoice.returnAdjustments || [])
        .filter((item) => item.productId === product.id && item.sku === variant.sku)
        .reduce((itemSum, item) => itemSum + (Number(item.quantity ?? item.quantityPieces) || 0), 0);
      return sum + damagedItems + adjustedReturns;
    }, 0);
    const futureStockInPieces = stockInLogs
      .filter((entry) => entry.productId === product.id && entry.sku === variant.sku && entry.date > monthEndDate)
      .reduce((sum, entry) => sum + (Number(entry.quantityPieces) || 0), 0);
    const futureInvoiceMovement = invoices
      .filter((invoice) => invoice.date > monthEndDate)
      .reduce((sum, invoice) => sum + invoiceMovementPieces(invoice), 0);
    const currentPieces = variant.stock == null
      ? (Number(variant.stockCartons) || 0) * packPerBox
      : Number(variant.stock) || 0;
    const closingPieces = currentPieces - futureStockInPieces - futureInvoiceMovement;
    const openingPieces = closingPieces - stockInPieces + salesPieces - dealerReturnPieces + factoryReturnPieces;
    return {
      key: productKey,
      productName: product.name,
      size: variant.size || '',
      openingCartons: openingPieces / packPerBox,
      stockInCartons: stockInPieces / packPerBox,
      dealerReturnCartons: dealerReturnPieces / packPerBox,
      totalStockCartons: (openingPieces + stockInPieces + dealerReturnPieces) / packPerBox,
      factoryReturnCartons: factoryReturnPieces / packPerBox,
      soldCartons: salesPieces / packPerBox,
      closingCartons: closingPieces / packPerBox
    };
  }));
  const formatStockCartons = (cartons) => toBn(Number(cartons.toFixed(2)));
  const positiveStockCartons = (cartons) => Math.max(0, Number(cartons) || 0);
  const stockReportTotals = stockReportRows.reduce((totals, row) => ({
    openingCartons: totals.openingCartons + positiveStockCartons(row.openingCartons),
    stockInCartons: totals.stockInCartons + positiveStockCartons(row.stockInCartons),
    dealerReturnCartons: totals.dealerReturnCartons + positiveStockCartons(row.dealerReturnCartons),
    totalStockCartons: totals.totalStockCartons + positiveStockCartons(row.totalStockCartons),
    factoryReturnCartons: totals.factoryReturnCartons + positiveStockCartons(row.factoryReturnCartons),
    soldCartons: totals.soldCartons + positiveStockCartons(row.soldCartons),
    closingCartons: totals.closingCartons + positiveStockCartons(row.closingCartons)
  }), {
    openingCartons: 0,
    stockInCartons: 0,
    dealerReturnCartons: 0,
    totalStockCartons: 0,
    factoryReturnCartons: 0,
    soldCartons: 0,
    closingCartons: 0
  });

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

        <button
          onClick={printReport}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition"
        >
          <Printer className="w-4 h-4" />
          <span>রিপোর্ট প্রিন্ট করুন</span>
        </button>
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
              <option value="month">মাসিক রিপোর্ট (Monthly)</option>
              <option value="year">বার্ষিক হিসাব (Yearly / Annual)</option>
              <option value="dealer">ডিলারভিত্তিক রিপোর্ট (By Dealer)</option>
              <option value="officer">অফিসারভিত্তিক রিপোর্ট (By Officer)</option>
                <option value="session">সেশনভিত্তিক রিপোর্ট</option>
                <option value="stock">মাসশেষ স্টক রিপোর্ট</option>
            </select>
          </label>
        </div>

        {/* Dynamic Controls based on selected mode */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center text-xs">
            {(filterMode === 'month' || filterMode === 'stock') && (
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
                  <div><span className="text-xs font-semibold text-slate-500">মাসের মোট কালেকশন / আয়</span><p className="mt-1 text-lg font-black text-emerald-800">৳{toBn(reportCollection)}</p></div>
                  <div><span className="text-xs font-semibold text-slate-500">মাসের মোট খরচ</span><p className="mt-1 text-lg font-black text-rose-700">৳{toBn(reportExpenses)}</p></div>
                  <div><span className="text-xs font-semibold text-slate-500">নিট নগদ প্রবাহ</span><p className="mt-1 text-lg font-black text-slate-900">৳{toBn(reportCollection - reportExpenses)}</p></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <h5 className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800">কোম্পানির মাসিক আয়-ব্যয়ের পোস্টিং</h5>
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
                      {!reportPaymentTransactions.length && <tr><td colSpan={6} className="p-3 text-center text-slate-500">এই মাসে কোনো পেমেন্ট বা খরচ পোস্টিং নেই।</td></tr>}
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
      <div className={`monthly-report-sheet ${filterMode === 'stock' ? 'monthly-report-stock-mode' : ''} bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6`}>
        <div className="monthly-report-print-header border-b-2 border-emerald-800 pb-4">
          <CompanyLetterhead className="monthly-report-letterhead" />
          <div className="mt-2 text-center">
            <div className="inline-block rounded bg-emerald-800 px-5 py-1 text-xs font-black uppercase tracking-wider text-white">
              {reportTitle}
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium text-center">{reportSubtitle}</p>
          {filterMode === 'stock' && (
            <div className="monthly-report-stock-officer-details ml-auto mt-3 grid max-w-xl grid-cols-2 gap-x-5 gap-y-1 text-right text-xs">
              <p><span className="font-bold">প্রস্তুতকারী:</span> {selectedStockOfficer?.name || '—'}</p>
              <p><span className="font-bold">পদবি:</span> {getBengaliDesignation(selectedStockOfficer?.designation || '—')}</p>
              <p><span className="font-bold">ঠিকানা / এলাকা:</span> {selectedStockOfficer?.territory || '—'}</p>
              <p><span className="font-bold">মোবাইল:</span> {selectedStockOfficer?.phone ? toBn(selectedStockOfficer.phone) : '—'}</p>
              <p><span className="font-bold">সেশন:</span> {stockReportSession ? toBn(stockReportSession) : '—'}</p>
            </div>
          )}
        </div>

        {/* Summary Metric Ribbon */}
        <div className={`monthly-report-summary grid grid-cols-2 ${filterMode === 'officer' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs`}>
          <div>
            <span className="text-slate-500 font-medium">মোট বিক্রিত কার্টুন:</span>
            <p className="text-base font-black text-emerald-800 font-mono">{totalCartonsSold} কার্টুন</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">মোট চালান মূল্য:</span>
            <p className="text-base font-black text-slate-900 font-mono">৳{totalSalesValue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500">বিক্রয় − ডিলার ফেরত</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">আদায়কৃত নগদ / চেক:</span>
            <p className="text-base font-black text-emerald-700 font-mono">৳{reportCollection.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">অবশিষ্ট বকেয়া / বাকি:</span>
            <p className="text-base font-black text-rose-700 font-mono">৳{totalDueOutstanding.toLocaleString()}</p>
          </div>
          {filterMode === 'officer' && (
            <div>
              <span className="text-slate-500 font-medium">মাসিক অফিসার খরচ:</span>
              <p className="text-base font-black text-rose-700 font-mono">৳{officerMonthlyExpenses.toLocaleString()}</p>
            </div>
          )}
        </div>

        {filterMode === 'officer' && (
          <section className="space-y-4">
            <h4 className="text-sm font-black text-slate-800">মাসিক সেলস অ্যাপ্রেইজাল: পণ্য ও সেশনভিত্তিক বিতরণ</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { title: `নির্বাচিত মাসে বিক্রিত পণ্য (${selectedOfficerMonth})`, rows: officerMonthProducts },
                { title: `নির্বাচিত সেশনে সরবরাহকৃত পণ্য (${activeOfficerSession === 'ALL' ? 'সব সেশন' : activeOfficerSession})`, rows: officerSessionProducts }
              ].map(({ title, rows }) => (
                <div key={title} className="overflow-x-auto rounded-lg border border-slate-200">
                  <h5 className="bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">{title}</h5>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr><th className="p-2">পণ্য</th><th className="p-2">প্যাক সাইজ</th><th className="p-2 text-right">প্যাক / কার্টুন</th><th className="p-2 text-right">মোট একক</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.key}>
                          <td className="p-2 font-semibold">{row.name}</td>
                          <td className="p-2">{row.size || '—'}</td>
                          <td className="p-2 text-right">{toBn(row.cartons)} {row.quantityUnit}</td>
                          <td className="p-2 text-right">{toBn(row.pieces)} {row.unit}</td>
                        </tr>
                      ))}
                      {!rows.length && <tr><td colSpan={4} className="p-3 text-center text-slate-500">এই ফিল্টারে পণ্য সরবরাহ নেই।</td></tr>}
                    </tbody>
                  </table>
                </div>
              ))}
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
            <div className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              রিপোর্টের সময়কাল: {toBnDate(`${selectedMonth}-01`)} থেকে {toBnDate(monthEndDate)} • প্যাকের অংশবিশেষ থাকলে দশমিক কার্টুনে দেখানো হবে।
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="monthly-report-stock-table w-full min-w-[1200px] text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr className="monthly-report-stock-month-row">
                    <th colSpan={9} className="p-2">মাসিক স্টক রিপোর্ট: {stockReportMonth}</th>
                  </tr>
                  <tr>
                    <th className="min-w-[240px] whitespace-nowrap p-2">পণ্যের নাম</th>
                    <th className="whitespace-nowrap p-2">প্যাক সাইজ</th>
                    <th className="p-2 text-right">ওপেনিং স্টক<br />(কার্টুন)</th>
                    <th className="p-2 text-right">স্টক ইন<br />(কার্টুন)</th>
                    <th className="p-2 text-right">ডিলার ফেরত<br />(কার্টুন)</th>
                    <th className="p-2 text-right">টোটাল স্টক<br />(কার্টুন)</th>
                    <th className="p-2 text-right">ফ্যাক্টরি ফেরত<br />(কার্টুন)</th>
                    <th className="p-2 text-right">সেলস<br />(কার্টুন)</th>
                    <th className="p-2 text-right">মাসের শেষে স্টক<br />(কার্টুন)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockReportRows.map((row) => (
                    <tr key={row.key}>
                      <td className="min-w-[240px] whitespace-nowrap p-2 font-semibold">{row.productName}</td>
                      <td className="whitespace-nowrap p-2">{row.size}</td>
                      <td className="p-2 text-right">{formatStockCartons(row.openingCartons)}</td>
                      <td className="p-2 text-right">{formatStockCartons(row.stockInCartons)}</td>
                      <td className="p-2 text-right">{formatStockCartons(row.dealerReturnCartons)}</td>
                      <td className="p-2 text-right font-semibold">{formatStockCartons(row.totalStockCartons)}</td>
                      <td className="p-2 text-right text-rose-700">{formatStockCartons(row.factoryReturnCartons)}</td>
                      <td className="p-2 text-right">{formatStockCartons(row.soldCartons)}</td>
                      <td className="p-2 text-right font-bold text-emerald-800">{formatStockCartons(row.closingCartons)}</td>
                    </tr>
                  ))}
                  {!stockReportRows.length && <tr><td colSpan={9} className="p-5 text-center text-slate-500">পণ্যের কোনো তথ্য পাওয়া যায়নি।</td></tr>}
                </tbody>
                <tfoot className="monthly-report-stock-total bg-slate-100 font-bold">
                  <tr>
                    <th colSpan={2} className="p-2 text-left">সর্বমোট</th>
                    <td className="p-2 text-right">{formatStockCartons(stockReportTotals.openingCartons)}</td>
                    <td className="p-2 text-right">{formatStockCartons(stockReportTotals.stockInCartons)}</td>
                    <td className="p-2 text-right">{formatStockCartons(stockReportTotals.dealerReturnCartons)}</td>
                    <td className="p-2 text-right">{formatStockCartons(stockReportTotals.totalStockCartons)}</td>
                    <td className="p-2 text-right">{formatStockCartons(stockReportTotals.factoryReturnCartons)}</td>
                    <td className="p-2 text-right">{formatStockCartons(stockReportTotals.soldCartons)}</td>
                    <td className="p-2 text-right">{formatStockCartons(stockReportTotals.closingCartons)}</td>
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
                    <td className="p-2 text-center font-bold text-emerald-800 font-mono">{getInvoiceCartons(inv)}</td>
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

        {/* Signatures for Print */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold">প্রস্তুতকারী (ডাটা এন্ট্রি)</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold">একাউন্টস বিভাগ, নিশিন্দারা বগুড়া</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold">ব্যবস্থাপনা পরিচালক / জিএম</div>
          </div>
        </div>
      </div>
    </div>
  );
}
