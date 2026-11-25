import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Save } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import CompanyLetterhead from './CompanyLetterhead';
import MonthlySalesReports from './MonthlySalesReports';
import { calculateMonthlyStockReport, sumMonthlyStockReport } from '../../../shared/monthlyStockReport';
import { isDealerCollection } from '../../../shared/paymentMethods';
import { getInvoiceSalesAmount } from '../../../shared/invoiceTotals';
import { calculateOfficerFinancials } from '../../../shared/officerFinancials';
import {
  getOfficerSalesTarget,
  hasOfficerSessionSalesTarget
} from '../../../shared/officerSalesTargets';
import { getOfficerPreviousDueByDealer, dealerHasOfficerPreviousDue } from '../../../shared/officerLedger';
import { normalizeOfficerCode } from '../../../shared/codes';
import { parseReportMonth, parseSessionDateRange } from '../../../shared/reportDateFilters';
import {
  getInvoiceSessionForDate,
  INVOICE_SESSIONS,
  getBangladeshBusinessDate,
  normalizeSessionText
} from '../../../shared/sessions';
import { isAdminRole } from '../../../shared/roles';
import { readJsonResponse } from '../../utils/api';

const today = getBangladeshBusinessDate();
const currentSession = getInvoiceSessionForDate(today);
const currentMonth = today.slice(0, 7);
const currentYear = today.slice(0, 4);
const money = (value) => `৳${Math.round(Number(value) || 0).toLocaleString('bn-BD')}`;

async function requestJson(url, options = {}) {
  return readJsonResponse(await fetch(url, { cache: 'no-store', ...options }));
}

function periodRange(filter) {
  if (filter.type === 'month') return parseReportMonth(filter.value);
  if (filter.type === 'session') return parseSessionDateRange(filter.value);
  if (filter.type === 'year' && /^20\d{2}$/.test(filter.value)) {
    return { start: `${filter.value}-01-01`, end: `${Number(filter.value) + 1}-01-01` };
  }
  return null;
}

function getSessionStartDate(session) {
  return parseSessionDateRange(session)?.start || '';
}

function isInPeriod(date, range) {
  const value = String(date || '');
  return Boolean(value && range && value >= range.start && value < range.end);
}

function isPaymentInPeriod(payment, filter, range) {
  return isInPeriod(payment.date, range)
    || (filter.type === 'session'
      && !payment.date
      && normalizeSessionText(payment.session) === normalizeSessionText(filter.value));
}

function createFilter() {
  return { type: 'session', value: currentSession };
}

