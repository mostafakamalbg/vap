import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Send, ShoppingCart, Target, TrendingUp } from 'lucide-react';
import { useAgro } from '../context/AgroContext';
import { useUiPreferences } from '../context/UiPreferencesContext';
import {
  formatDealerCode,
  formatOfficerCode,
  isDealerAssignedToOfficer,
  normalizeOfficerCode
} from '../../shared/codes';
import { getPackageQuantityUnit } from '../../shared/quantityUnits';
import { getInvoicePackageCount, getItemPackageCount } from '../../shared/invoiceCartons';
import {
  sortSessionsNewestFirst
} from '../../shared/sessions';
import { getOfficerSalesTarget, OFFICER_TARGET_SESSIONS } from '../../shared/officerSalesTargets';
import { calculateOfficerFinancials, filterOfficerRecordsByPeriod } from '../../shared/officerFinancials';
import { getOfficerPreviousDueByDealer } from '../../shared/officerLedger';
import { getInvoiceSalesAmount } from '../../shared/invoiceTotals';
import { isDealerBalanceCredit } from '../../shared/paymentMethods';
import {
  buildMonthlySalesReports,
  getMonthlySalesReportKey
} from '../../shared/salesReports';
import { sortProductItemsByInventory } from '../../shared/productSorting';
import { readJsonResponse } from '../utils/api';
import OfficerPaymentSubmission from './OfficerPaymentSubmission';
import { isSalesOfficerRole } from '../../shared/roles';

async function requestJson(url, options) {
  return readJsonResponse(await fetch(url, { cache: 'no-store', ...options }));
}

function printDashboardSection(sectionId) {
  const section = document.querySelector(`[data-dashboard-print="${sectionId}"]`);
  if (!section) return;
  const printable = section.cloneNode(true);
  printable.classList.add('officer-dashboard-print', 'dashboard-section-print');
  printable.querySelectorAll('.no-print').forEach((element) => element.remove());
  document.body.appendChild(printable);
  document.body.classList.add('dashboard-section-printing');
  const cleanup = () => {
    printable.remove();
    document.body.classList.remove('dashboard-section-printing');
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1000);
}

export default function OfficerDashboard() {
  const { currentUser, invoices, allProductVariants, dealers, officers, products } = useAgro();
  const { t, language } = useUiPreferences();
  const currentOfficer = officers.find((entry) => (
    (currentUser?.officerId
      && [entry.id, entry.officerId].some((id) => String(id || '') === String(currentUser.officerId)))
    || (currentUser?.officerCode
      && normalizeOfficerCode(entry.code, entry.designation)
        === normalizeOfficerCode(currentUser.officerCode, entry.designation))
    || (currentUser?.name && entry.name === currentUser.name)
  )) || null;
  const officerCode = normalizeOfficerCode(currentUser?.officerCode, currentOfficer?.designation);
  const [orders, setOrders] = useState([]);
  const [salesOfficerSummaries, setSalesOfficerSummaries] = useState([]);
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [periodInvoices, setPeriodInvoices] = useState([]);
  const [periodPayments, setPeriodPayments] = useState([]);
  const [officerLedgerDealers, setOfficerLedgerDealers] = useState(null);
  const [items, setItems] = useState([{ productId: '', sku: '', cartons: 1 }]);
  const [dealerId, setDealerId] = useState(dealers[0]?.id || '');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const salesOfficerSummary = salesOfficerSummaries.find((entry) => (
    (currentOfficer?.id && entry.officerId === currentOfficer.id)
    || (officerCode && normalizeOfficerCode(entry.officerCode, currentOfficer?.designation) === officerCode)
    || (currentUser?.name && entry.officerName === currentUser.name)
  )) || null;

  useEffect(() => {
    let cancelled = false;
    requestJson('/api/orders')
      .then((data) => { if (!cancelled) setOrders(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    const query = new URLSearchParams();
    if (sessionFilter !== 'ALL') query.set('session', sessionFilter);
    if (monthFilter !== 'ALL') query.set('month', monthFilter);
    requestJson(`/api/sales-officers?${query}`)
      .then((data) => { if (!cancelled) setSalesOfficerSummaries(Array.isArray(data) ? data : []); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [monthFilter, sessionFilter]);

  const reportOfficers = useMemo(() => {
    if (!isSalesOfficerRole(currentUser?.role)) return officers;
    return [currentOfficer || {
      id: currentUser?.officerId || '',
      officerId: currentUser?.officerId || '',
      code: officerCode,
      officerCode,
      name: currentUser?.name || '',
      officerName: currentUser?.name || ''
    }];
  }, [currentOfficer, currentUser?.name, currentUser?.officerId, currentUser?.role, officerCode, officers]);
  const generatedMonthlyReports = useMemo(() => buildMonthlySalesReports({
    invoices: periodInvoices,
    payments: periodPayments,
    dealers: officerLedgerDealers || dealers,
    officers: reportOfficers,
    monthFilter,
    sessionFilter
  }), [
    dealers,
    monthFilter,
    officerLedgerDealers,
    periodInvoices,
    periodPayments,
    reportOfficers,
    sessionFilter
  ]);
  const dashboardMonthlyReports = useMemo(() => {
    const generatedKeys = new Set(generatedMonthlyReports.map(getMonthlySalesReportKey));
    return [
      ...generatedMonthlyReports,
      ...monthlyReports.filter((report) => (
        !generatedKeys.has(getMonthlySalesReportKey(report))
      ))
    ];
  }, [generatedMonthlyReports, monthlyReports]);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (sessionFilter !== 'ALL') query.set('session', sessionFilter);
    if (monthFilter !== 'ALL') query.set('month', monthFilter);
    requestJson(`/api/reports?${query}`)
      .then((data) => { if (!cancelled) setMonthlyReports(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [monthFilter, sessionFilter]);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (sessionFilter !== 'ALL') query.set('session', sessionFilter);
    if (monthFilter !== 'ALL') query.set('month', monthFilter);
    setPeriodInvoices([]);
    setPeriodPayments([]);
    const loadPeriodRecords = () => Promise.all([
      requestJson(`/api/invoices?${query}`),
      requestJson(`/api/records?type=payments&${query}`),
      requestJson('/api/records?type=dealers')
    ]).then(([invoiceRecords, paymentRecords, dealerRecords]) => {
      if (cancelled) return;
      setPeriodInvoices(Array.isArray(invoiceRecords) ? invoiceRecords : []);
      setPeriodPayments(Array.isArray(paymentRecords) ? paymentRecords : []);
      setOfficerLedgerDealers(Array.isArray(dealerRecords) ? dealerRecords : []);
      setError('');
    }).catch((requestError) => {
      if (cancelled) return;
      setPeriodInvoices([]);
      setPeriodPayments([]);
      setError(requestError.message);
    });
    loadPeriodRecords();
    const intervalId = window.setInterval(loadPeriodRecords, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [monthFilter, sessionFilter]);

  const isOfficerInvoice = useCallback((invoice) => (
    (currentUser?.officerId && invoice.officerId === currentUser.officerId)
    || (officerCode
      && normalizeOfficerCode(invoice.officerCode, currentOfficer?.designation) === officerCode)
  ), [currentUser?.officerId, currentOfficer?.designation, officerCode]);
  const salesInvoices = useMemo(
    () => invoices.filter((invoice) => (
      !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
      && isOfficerInvoice(invoice)
    )),
    [invoices, isOfficerInvoice]
  );
  const returnInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.invoiceType === 'dealer_return' && isOfficerInvoice(invoice)),
    [invoices, isOfficerInvoice]
  );
  const availableDealers = useMemo(() => {
    return dealers.filter((dealer) => isDealerAssignedToOfficer(
      dealer,
      officerCode,
      currentOfficer?.designation
    ));
  }, [currentOfficer?.designation, dealers, officerCode]);
  useEffect(() => {
    if (!availableDealers.some((dealer) => dealer.id === dealerId)) {
      setDealerId(availableDealers[0]?.id || '');
    }
  }, [availableDealers, dealerId]);
  const sessions = useMemo(
    () => sortSessionsNewestFirst([
      ...OFFICER_TARGET_SESSIONS,
      ...salesInvoices.map((invoice) => invoice.session).filter(Boolean),
      ...dashboardMonthlyReports.map((report) => report.session).filter(Boolean)
    ]),
    [dashboardMonthlyReports, salesInvoices]
  );
  const months = useMemo(
    () => [...new Set([
      ...salesInvoices.map((invoice) => String(invoice.date || '').slice(0, 7)),
      ...dashboardMonthlyReports.map((report) => String(report.reportingDate || '').slice(0, 7))
    ].filter((month) => /^\d{4}-\d{2}$/.test(month) && month >= '2025-07'))].sort().reverse(),
    [dashboardMonthlyReports, salesInvoices]
  );
  const filteredSalesInvoices = periodInvoices.filter((invoice) => (
    !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  ));
  const targetSalesInvoices = periodInvoices.filter((invoice) => (
    !['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  ));
  const sessionSalesTarget = getOfficerSalesTarget({
    ...currentOfficer,
    ...(salesOfficerSummary || {}),
    code: currentOfficer?.code || currentUser?.officerCode
  }, sessionFilter);
  const targetJulyDec2026 = getOfficerSalesTarget({
    ...currentOfficer,
    ...(salesOfficerSummary || {}),
    code: currentOfficer?.code || currentUser?.officerCode
  }, 'জুলাই - ডিসেম্বর 2026');
  const targetJanJune2027 = getOfficerSalesTarget({
    ...currentOfficer,
    ...(salesOfficerSummary || {}),
    code: currentOfficer?.code || currentUser?.officerCode
  }, 'জানুয়ারি - জুন 2027');
  const yearlyTarget = targetJanJune2027 + targetJulyDec2026;
  const targetProgressForSession = (session) => filterOfficerRecordsByPeriod(
    targetSalesInvoices,
    { session }
  ).reduce((sum, invoice) => sum + (invoice.invoiceType === 'dealer_return'
    ? -getInvoiceSalesAmount(invoice)
    : getInvoiceSalesAmount(invoice)), 0);
  const salesJulyDec2026 = targetProgressForSession('জুলাই - ডিসেম্বর 2026');
  const salesJanJune2027 = targetProgressForSession('জানুয়ারি - জুন 2027');
  const yearlySalesAmount = salesJulyDec2026 + salesJanJune2027;
  const julyDecAchievement = targetJulyDec2026
    ? Math.round(salesJulyDec2026 / targetJulyDec2026 * 100)
    : 0;
  const janJuneAchievement = targetJanJune2027
    ? Math.round(salesJanJune2027 / targetJanJune2027 * 100)
    : 0;
  const yearlyAchievement = yearlyTarget
    ? Math.round(yearlySalesAmount / yearlyTarget * 100)
    : 0;
  const latestMonthlyReport = dashboardMonthlyReports.reduce((latest, report) => (
    !latest || String(report.reportingDate || '') > String(latest.reportingDate || '')
      ? report
      : latest
  ), null);
  const latestReportOpeningDue = (latestMonthlyReport?.parties || []).reduce(
    (sum, party) => sum + (Number(party.lastMonthDues) || 0),
    0
  );
  const ledgerDealers = officerLedgerDealers ?? availableDealers;
  const officerLedgerIdentity = {
    officerIds: [currentUser?.officerId, currentOfficer?.id],
    officerCode,
    designation: currentOfficer?.designation
  };
  const officerPreviousDues = useMemo(() => getOfficerPreviousDueByDealer(
    ledgerDealers,
    officerLedgerIdentity,
    {
      session: sessionFilter,
      month: monthFilter,
      openingBalance: sessionFilter === 'ALL' && monthFilter === 'ALL'
    }
  ), [
    ledgerDealers,
    sessionFilter,
    monthFilter,
    currentUser?.officerId,
    currentOfficer?.id,
    currentOfficer?.designation,
    officerCode
  ]);
  const previousDueTotal = [...officerPreviousDues.values()].reduce(
    (sum, due) => sum + due.amount,
    0
  );
  const financeSummary = calculateOfficerFinancials({
    invoices: periodInvoices,
    payments: periodPayments,
    salesTarget: sessionSalesTarget,
    lastSessionDue: officerPreviousDues.size
      ? previousDueTotal
      : latestMonthlyReport
        ? latestReportOpeningDue
        : monthFilter === 'ALL' ? currentOfficer?.lastSessionDue : 0
  });
  const officerProductSales = useMemo(() => {
    const sales = new Map();
    const productCodes = new Map(products.map((product) => [
      String(product.id || ''),
      String(product.productCode || product.code || product.id || '')
    ]));
    filteredSalesInvoices.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        const key = `${item.productId}::${item.sku}`;
        const sale = sales.get(key) || {
          key,
          productId: item.productId,
          sku: item.sku,
          productCode: productCodes.get(String(item.productId || '')) || '',
          productName: item.productName || 'পণ্য',
          size: item.size || '',
          unit: item.unit || 'পিস/বোতল',
          quantityUnit: getPackageQuantityUnit(item),
          cartons: 0,
          pieces: 0,
          amount: 0
        };
        const cartons = getItemPackageCount(item);
        const pieces = item.totalPieces != null
          ? Number(item.totalPieces) || 0
          : cartons * (Number(item.packPerBox) || 1);
        const tradePrice = Number(item.total) || cartons * (Number(item.cartonPrice) || 0);
        sale.cartons += cartons;
        sale.pieces += pieces;
        sale.amount += tradePrice * (1 - (Number(item.commission) || 0) / 100);
        sales.set(key, sale);
      });
    });
    return sortProductItemsByInventory([...sales.values()], products);
  }, [filteredSalesInvoices, products]);
  const visibleInvoices = periodInvoices.filter((invoice) => (
    !['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  ));
  const officerDealerLedgers = useMemo(() => {
    const reportDueByName = new Map();
    dashboardMonthlyReports.forEach((report) => (report.parties || []).forEach((party) => {
      const key = String(party.nameOfTheParty || '').trim().toLowerCase();
      const current = reportDueByName.get(key);
      if (key && (!current || String(report.reportingDate || '') > current.reportingDate)) {
        reportDueByName.set(key, {
          reportingDate: String(report.reportingDate || ''),
          session: String(report.session || ''),
          amount: Number(party.lastMonthDues) || 0
        });
      }
    }));
    const ledgers = new Map(ledgerDealers.map((dealer) => {
      const dealerId = String(dealer.id);
      const previousDue = officerPreviousDues.get(dealerId);
      const reportDue = reportDueByName.get(String(dealer.shopName || '').trim().toLowerCase());
      const openingDue = previousDue || (reportDue
        ? { amount: reportDue.amount, date: reportDue.reportingDate, session: reportDue.session }
        : null);
      return [dealerId, {
        dealerId: dealer.id,
        dealerName: dealer.shopName || dealer.id,
        lastSessionDue: openingDue?.amount ?? 0,
        lastSessionDueDate: openingDue?.date || '',
        lastSessionDueSession: openingDue?.session || '',
        sales: 0,
        returns: 0,
        invoiceReceived: 0,
        collection: 0
      }];
    }));
    const dealerAliases = new Map();
    ledgerDealers.forEach((dealer) => {
      [dealer.id, dealer.code, dealer.shopName].forEach((value) => {
        const key = String(value || '').trim().toLowerCase();
        if (key && !dealerAliases.has(key)) dealerAliases.set(key, String(dealer.id));
      });
    });
    const getLedger = (record) => {
      const key = [record.dealerId, record.dealerCode, record.dealerName]
        .map((value) => dealerAliases.get(String(value || '').trim().toLowerCase()))
        .find(Boolean) || record.dealerId || record.dealerCode || record.dealerName || '';
      if (!key) return null;
      if (!ledgers.has(key)) {
        ledgers.set(key, {
          dealerId: record.dealerId || key,
          dealerName: record.dealerName || key,
          lastSessionDue: 0,
          sales: 0,
          returns: 0,
          invoiceReceived: 0,
          collection: 0
        });
      }
      return ledgers.get(String(key));
    };

    periodInvoices.forEach((invoice) => {
      if (['factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)) return;
      const ledger = getLedger(invoice);
      if (!ledger) return;
      const amount = Math.abs(getInvoiceSalesAmount(invoice));
      if (invoice.invoiceType === 'dealer_return') ledger.returns += amount;
      else {
        ledger.sales += amount;
        ledger.invoiceReceived += Number(invoice.paidAmount) || 0;
      }
    });
    periodPayments.forEach((payment) => {
      if (payment.sourceInvoiceId || /(?:invoice|চালান)\s*#/i.test(String(payment.reference || ''))) return;
      if (!isDealerBalanceCredit(payment)) return;
      const ledger = getLedger(payment);
      if (ledger) ledger.collection += Number(payment.amount) || 0;
    });

    return [...ledgers.values()].map((ledger) => ({
      ...ledger,
      received: ledger.invoiceReceived + ledger.collection,
      due: ledger.lastSessionDue + ledger.sales - ledger.returns
        - ledger.invoiceReceived - ledger.collection
    })).sort((left, right) => left.dealerName.localeCompare(right.dealerName));
  }, [
    ledgerDealers,
    officerPreviousDues,
    monthFilter,
    dashboardMonthlyReports,
    periodInvoices,
    periodPayments,
    sessionFilter,
    currentOfficer?.id,
    currentOfficer?.designation,
    currentUser?.officerId,
    officerCode
  ]);
  const dealerLedgerTotals = officerDealerLedgers.reduce((totals, ledger) => ({
    lastSessionDue: totals.lastSessionDue + ledger.lastSessionDue,
    sales: totals.sales + ledger.sales,
    returns: totals.returns + ledger.returns,
    received: totals.received + ledger.received,
    due: totals.due + ledger.due
  }), { lastSessionDue: 0, sales: 0, returns: 0, received: 0, due: 0 });
  const salesHistoryPreviousDues = sessionFilter === 'ALL'
    ? [...officerPreviousDues.entries()].map(([id, due]) => ({
      id,
      dealerName: ledgerDealers.find((dealer) => String(dealer.id) === id)?.shopName || id,
      ...due
    }))
    : [];
  const salesHistoryTotals = visibleInvoices.reduce((totals, invoice) => {
    const amount = getInvoiceSalesAmount(invoice);
    const cartons = getInvoicePackageCount(invoice);
    if (invoice.invoiceType === 'dealer_return') {
      totals.cartons -= cartons;
      totals.sales -= amount;
      return totals;
    }
    totals.cartons += cartons;
    totals.sales += amount;
    totals.due += Math.max(0, amount - (Number(invoice.paidAmount) || 0));
    return totals;
  }, { cartons: 0, sales: 0, due: 0 });
  salesHistoryTotals.previousDue = previousDueTotal;
  salesHistoryTotals.due += previousDueTotal;
  const productSalesTotals = officerProductSales.reduce((totals, item) => ({
    cartons: totals.cartons + item.cartons,
    units: totals.units + item.pieces,
    amount: totals.amount + item.amount
  }), { cartons: 0, units: 0, amount: 0 });
  const officerOrders = orders.filter((order) => order.officerId === currentUser?.officerId);
  const getVariantShortage = (variant) => {
    const orderedCartons = items
      .filter((item) => item.productId === variant.productId && item.sku === variant.sku)
      .reduce((sum, item) => sum + (Number(item.cartons) || 0), 0);
    return Math.max(0, orderedCartons - (Number(variant.stockCartons) || 0));
  };

  const updateItem = (index, field, value) => {
    setItems((previous) => previous.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const savedOrder = await requestJson('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, note, dealerId })
      });
      setOrders((previous) => [savedOrder, ...previous]);
      setItems([{ productId: '', sku: '', cartons: 1 }]);
      setDealerId(availableDealers[0]?.id || '');
      setNote('');
      setMessage(`${t('officer.orderSubmitted')} • ইনভয়েস নং ${savedOrder.invoiceNo}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  const formatMoney = (value) => `৳${Math.round(Number(value) || 0).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}`;
  const targetSummaryCards = [
    { label: 'জুলাই–ডিসেম্বর 2026 টার্গেট ও অর্জন', value: formatMoney(targetJulyDec2026), detail: `অর্জন ${formatMoney(salesJulyDec2026)} • ${julyDecAchievement}%`, Icon: Target },
    { label: 'জানুয়ারি–জুন 2027 টার্গেট ও অর্জন', value: formatMoney(targetJanJune2027), detail: `অর্জন ${formatMoney(salesJanJune2027)} • ${janJuneAchievement}%`, Icon: Target },
    { label: 'টোটাল বার্ষিক টার্গেট ও অর্জন', value: formatMoney(yearlyTarget), detail: `অর্জন ${formatMoney(yearlySalesAmount)} • ${yearlyAchievement}%`, Icon: Target }
  ];
  const transactionSummaryCards = [
    { label: 'মোট বিক্রয় চালান', value: filteredSalesInvoices.length.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US'), Icon: ClipboardList },
    { label: 'মোট বিক্রয় মূল্য', value: formatMoney(financeSummary.salesAmount), Icon: TrendingUp },
    { label: 'মোট ফেরত মূল্য', value: formatMoney(financeSummary.returnAmount), Icon: TrendingUp },
    { label: 'মোট নিট বিক্রয়', value: formatMoney(financeSummary.totalNetSales), Icon: TrendingUp },
    { label: 'মোট পাওনা', value: formatMoney(financeSummary.totalAmountDues), Icon: TrendingUp }
  ];
  const expenseSummaryCards = [
    { label: 'মোট খরচ', value: formatMoney(financeSummary.totalExpenses), Icon: TrendingUp },
    { label: 'অফিস পেমেন্ট', value: formatMoney(financeSummary.paymentAndExpense.officePayment), Icon: TrendingUp },
    { label: 'ভাড়া / Fare', value: formatMoney(financeSummary.paymentAndExpense.fare), Icon: TrendingUp },
    { label: 'বেতন / Salary', value: formatMoney(financeSummary.paymentAndExpense.salary), Icon: TrendingUp },
    { label: 'L/C খরচ', value: formatMoney(financeSummary.paymentAndExpense.lc), Icon: TrendingUp }
  ];
  const paymentSummaryCards = [
    { label: 'মোট পেমেন্ট অর্জন', value: formatMoney(financeSummary.totalReceivedAmount), Icon: TrendingUp },
    { label: 'মোট পেমেন্ট পার্সেন্টেজ', value: `${financeSummary.paymentPercentage}%`, Icon: Target }
  ];
  const renderSummaryCards = (cards) => cards.map(({ label, value, detail, Icon }) => (
    <div key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-xl font-black text-slate-900">{value}</p>
        {detail && <p className="text-[11px] font-semibold text-emerald-700">{detail}</p>}
      </div>
    </div>
  ));

  return (
    <div className="officer-dashboard-print mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-700 p-6 text-white shadow-lg sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">{t('officer.dashboard')}</p>
          <h1 className="mt-1 text-2xl font-black">{t('officer.welcome')} {currentUser?.name}</h1>
          <p className="mt-1 text-sm text-emerald-100">{t('officer.code')} {formatOfficerCode(currentUser?.officerCode) || '—'} • {t('officer.onlineSales')}</p>
        </div>
        <button type="button" onClick={() => window.print()} className="no-print rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
          প্রিন্ট
        </button>
      </header>

      <section className="space-y-5">
        <div><h2 className="mb-2 text-sm font-black text-slate-800">টার্গেট সারাংশ</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{renderSummaryCards(targetSummaryCards)}</div></div>
        <div><h2 className="mb-2 text-sm font-black text-slate-800">লেনদেন সারাংশ</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{renderSummaryCards(transactionSummaryCards)}</div></div>
        <div><h2 className="mb-2 text-sm font-black text-slate-800">খরচের বিবরণ</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{renderSummaryCards(expenseSummaryCards)}</div></div>
        <div><h2 className="mb-2 text-sm font-black text-slate-800">পেমেন্ট সারাংশ</h2><div className="grid gap-4 sm:grid-cols-2">{renderSummaryCards(paymentSummaryCards)}</div></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div data-dashboard-print="sales-history" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-black text-slate-900">{t('officer.salesSummary')}</h2>
                  <p className="text-xs text-slate-500">{t('officer.approvedInvoices')}</p>
                </div>
                <button type="button" onClick={() => printDashboardSection('sales-history')} className="no-print inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">প্রিন্ট</button>
              </div>
              <div className="no-print mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  সেশন
                  <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="ALL">সকল সেশন</option>
                    {sessions.map((session) => <option key={session} value={session}>{session}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  মাস
                  <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="ALL">সকল মাস</option>
                    {months.map((month) => <option key={month} value={month}>{new Date(`${month}-01T00:00:00`).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3">{t('officer.invoice')}</th><th className="px-4 py-3">{t('officer.date')} / সেশন</th><th className="px-4 py-3">{t('officer.dealer')}</th><th className="px-4 py-3 text-right">কার্টুন</th><th className="px-4 py-3 text-right">{t('officer.sales')}</th><th className="px-4 py-3 text-right">বকেয়া</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {salesHistoryPreviousDues.map((entry) => (
                    <tr key={`previous-due-${entry.id}`} className="bg-amber-50">
                      <td className="px-4 py-3 font-bold text-amber-900">পূর্বের বাকি</td>
                      <td className="px-4 py-3">
                        {entry.date || '—'}
                        <p className="text-[10px] text-slate-500">{entry.session || 'ঐতিহাসিক বাকি'}</p>
                      </td>
                      <td className="px-4 py-3">{entry.dealerName}</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-900">{formatMoney(entry.amount)}</td>
                    </tr>
                  ))}
                  {visibleInvoices.map((invoice) => {
                    const isReturn = invoice.invoiceType === 'dealer_return';
                    const salesAmount = getInvoiceSalesAmount(invoice);
                    return (
                    <tr key={invoice.id} className={isReturn ? 'bg-rose-50' : ''}>
                      <td className="px-4 py-3 font-bold text-emerald-800">{invoice.id}</td>
                      <td className="px-4 py-3">{invoice.date}<p className="text-[10px] text-slate-500">{invoice.session}</p>{isReturn && <span className="text-[10px] font-bold text-rose-700">পণ্য ফেরত</span>}</td>
                      <td className="px-4 py-3">{invoice.dealerName || '—'}</td>
                      <td className="px-4 py-3 text-right">{getInvoicePackageCount(invoice).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')} প্যাক</td>
                      <td className={`px-4 py-3 text-right font-bold ${isReturn ? 'text-rose-700' : ''}`}>{isReturn ? '− ' : ''}৳{salesAmount.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-700">৳{isReturn ? '0' : Math.max(0, salesAmount - (Number(invoice.paidAmount) || 0)).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    </tr>
                  );})}
                  {!visibleInvoices.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">{t('officer.noInvoices')}</td></tr>}
                  <tr className="bg-emerald-50 font-black text-slate-900">
                    <td colSpan="3" className="px-4 py-2 text-right">মোট</td>
                    <td className="px-4 py-2 text-right">{Math.round(salesHistoryTotals.cartons).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-4 py-2 text-right">৳{Math.round(salesHistoryTotals.sales).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-4 py-2 text-right">৳{Math.round(salesHistoryTotals.due).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div data-dashboard-print="dealer-ledger" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-black text-slate-900">ফিল্টার করা ডিলার লেজার</h2>
                <p className="text-xs text-slate-500">নির্বাচিত সেশন/মাসের ইনভয়েস, পণ্য ফেরত ও কালেকশন</p>
              </div>
              <button type="button" onClick={() => printDashboardSection('dealer-ledger')} className="no-print inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">প্রিন্ট</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-emerald-900 text-white"><tr>
                  <th className="px-3 py-2">ডিলারের নাম</th>
                  <th className="px-3 py-2 text-right">পূর্বের বাকি / Last Session Due</th>
                  <th className="px-3 py-2 text-right">পণ্য বিক্রি</th>
                  <th className="px-3 py-2 text-right">পণ্য ফেরত</th>
                  <th className="px-3 py-2 text-right">মোট আদায়</th>
                  <th className="px-3 py-2 text-right">নিট বকেয়া</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {officerDealerLedgers.map((ledger) => (
                    <tr key={ledger.dealerId}>
                      <td className="px-3 py-2 font-semibold">{ledger.dealerName}</td>
                      <td className="px-3 py-2 text-right">৳{Math.round(ledger.lastSessionDue).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                        {(ledger.lastSessionDueDate || ledger.lastSessionDueSession) && <span className="block text-[10px] font-normal text-slate-500">{ledger.lastSessionDueDate || ledger.lastSessionDueSession}{ledger.lastSessionDueDate && ledger.lastSessionDueSession ? ` • ${ledger.lastSessionDueSession}` : ''}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">৳{Math.round(ledger.sales).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      <td className="px-3 py-2 text-right text-rose-700">৳{Math.round(ledger.returns).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      <td className="px-3 py-2 text-right text-emerald-800">৳{Math.round(ledger.received).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      <td className="px-3 py-2 text-right font-bold text-rose-700">৳{Math.round(ledger.due).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    </tr>
                  ))}
                  {!officerDealerLedgers.length && <tr><td colSpan="6" className="px-3 py-6 text-center text-slate-500">এই সময়সীমায় কোনো ডিলার হিসাব নেই।</td></tr>}
                  <tr className="bg-emerald-50 font-black">
                    <td className="px-3 py-2">মোট</td>
                    <td className="px-3 py-2 text-right">৳{Math.round(dealerLedgerTotals.lastSessionDue).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-3 py-2 text-right">৳{Math.round(dealerLedgerTotals.sales).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-3 py-2 text-right">৳{Math.round(dealerLedgerTotals.returns).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-3 py-2 text-right">৳{Math.round(dealerLedgerTotals.received).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-3 py-2 text-right">৳{Math.round(dealerLedgerTotals.due).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div data-dashboard-print="monthly-summary" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-black text-slate-900">ফিল্টার করা মাসিক রিপোর্টের সারাংশ</h2>
                <p className="text-xs text-slate-500">নির্বাচিত মাস/সেশনের সেভড ও স্বয়ংক্রিয় রিপোর্ট</p>
              </div>
              <button type="button" onClick={() => printDashboardSection('monthly-summary')} className="no-print inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">প্রিন্ট</button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['ইনভয়েস', visibleInvoices.length],
                ['সেলস', financeSummary.salesAmount],
                ['রিটার্ন', financeSummary.returnAmount],
                ['নিট সেলস', financeSummary.totalNetSales],
                ['বকেয়া', financeSummary.totalAmountDues],
                ['মোট খরচ', financeSummary.totalExpenses],
                ['অফিস পেমেন্ট', financeSummary.paymentAndExpense.officePayment],
                ['বেতন', financeSummary.paymentAndExpense.salary],
                ['ভাড়া / Fare', financeSummary.paymentAndExpense.fare],
                ['L/C খরচ', financeSummary.paymentAndExpense.lc],
                ['মোট পেমেন্ট অর্জন', financeSummary.totalReceivedAmount],
                ['মোট পেমেন্ট পার্সেন্টেজ', `${financeSummary.paymentPercentage}%`]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 font-black text-slate-900">{label === 'ইনভয়েস' || label === 'মোট পেমেন্ট পার্সেন্টেজ' ? value : `৳${Math.round(Number(value) || 0).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}`}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3">রিপোর্ট</th><th className="px-4 py-3">সেশন</th><th className="px-4 py-3 text-right">পার্টি</th><th className="px-4 py-3 text-right">রিটার্ন বাদে নিট বিক্রয়</th><th className="px-4 py-3 text-right">নিট বকেয়া</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardMonthlyReports.map((report) => {
                    const netSales = (report.parties || []).reduce((sum, party) => sum + (Number(party.presentMonth?.netSales) || 0), 0);
                    const dues = (report.parties || []).reduce((sum, party) => sum + (Number(party.presentMonthNetDues) || 0), 0);
                    return (
                      <tr key={report._id || report.autoKey}>
                        <td className="px-4 py-3 font-semibold">{report.monthOfReport}<p className="text-[10px] text-slate-500">{report.reportingDate}</p></td>
                        <td className="px-4 py-3">{report.session}</td>
                        <td className="px-4 py-3 text-right">{report.parties?.length || 0}</td>
                        <td className="px-4 py-3 text-right font-bold">৳{Math.round(netSales).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                        <td className="px-4 py-3 text-right">৳{Math.round(dues).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-emerald-50 font-black">
                    <td className="px-4 py-3">মোট</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-right">{dashboardMonthlyReports.reduce((sum, report) => sum + (report.parties?.length || 0), 0)}</td>
                    <td className="px-4 py-3 text-right">৳{Math.round(dashboardMonthlyReports.reduce((sum, report) => sum + (report.parties || []).reduce((partySum, party) => partySum + (Number(party.presentMonth?.netSales) || 0), 0), 0)).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-4 py-3 text-right">৳{Math.round(dashboardMonthlyReports.reduce((sum, report) => sum + (report.parties || []).reduce((partySum, party) => partySum + (Number(party.presentMonthNetDues) || 0), 0), 0)).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                  </tr>
                  {!dashboardMonthlyReports.length && <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-500">এই সেশন/মাসে কোনো রিপোর্ট নেই।</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div data-dashboard-print="sold-products" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-black text-slate-900">{t('officer.productsSold')}</h2>
                <p className="text-xs text-slate-500">{t('officer.productCartonSummary')}</p>
              </div>
              <button type="button" onClick={() => printDashboardSection('sold-products')} className="no-print inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">প্রিন্ট</button>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3">প্রোডাক্ট কোড</th><th className="px-4 py-3">{t('officer.product')}</th><th className="px-4 py-3">{t('officer.packSize')}</th><th className="px-4 py-3 text-right">প্যাক / কার্টুন</th><th className="px-4 py-3 text-right">মোট একক</th><th className="px-4 py-3 text-right">বিক্রয় মূল্য</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {officerProductSales.map((item) => (
                    <tr key={item.key}>
                      <td className="px-4 py-2.5 font-bold">{item.productCode || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold">{item.productName}</td>
                      <td className="px-4 py-2.5">{item.size}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{Math.round(item.cartons).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')} {item.quantityUnit}</td>
                      <td className="px-4 py-2.5 text-right">{Math.round(item.pieces).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')} {item.unit}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">৳{Math.round(item.amount).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    </tr>
                  ))}
                  {!officerProductSales.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">{t('officer.noProductSales')}</td></tr>}
                  <tr className="bg-emerald-50 font-black">
                    <td colSpan="3" className="px-4 py-2">মোট</td>
                    <td className="px-4 py-2 text-right">{Math.round(productSalesTotals.cartons).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-4 py-2 text-right">{Math.round(productSalesTotals.units).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    <td className="px-4 py-2 text-right">৳{Math.round(productSalesTotals.amount).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="no-print space-y-6">
          <OfficerPaymentSubmission dealers={availableDealers} officer={currentOfficer} />
          <form onSubmit={submitOrder} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="flex items-center gap-2 font-black text-slate-900"><ShoppingCart className="h-5 w-5 text-emerald-700" /> {t('officer.newOrder')}</h2>
              <p className="mt-1 text-xs text-slate-500">{t('officer.orderApproval')}</p>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              ডিলার (আপনার অফিসার কোড অনুযায়ী) *
              <select required value={dealerId} onChange={(event) => setDealerId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">ডিলার নির্বাচন করুন</option>
                {availableDealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>
                    {formatDealerCode(dealer.code)} • {dealer.shopName} • {dealer.proprietor || ''}
                  </option>
                ))}
              </select>
              {!availableDealers.length && <span className="mt-1 block text-rose-700">আপনার কোডে কোনো ডিলার বরাদ্দ নেই।</span>}
            </label>
            {items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <select
                  required
                  value={item.productId && item.sku ? `${item.productId}::${item.sku}` : ''}
                  onChange={(event) => {
                    const selected = allProductVariants.find((variant) => variant.key === event.target.value);
                    updateItem(index, 'productId', selected?.productId || '');
                    updateItem(index, 'sku', selected?.sku || '');
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">{t('officer.selectProduct')}</option>
                  {allProductVariants.map((variant) => (
                    <option key={variant.key} value={variant.key}>
                      {variant.productName} — {variant.size} ({t('officer.stock')} {Math.round(Number(variant.stockCartons || 0)).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')} {getPackageQuantityUnit(variant)}{getVariantShortage(variant) > 0 ? ` • ঘাটতি ${Math.round(getVariantShortage(variant))} ${getPackageQuantityUnit(variant)}` : ''})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <label className="flex-1 text-[11px] font-semibold text-slate-600">
                    পরিমাণ ({getPackageQuantityUnit(allProductVariants.find((variant) => variant.productId === item.productId && variant.sku === item.sku)) || 'কার্টুন'})
                    <input required min="1" step="1" type="number" value={item.cartons} onChange={(event) => updateItem(index, 'cartons', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </label>
                  {(() => {
                    const selectedVariant = allProductVariants.find((variant) => variant.productId === item.productId && variant.sku === item.sku);
                    if (!selectedVariant) return null;
                    const shortage = getVariantShortage(selectedVariant);
                    return (
                      <p className={`mt-4 text-[11px] font-bold ${shortage ? 'text-rose-700' : 'text-emerald-700'}`}>
                        ডিপোতে {Number(selectedVariant.stockCartons) || 0} {getPackageQuantityUnit(selectedVariant)} • {shortage ? `ঘাটতি ${shortage} ${getPackageQuantityUnit(selectedVariant)}` : 'অর্ডারের জন্য যথেষ্ট'}
                      </p>
                    );
                  })()}
                  {items.length > 1 && <button type="button" onClick={() => setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} className="mt-4 rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">{t('officer.remove')}</button>}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setItems((previous) => [...previous, { productId: '', sku: '', cartons: 1 }])} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Plus className="h-4 w-4" /> {t('officer.addProduct')}</button>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows="2" maxLength="500" placeholder={t('officer.orderNote')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">{message}</p>}
            <button disabled={busy || !allProductVariants.length || !dealerId} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              <Send className="h-4 w-4" /> {busy ? t('officer.submitting') : t('officer.submitOrder')}
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-black text-slate-900">ডিপোতে পণ্যের মজুদ ও অর্ডার ঘাটতি</h2>
              <p className="text-xs text-slate-500">প্রতিটি প্যাক সাইজের বর্তমান কার্টুন এবং আপনার অর্ডারে যত কার্টুন কম আছে</p>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[460px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3">পণ্য ও প্যাক সাইজ</th><th className="px-4 py-3 text-right">ডিপো স্টক</th><th className="px-4 py-3 text-right">ঘাটতি</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {allProductVariants.map((variant) => {
                    const shortage = getVariantShortage(variant);
                    return (
                      <tr key={variant.key}>
                        <td className="px-4 py-2.5 font-semibold">{variant.productName} • {variant.size}</td>
                        <td className="px-4 py-2.5 text-right">{Number(variant.stockCartons) || 0} কার্টুন</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${shortage ? 'text-rose-700' : 'text-emerald-700'}`}>{shortage ? `${shortage} কার্টুন` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-black text-slate-900">{t('officer.orderStatus')}</h2>
            <div className="space-y-2">
              {officerOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{order.invoiceNo || order.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${order.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : order.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {order.status === 'approved' ? t('officer.approved') : order.status === 'rejected' ? t('officer.rejected') : t('officer.pending')}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{order.dealerName ? `ডিলার: ${formatDealerCode(order.dealerCode)} • ${order.dealerName} • ` : ''}{(order.items || []).map((orderItem) => `${orderItem.productName} × ${orderItem.cartons}`).join(' • ')}</p>
                  {order.decisionNote && <p className="mt-1 text-[11px] text-slate-600">{t('officer.adminNote')} {order.decisionNote}</p>}
                </div>
              ))}
              {!officerOrders.length && <p className="text-xs text-slate-500">{t('officer.noOrders')}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