function PeriodFilter({ value, onChange, years, months, sessions }) {
  return (
    <div className="no-print grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">
        সময়সীমা
        <select
          value={value.type}
          onChange={(event) => {
            const type = event.target.value;
            onChange({
              type,
              value: type === 'month' ? currentMonth : type === 'year' ? currentYear : currentSession
            });
          }}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        >
          <option value="month">মাসিক</option>
          <option value="session">সেশন</option>
          <option value="year">ইয়ারলি</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">
        {value.type === 'month' ? 'মাস' : value.type === 'year' ? 'বছর' : 'সেশন'}
        {value.type === 'month' ? (
          <input
            type="month"
            min="2025-07"
            value={value.value}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        ) : (
          <select
            value={value.value}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            {(value.type === 'year' ? years : sessions).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )}
      </label>
    </div>
  );
}

function ReportPrintHeader({ title, filter }) {
  return (
    <div className="report-invoice-header">
      <CompanyLetterhead />
      <h2 className="mt-2 border-y-2 border-slate-900 py-2 text-center text-lg font-black">{title}</h2>
      <p className="py-2 text-center text-sm font-bold">
        {filter.type === 'month' ? 'মাসিক' : filter.type === 'year' ? 'ইয়ারলি' : 'সেশন'}: {filter.value}
      </p>
    </div>
  );
}

function targetSessionsForPeriod(record, filter, range) {
  const targets = new Set([
    ...Object.keys(record.salesTargets || {}),
    ...INVOICE_SESSIONS
  ]);
  return [...targets].filter((session) => {
    const target = getOfficerSalesTarget(record, session);
    if (target == null || !Number.isFinite(Number(target))) return false;
    if (filter.type === 'session') return session === filter.value;
    const targetDate = record.salesTargetDates?.[session];
    if (targetDate) return isInPeriod(targetDate, range);
    if (filter.type === 'year') return session.includes(filter.value);
    return false;
  });
}

function officerMatches(record, officer) {
  return Boolean(
    (officer.id && String(record.officerId || '') === String(officer.id))
    || (normalizeOfficerCode(record.officerCode) && normalizeOfficerCode(record.officerCode)
      === normalizeOfficerCode(officer.code, officer.designation))
    || (!record.officerId && !record.officerCode
      && record.officerName && record.officerName === officer.name)
  );
}

function getOfficerPreviousDue(dealers, officer, range, filter) {
  const identity = {
    officerIds: [officer.id],
    officerCode: normalizeOfficerCode(officer.code, officer.designation),
    designation: officer.designation
  };
  const dueByDealer = getOfficerPreviousDueByDealer(dealers, identity, {
    session: filter.type === 'session' ? filter.value : 'ALL',
    month: filter.type === 'month' ? filter.value : 'ALL'
  });
  if (filter.type !== 'year') {
    return [...dueByDealer.values()].reduce((sum, due) => sum + due.amount, 0);
  }

  return dealers.reduce((sum, dealer) => {
    if (!dealerHasOfficerPreviousDue(dealer, identity)) return sum;
    const entries = dealer.previousDueHistory?.length
      ? dealer.previousDueHistory
      : [{
        amount: dealer.previousDue ?? dealer.lastSessionDue ?? dealer.openingDue,
        date: dealer.previousDueDate,
        session: dealer.previousDueSession
      }];
    const match = entries.filter((entry) => {
      if (isInPeriod(entry.date, range)) return true;
      if (entry.date) return false;
      const sessionRange = parseSessionDateRange(entry.session);
      return Boolean(sessionRange && sessionRange.start < range.end && sessionRange.end > range.start);
    })
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))[0];
    return sum + (Number(match?.amount) || 0);
  }, 0);
}

function getTargetValue(record, filter, range) {
  return targetSessionsForPeriod(record, filter, range).reduce(
    (sum, session) => sum + (Number(getOfficerSalesTarget(record, session)) || 0),
    0
  );
}

function FilteredReportTable({ children, className = '' }) {
  return <div className={`overflow-x-auto rounded-lg border border-slate-200 ${className}`}>{children}</div>;
}

export default function MonthlyTargetReports() {
  const {
    currentUser,
    dealers,
    invoices,
    officers,
    payments,
    products,
    stockInLogs
  } = useAgro();
  const [activeReport, setActiveReport] = useState('officer');
  const [officerTargets, setOfficerTargets] = useState([]);
  const [dealerTargets, setDealerTargets] = useState([]);
  const [officerFilter, setOfficerFilter] = useState(createFilter);
  const [dealerFilter, setDealerFilter] = useState(createFilter);
  const [stockFilter, setStockFilter] = useState(createFilter);
  const [officerDraft, setOfficerDraft] = useState({
    officerId: '',
    date: today,
    session: currentSession,
    targetAmount: ''
  });
  const [dealerDraft, setDealerDraft] = useState({
    dealerId: '',
    date: today,
    session: currentSession,
    targetAmount: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const years = useMemo(() => [...new Set([
    currentYear,
    ...INVOICE_SESSIONS.map((session) => session.match(/\d{4}/)?.[0]).filter(Boolean)
  ])].sort().reverse(), []);
  const sessions = useMemo(() => [...new Set([
    ...INVOICE_SESSIONS,
    ...officerTargets.flatMap((record) => Object.keys(record.salesTargets || {})),
    ...dealerTargets.map((record) => record.session)
  ])], [dealerTargets, officerTargets]);

  const refreshTargets = async () => {
    const [officerRecords, dealerRecords] = await Promise.all([
      requestJson('/api/sales-officers'),
      requestJson('/api/dealer-targets')
    ]);
    setOfficerTargets(Array.isArray(officerRecords) ? officerRecords : []);
    setDealerTargets(Array.isArray(dealerRecords) ? dealerRecords : []);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([requestJson('/api/sales-officers'), requestJson('/api/dealer-targets')])
      .then(([officerRecords, dealerRecords]) => {
        if (cancelled) return;
        setOfficerTargets(Array.isArray(officerRecords) ? officerRecords : []);
        setDealerTargets(Array.isArray(dealerRecords) ? dealerRecords : []);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, []);

  const officerReport = useMemo(() => {
    const range = periodRange(officerFilter);
    if (!range) return { rows: [], totals: null };
    const uniqueOfficers = new Map();
    officers.forEach((officer) => {
      const key = normalizeOfficerCode(officer.code, officer.designation)
        || String(officer.id || officer.officerId || '')
        || String(officer.name || '').trim();
      if (key && !uniqueOfficers.has(key)) uniqueOfficers.set(key, officer);
    });
    const rows = [...uniqueOfficers.values()].map((officer) => {
      const saved = officerTargets.find((record) => officerMatches(record, officer)) || {};
      const target = getTargetValue({ ...officer, ...saved }, officerFilter, range);
      const officerInvoices = invoices.filter((invoice) => (
        isInPeriod(invoice.date, range) && officerMatches({
          officerId: invoice.officerId,
          officerCode: invoice.officerCode,
          officerName: invoice.officerName
        }, officer)
      ));
      const officerPayments = payments.filter((payment) => (
        isPaymentInPeriod(payment, officerFilter, range) && officerMatches({
          officerId: payment.officerId,
          officerCode: payment.officerCode,
          officerName: payment.officerName
        }, officer)
      ));
      const openingDue = getOfficerPreviousDue(dealers, officer, range, officerFilter);
      const metrics = calculateOfficerFinancials({
        invoices: officerInvoices,
        payments: officerPayments,
        salesTarget: target,
        lastSessionDue: openingDue
      });
      return { id: officer.id, officer, target, ...metrics };
    });
    const totals = rows.reduce((sum, row) => ({
      target: sum.target + row.target,
      sales: sum.sales + row.salesAmount,
      returns: sum.returns + row.returnAmount,
      netSales: sum.netSales + row.totalNetSales,
      previousPlusNetSales: sum.previousPlusNetSales + row.previousPlusNetSales,
      received: sum.received + row.totalReceivedAmount,
      dues: sum.dues + row.totalAmountDues,
      salesDues: sum.salesDues + row.totalSalesDues,
      paymentPercentageBase: sum.paymentPercentageBase + Math.max(0, row.previousPlusNetSales)
    }), {
      target: 0,
      sales: 0,
      returns: 0,
      netSales: 0,
      previousPlusNetSales: 0,
      received: 0,
      dues: 0,
      salesDues: 0,
      paymentPercentageBase: 0
    });
    totals.salesPercentage = totals.target > 0
      ? Math.round(totals.previousPlusNetSales / totals.target * 100)
      : 0;
    totals.paymentPercentage = totals.paymentPercentageBase > 0
      ? Math.round(totals.received / totals.paymentPercentageBase * 100)
      : 0;
    return { rows, totals };
  }, [dealers, invoices, officers, officerFilter, officerTargets, payments]);

  const dealerReport = useMemo(() => {
    const range = periodRange(dealerFilter);
    if (!range) return { rows: [], totals: null };
    const groupedTargets = new Map();
    dealerTargets.filter((target) => isInPeriod(target.targetDate, range)
      && (dealerFilter.type !== 'session' || target.session === dealerFilter.value))
      .forEach((target) => {
        const key = `${String(target.dealerId || target.dealerCode || target.dealerName || '')}|${String(target.session || '')}`;
        const previous = groupedTargets.get(key);
        if (!previous || String(target.targetDate || '').localeCompare(String(previous.targetDate || '')) >= 0) {
          groupedTargets.set(key, target);
        }
      });
    const rows = [...groupedTargets.values()].map((target) => {
        const dealer = dealers.find((entry) => entry.id === target.dealerId);
        const isDealerInvoice = (invoice) => (
          invoice.dealerId === target.dealerId
          || invoice.dealerCode === target.dealerCode
        );
        const isSalesInvoice = (invoice) => (
          !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
        );
        const dealerInvoices = invoices.filter((invoice) => (
          isInPeriod(invoice.date, range)
          && isDealerInvoice(invoice)
        ));
        const dealerPayments = payments.filter((payment) => (
          isPaymentInPeriod(payment, dealerFilter, range)
          && (payment.dealerId === target.dealerId
            || payment.dealerCode === target.dealerCode
            || payment.dealerName === target.dealerName)
          && isDealerCollection(payment)
          && !payment.sourceInvoiceId
          && !/(?:invoice|চালান)\s*#/i.test(String(payment.reference || ''))
        ));
        const sales = dealerInvoices.filter(isSalesInvoice)
          .reduce((sum, invoice) => sum + getInvoiceSalesAmount(invoice), 0);
        const returns = dealerInvoices.filter((invoice) => invoice.invoiceType === 'dealer_return')
          .reduce((sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)), 0);
        const invoiceReceived = dealerInvoices.filter(isSalesInvoice)
          .reduce((sum, invoice) => sum + (Number(invoice.paidAmount) || 0), 0);
        const received = invoiceReceived + dealerPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
        const previousDue = dealer?.previousDueHistory?.filter((entry) => (
          dealerFilter.type === 'session'
            ? entry.session === dealerFilter.value || isInPeriod(entry.date, range)
            : isInPeriod(entry.date, range)
        )).sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))[0]?.amount
          ?? dealer?.lastSessionDue
          ?? dealer?.openingDue
          ?? 0;
        const netSales = sales - returns;
        const paymentBase = Math.max(0, Number(previousDue) + netSales);
        return {
          ...target,
          dealerName: dealer?.shopName || target.dealerName,
          target: Number(target.targetAmount) || 0,
          sales,
          returns,
          netSales,
          received,
          paymentDue: Number(previousDue) + netSales - received,
          salesPercentage: target.targetAmount > 0
            ? Math.round(netSales / target.targetAmount * 100)
            : 0,
          paymentPercentage: paymentBase > 0 ? Math.round(received / paymentBase * 100) : 0
        };
      });
    const totals = rows.reduce((sum, row) => ({
      target: sum.target + row.target,
      sales: sum.sales + row.sales,
      returns: sum.returns + row.returns,
      netSales: sum.netSales + row.netSales,
      received: sum.received + row.received,
      paymentDue: sum.paymentDue + row.paymentDue,
      paymentBase: sum.paymentBase + Math.max(0, row.paymentDue + row.received)
    }), { target: 0, sales: 0, returns: 0, netSales: 0, received: 0, paymentDue: 0, paymentBase: 0 });
    totals.salesPercentage = totals.target > 0 ? Math.round(totals.netSales / totals.target * 100) : 0;
    totals.paymentPercentage = totals.paymentBase > 0 ? Math.round(totals.received / totals.paymentBase * 100) : 0;
    return { rows, totals };
  }, [dealerFilter, dealerTargets, dealers, invoices, payments]);

  const stockReport = useMemo(() => {
    const range = periodRange(stockFilter);
    if (!range) return { rows: [], totals: null, error: 'স্টক রিপোর্টের সময়সীমা সঠিক নয়।' };
    try {
      const rows = calculateMonthlyStockReport({ products, invoices, stockInLogs, range });
      return { rows, totals: sumMonthlyStockReport(rows), error: '' };
    } catch (reportError) {
      return { rows: [], totals: null, error: reportError.message };
    }
  }, [invoices, products, stockFilter, stockInLogs]);

  const selectedOfficer = officers.find((entry) => entry.id === officerDraft.officerId);
  const selectedOfficerTarget = officerTargets.find((entry) => (
    selectedOfficer && officerMatches(entry, selectedOfficer)
  )) || {};
  const officerTargetLocked = Boolean(selectedOfficer && hasOfficerSessionSalesTarget(
    {
      salesTargets: selectedOfficer.salesTargets,
      ...selectedOfficerTarget
    },
    officerDraft.session
  ));
  const dealerTargetLocked = Boolean(dealerDraft.dealerId && dealerTargets.some((target) => (
    target.dealerId === dealerDraft.dealerId && target.session === dealerDraft.session
  )));

  const submitOfficerTarget = async (event) => {
    event.preventDefault();
    const officer = selectedOfficer;
    if (!officer) return setError('অফিসার নির্বাচন করুন।');
    if (officerTargetLocked) {
      return setError('এই অফিসারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।');
    }
    if (!window.confirm(`${officer.name} • ${officerDraft.session} সেশনের টার্গেট সংরক্ষণ করবেন?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await requestJson('/api/sales-officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officerId: officer.id,
          officerCode: normalizeOfficerCode(officer.code, officer.designation),
          date: officerDraft.date,
          session: officerDraft.session,
          targetAmount: officerDraft.targetAmount
        })
      });
      await refreshTargets();
      setOfficerDraft((draft) => ({ ...draft, targetAmount: '' }));
      setMessage('অফিসার টার্গেট সংরক্ষণ হয়েছে।');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const submitDealerTarget = async (event) => {
    event.preventDefault();
    const dealer = dealers.find((entry) => entry.id === dealerDraft.dealerId);
    if (!dealer) return setError('ডিলার নির্বাচন করুন।');
    if (dealerTargetLocked) {
      return setError('এই ডিলারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।');
    }
    if (!window.confirm(`${dealer.shopName} • ${dealerDraft.session} সেশনের টার্গেট সংরক্ষণ করবেন?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await requestJson('/api/dealer-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId: dealer.id,
          date: dealerDraft.date,
          session: dealerDraft.session,
          targetAmount: dealerDraft.targetAmount
        })
      });
      setDealerTargets((records) => [saved, ...records]);
      setDealerDraft((draft) => ({ ...draft, targetAmount: '' }));
      setMessage('ডিলার টার্গেট সংরক্ষণ হয়েছে।');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    ['officer', 'অফিসার টার্গেট'],
    ['dealer', 'ডিলার টার্গেট'],
    ['stock', 'মাসিক স্টক রিপোর্ট'],
    ['manual', 'মাসিক বিক্রয় রিপোর্ট']
  ];

  return (
    <main className="report-print mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-950 to-emerald-700 p-6 text-white">
        <div>
          <h1 className="text-2xl font-black">মাসিক বিক্রয় টার্গেট ও রিপোর্ট</h1>
          <p className="mt-1 text-sm text-emerald-100">অফিসার, ডিলার ও স্টক রিপোর্ট</p>
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold">
          <Printer className="h-4 w-4" /> প্রিন্ট
        </button>
      </header>

      <nav className="no-print flex flex-wrap gap-2" aria-label="রিপোর্ট নির্বাচন">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setActiveReport(id); setError(''); setMessage(''); }}
            aria-pressed={activeReport === id}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${activeReport === id ? 'bg-emerald-800 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="no-print rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="no-print rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}

      {activeReport === 'officer' && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <ReportPrintHeader title="অফিসার টার্গেট রিপোর্ট" filter={officerFilter} />
          <div className="no-print flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900">অফিসার টার্গেট</h2>
              <p className="text-xs text-slate-500">প্রতি অফিসার ও সেশনে একবারই টার্গেট সেট করা যাবে।</p>
            </div>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"><Printer className="h-4 w-4" /> প্রিন্ট</button>
          </div>
          <form onSubmit={submitOfficerTarget} className="no-print grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-slate-600">তারিখ
              <input required type="date" value={officerDraft.date} onChange={(event) => setOfficerDraft((draft) => ({
                ...draft,
                date: event.target.value,
                session: getInvoiceSessionForDate(event.target.value)
              }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label className="text-xs font-semibold text-slate-600">সেশন
              <select required value={officerDraft.session} onChange={(event) => setOfficerDraft((draft) => ({
                ...draft,
                session: event.target.value,
                date: getSessionStartDate(event.target.value) || draft.date
              }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                {sessions.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">অফিসার নাম
              <select required value={officerDraft.officerId} onChange={(event) => setOfficerDraft((draft) => ({ ...draft, officerId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">অফিসার নির্বাচন</option>
                {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">টার্গেট ভ্যালু
              <input required disabled={officerTargetLocked} min="0" step="1" type="number" value={officerDraft.targetAmount} onChange={(event) => setOfficerDraft((draft) => ({ ...draft, targetAmount: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100" />
              {officerTargetLocked && <span className="mt-1 block text-rose-700">অলরেডি ইমপোর্ট করা আছে</span>}
            </label>
            <button disabled={busy || officerTargetLocked || !isAdminRole(currentUser?.role)} type="submit" className="self-end inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> {busy ? 'সংরক্ষণ হচ্ছে…' : 'টার্গেট সংরক্ষণ'}
            </button>
          </form>
          <PeriodFilter value={officerFilter} onChange={setOfficerFilter} years={years} months={[]} sessions={sessions} />
          <FilteredReportTable>
            <table className="w-full min-w-[1450px] text-left text-xs monthly-stock-table">
              <thead className="bg-emerald-900 text-white"><tr>
                {['অফিসার', 'টার্গেট', 'বিক্রয়', 'রিটার্ন', 'নিট সেলস', 'পূর্বের বাকি + নিট সেলস', 'পেমেন্ট অর্জন', 'পেমেন্ট বাকি', 'সেলস বাকি', 'সেলস %', 'পেমেন্ট %'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {officerReport.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-semibold">{row.officer.name}</td>
                    <td className="px-3 py-2 text-right">{money(row.target)}</td>
                    <td className="px-3 py-2 text-right">{money(row.salesAmount)}</td>
                    <td className="px-3 py-2 text-right">{money(row.returnAmount)}</td>
                    <td className="px-3 py-2 text-right">{money(row.totalNetSales)}</td>
                    <td className="px-3 py-2 text-right">{money(row.previousPlusNetSales)}</td>
                    <td className="px-3 py-2 text-right">{money(row.totalReceivedAmount)}</td>
                    <td className="px-3 py-2 text-right">{money(row.totalAmountDues)}</td>
                    <td className="px-3 py-2 text-right">{money(row.totalSalesDues)}</td>
                    <td className="px-3 py-2 text-right">{row.salesPercentage || 0}%</td>
                    <td className="px-3 py-2 text-right">{row.paymentPercentage || 0}%</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-black">
                  <td className="px-3 py-2">মোট</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.target)}</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.sales)}</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.returns)}</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.netSales)}</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.previousPlusNetSales)}</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.received)}</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.dues)}</td>
                  <td className="px-3 py-2 text-right">{money(officerReport.totals?.salesDues)}</td>
                  <td className="px-3 py-2 text-right">{officerReport.totals?.salesPercentage || 0}%</td>
                  <td className="px-3 py-2 text-right">{officerReport.totals?.paymentPercentage || 0}%</td>
                </tr>
                {!officerReport.rows.length && <tr><td colSpan="11" className="px-3 py-8 text-center text-slate-500">এই সময়সীমায় কোনো অফিসার নেই।</td></tr>}
              </tbody>
            </table>
          </FilteredReportTable>
        </section>
      )}

      {activeReport === 'dealer' && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <ReportPrintHeader title="ডিলার টার্গেট রিপোর্ট" filter={dealerFilter} />
          <div className="no-print flex items-center justify-between gap-3">
            <div><h2 className="font-black text-slate-900">ডিলার টার্গেট</h2><p className="text-xs text-slate-500">প্রতি ডিলার ও সেশনে একবারই টার্গেট সেট করা যাবে।</p></div>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"><Printer className="h-4 w-4" /> প্রিন্ট</button>
          </div>
          <form onSubmit={submitDealerTarget} className="no-print grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-slate-600">তারিখ
              <input required type="date" value={dealerDraft.date} onChange={(event) => setDealerDraft((draft) => ({
                ...draft,
                date: event.target.value,
                session: getInvoiceSessionForDate(event.target.value)
              }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label className="text-xs font-semibold text-slate-600">সেশন
              <select required value={dealerDraft.session} onChange={(event) => setDealerDraft((draft) => ({
                ...draft,
                session: event.target.value,
                date: getSessionStartDate(event.target.value) || draft.date
              }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                {sessions.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">ডিলার নাম
              <select required value={dealerDraft.dealerId} onChange={(event) => setDealerDraft((draft) => ({ ...draft, dealerId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">ডিলার নির্বাচন</option>
                {dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.shopName}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">টার্গেট ভ্যালু
              <input required disabled={dealerTargetLocked} min="0" step="1" type="number" value={dealerDraft.targetAmount} onChange={(event) => setDealerDraft((draft) => ({ ...draft, targetAmount: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100" />
              {dealerTargetLocked && <span className="mt-1 block text-rose-700">অলরেডি ইমপোর্ট করা আছে</span>}
            </label>
            <button disabled={busy || dealerTargetLocked || !isAdminRole(currentUser?.role)} type="submit" className="self-end inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> {busy ? 'সংরক্ষণ হচ্ছে…' : 'টার্গেট সংরক্ষণ'}
            </button>
          </form>
          <PeriodFilter value={dealerFilter} onChange={setDealerFilter} years={years} months={[]} sessions={sessions} />
          <FilteredReportTable>
            <table className="w-full min-w-[1100px] text-left text-xs monthly-stock-table">
              <thead className="bg-emerald-900 text-white"><tr>
                {['ডিলার', 'টার্গেট', 'বিক্রয়', 'রিটার্ন', 'নিট সেলস', 'পেমেন্ট অর্জন', 'পেমেন্ট বাকি', 'সেলস %', 'পেমেন্ট %'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {dealerReport.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-semibold">{row.dealerName}</td>
                    <td className="px-3 py-2 text-right">{money(row.target)}</td>
                    <td className="px-3 py-2 text-right">{money(row.sales)}</td>
                    <td className="px-3 py-2 text-right">{money(row.returns)}</td>
                    <td className="px-3 py-2 text-right">{money(row.netSales)}</td>
                    <td className="px-3 py-2 text-right">{money(row.received)}</td>
                    <td className="px-3 py-2 text-right">{money(row.paymentDue)}</td>
                    <td className="px-3 py-2 text-right">{row.salesPercentage}%</td>
                    <td className="px-3 py-2 text-right">{row.paymentPercentage}%</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-black">
                  <td className="px-3 py-2">মোট</td>
                  <td className="px-3 py-2 text-right">{money(dealerReport.totals?.target)}</td>
                  <td className="px-3 py-2 text-right">{money(dealerReport.totals?.sales)}</td>
                  <td className="px-3 py-2 text-right">{money(dealerReport.totals?.returns)}</td>
                  <td className="px-3 py-2 text-right">{money(dealerReport.totals?.netSales)}</td>
                  <td className="px-3 py-2 text-right">{money(dealerReport.totals?.received)}</td>
                  <td className="px-3 py-2 text-right">{money(dealerReport.totals?.paymentDue)}</td>
                  <td className="px-3 py-2 text-right">{dealerReport.totals?.salesPercentage || 0}%</td>
                  <td className="px-3 py-2 text-right">{dealerReport.totals?.paymentPercentage || 0}%</td>
                </tr>
                {!dealerReport.rows.length && <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">এই সময়সীমায় কোনো ডিলার টার্গেট নেই।</td></tr>}
              </tbody>
            </table>
          </FilteredReportTable>
        </section>
      )}

      {activeReport === 'stock' && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <ReportPrintHeader title="মাসিক স্টক রিপোর্ট" filter={stockFilter} />
          <div className="no-print flex items-center justify-between gap-3">
            <div><h2 className="font-black text-slate-900">মাসিক স্টক রিপোর্ট</h2><p className="text-xs text-slate-500">ফ্যাক্টরি রিসিভ + মার্কেট রিটার্ন − ফ্যাক্টরি রিটার্ন − সেলস</p></div>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"><Printer className="h-4 w-4" /> প্রিন্ট</button>
          </div>
          <PeriodFilter value={stockFilter} onChange={setStockFilter} years={years} months={[]} sessions={sessions} />
          {stockReport.error && <p role="alert" className="text-sm font-semibold text-rose-700">{stockReport.error}</p>}
          <FilteredReportTable>
            <table className="w-full min-w-[1100px] text-left text-xs monthly-stock-table">
              <thead className="bg-emerald-900 text-white"><tr>
                {['সিরিয়াল নাম্বার', 'প্রোডাক্ট নাম', 'প্যাক সাইজ', 'লাষ্ট মাস স্টক', 'ফ্যাক্টরি রিসিভ', 'মার্কেট রিটার্ন', 'টোটাল স্টক', 'ফ্যাক্টরি রিটার্ন', 'সেলস', 'নিট স্টক'].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {stockReport.rows.map((row, index) => (
                  <tr key={`${row.productId}-${row.sku}`}>
                    <td className="px-2 py-1 text-center">{index + 1}</td>
                    <td className="px-2 py-1">{row.productName}</td>
                    <td className="px-2 py-1">{row.packSize} • {row.quantityUnit}</td>
                    <td className="px-2 py-1 text-right">{row.lastMonthStock}</td>
                    <td className="px-2 py-1 text-right">{row.factoryReceive}</td>
                    <td className="px-2 py-1 text-right">{row.marketReturn}</td>
                    <td className="px-2 py-1 text-right">{row.totalStock}</td>
                    <td className="px-2 py-1 text-right">{row.factoryReturn}</td>
                    <td className="px-2 py-1 text-right">{row.sales}</td>
                    <td className="px-2 py-1 text-right font-bold">{row.netStock}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-black">
                  <td colSpan="3" className="px-2 py-1 text-right">মোট</td>
                  <td className="px-2 py-1 text-right">{stockReport.totals?.lastMonthStock || 0}</td>
                  <td className="px-2 py-1 text-right">{stockReport.totals?.factoryReceive || 0}</td>
                  <td className="px-2 py-1 text-right">{stockReport.totals?.marketReturn || 0}</td>
                  <td className="px-2 py-1 text-right">{stockReport.totals?.totalStock || 0}</td>
                  <td className="px-2 py-1 text-right">{stockReport.totals?.factoryReturn || 0}</td>
                  <td className="px-2 py-1 text-right">{stockReport.totals?.sales || 0}</td>
                  <td className="px-2 py-1 text-right">{stockReport.totals?.netStock || 0}</td>
                </tr>
                {!stockReport.rows.length && !stockReport.error && <tr><td colSpan="10" className="px-2 py-8 text-center text-slate-500">কোনো স্টক তথ্য নেই।</td></tr>}
              </tbody>
            </table>
          </FilteredReportTable>
        </section>
      )}

      {activeReport === 'manual' && <MonthlySalesReports />}
    </main>
  );
}
