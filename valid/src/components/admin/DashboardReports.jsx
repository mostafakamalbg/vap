import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import {
  INVOICE_SESSIONS,
  getInvoiceSessionForDate,
  isCurrentSession,
  sortSessionsNewestFirst
} from '../../../shared/sessions';
import { useAgro } from '../../context/AgroContext';
import { readJsonResponse } from '../../utils/api';
import { isAdminRole, RSM_ROLE, ASM_ROLE } from '../../../shared/roles';

const currentMonth = new Date().toISOString().slice(0, 7);
const currentYear = String(new Date().getFullYear());
const amount = (value) => `৳${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
const number = (value) => Math.round(Number(value) || 0).toLocaleString('en-US');

async function requestReport(query) {
  return readJsonResponse(await fetch(`/api/dashboard-reports?${query}`, { cache: 'no-store' }));
}

function TableFrame({ children }) {
  return (
    <div className="max-h-[34rem] overflow-auto rounded-xl border border-slate-200">
      {children}
    </div>
  );
}

function printReportSection(section) {
  const source = document.querySelector(`[data-report-print="${section}"]`);
  if (!source) return;
  const printable = source.cloneNode(true);
  printable.classList.add('report-print', 'report-section-print');
  printable.querySelectorAll('.no-print').forEach((element) => element.remove());
  document.body.appendChild(printable);
  document.body.classList.add('report-section-printing');
  const cleanup = () => {
    printable.remove();
    document.body.classList.remove('report-section-printing');
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1000);
}

export default function DashboardReports() {
  const { currentUser } = useAgro();
  const [period, setPeriod] = useState('session');
  const [value, setValue] = useState(() => getInvoiceSessionForDate(new Date().toISOString().slice(0, 10)));
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [report, setReport] = useState({ officers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams({ period, value });
    if (selectedOfficer) params.set('officer', selectedOfficer);
    return params.toString();
  }, [period, selectedOfficer, value]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await requestReport(query);
        if (cancelled) return;
        setReport(result);
        setError('');
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    load();
    const intervalId = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [query, refreshIndex]);

  const officers = report.officers || [];
  const canSelectOfficer = isAdminRole(currentUser?.role)
    || [RSM_ROLE, ASM_ROLE].includes(currentUser?.role);
  const selected = officers.find((officer) => (
    officer.officerId === selectedOfficer || officer.officerCode === selectedOfficer
  )) || officers[0];
  const selectedPartyTotals = (selected?.parties || []).reduce((sum, party) => ({
    previousDue: sum.previousDue + party.previousDue,
    sales: sum.sales + party.sales,
    returns: sum.returns + party.returns,
    netSales: sum.netSales + party.netSales,
    salary: sum.salary + party.salary,
    officePayment: sum.officePayment + party.officePayment,
    totalExpenses: sum.totalExpenses + party.officePayment + party.salary + party.fare + party.lc,
    fare: sum.fare + party.fare,
    lc: sum.lc + party.lc,
    invoicePaid: sum.invoicePaid + party.invoicePaid,
    collection: sum.collection + party.collection,
    totalCollection: sum.totalCollection + party.totalCollection,
    actualReceived: sum.actualReceived + party.actualReceived,
    previousPlusNetSales: sum.previousPlusNetSales + party.previousPlusNetSales,
    dues: sum.dues + party.dues,
    ledgerDues: sum.ledgerDues + party.ledgerDues
  }), {
    previousDue: 0, sales: 0, returns: 0, netSales: 0, salary: 0, officePayment: 0,
    totalExpenses: 0, fare: 0, lc: 0, invoicePaid: 0, collection: 0, totalCollection: 0,
    actualReceived: 0, previousPlusNetSales: 0, dues: 0, ledgerDues: 0
  });
  const totals = officers.reduce((sum, officer) => ({
    target: sum.target + (period === 'year' ? officer.yearlyTarget : officer.sessionTarget),
    lastDue: sum.lastDue + officer.lastDue,
    sales: sum.sales + officer.salesAmount,
    returns: sum.returns + officer.returnAmount,
    previousPlusNetSales: sum.previousPlusNetSales + officer.previousPlusNetSales,
    officePayment: sum.officePayment + officer.paymentAndExpense.officePayment,
    expenses: sum.expenses + officer.totalExpenses,
    fare: sum.fare + officer.paymentAndExpense.fare,
    salary: sum.salary + officer.paymentAndExpense.salary,
    lc: sum.lc + officer.paymentAndExpense.lc,
    received: sum.received + officer.totalReceivedAmount,
    dues: sum.dues + officer.totalAmountDues,
    salesDues: sum.salesDues + officer.totalSalesDues
  }), {
    target: 0, lastDue: 0, sales: 0, returns: 0, previousPlusNetSales: 0,
    officePayment: 0, expenses: 0, fare: 0, salary: 0, lc: 0, received: 0, dues: 0,
    salesDues: 0
  });
  const periodLabel = period === 'month'
    ? new Date(`${value}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : period === 'year' ? value : value;

  const setPeriodType = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'month') setValue(currentMonth);
    else if (nextPeriod === 'year') setValue(currentYear);
    else setValue(getInvoiceSessionForDate(new Date().toISOString().slice(0, 10)));
    setSelectedOfficer('');
  };

  return (
    <main className="report-print mx-auto max-w-[96rem] space-y-6 px-4 py-8">
      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-emerald-700 p-6 text-white shadow-lg sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Valid Agro Product Limited</p>
          <h1 className="mt-1 text-2xl font-black">লাইভ অফিসার পারফরম্যান্স রিপোর্ট</h1>
          <p className="mt-1 text-sm text-emerald-100">{periodLabel} • ইনভয়েস ও পেমেন্ট কালেকশন থেকে সরাসরি</p>
        </div>
        <div className="no-print flex gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
            <Printer className="h-4 w-4" /> প্রিন্ট
          </button>
          <button
            type="button"
            onClick={() => setRefreshIndex((index) => index + 1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"
            aria-label="রিপোর্ট রিফ্রেশ করুন"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> রিফ্রেশ
          </button>
        </div>
      </header>

      <section className="no-print grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="text-xs font-bold text-slate-600">
          রিপোর্টের সময়সীমা
          <select value={period} onChange={(event) => setPeriodType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="month">মাসিক</option>
            <option value="session">সেশন অনুযায়ী</option>
            <option value="year">বার্ষিক</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          {period === 'month' ? 'মাস' : period === 'year' ? 'বছর' : 'সেশন'}
          {period === 'month' ? (
            <input type="month" min="2025-07" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          ) : period === 'year' ? (
            <select value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {[...new Set([currentYear, ...INVOICE_SESSIONS.map((session) => session.match(/\d{4}/)?.[0]).filter(Boolean)])].sort().reverse().map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          ) : (
            <select value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {sortSessionsNewestFirst(INVOICE_SESSIONS.filter(isCurrentSession)).map((session) => <option key={session} value={session}>{session}</option>)}
            </select>
          )}
        </label>
        <label className="text-xs font-bold text-slate-600">
          অফিসার
          <select value={selectedOfficer} onChange={(event) => setSelectedOfficer(event.target.value)} disabled={!canSelectOfficer} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100">
            {canSelectOfficer && <option value="">সকল অধীনস্থ অফিসার (Top Sheet)</option>}
            {officers.map((officer) => (
              <option key={officer.officerId || officer.officerCode} value={officer.officerId || officer.officerCode}>
                {officer.officerName} {officer.officerCode ? `(${officer.officerCode})` : ''}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section data-report-print="master" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 p-4">
          <div>
            <h2 className="font-black text-slate-900">Officer / Session Summary Master Table</h2>
            <p className="text-xs text-slate-500">সকল অফিসারের সমন্বিত Top Sheet • নির্বাচিত সময়সীমা: {periodLabel}</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{number(officers.length)} জন অফিসার</span>
            <button type="button" onClick={() => printReportSection('master')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"><Printer className="h-3.5 w-3.5" /> প্রিন্ট টেবিল</button>
          </div>
        </div>
        <TableFrame>
          <table className="officer-master-table w-full min-w-[1500px] border-separate border-spacing-0 text-right text-[10px]">
            <thead className="sticky top-0 z-10 bg-emerald-900 text-white">
              <tr>
                <th rowSpan="2" className="sticky left-0 z-20 bg-emerald-900 px-2 py-1 text-center">SL</th>
                <th rowSpan="2" className="sticky left-12 z-20 bg-emerald-900 px-2 py-1 text-left">Officer Name</th>
                <th rowSpan="2" className="px-2 py-1">{period === 'year' ? 'Yearly' : 'Session'} Sales Target</th>
                <th rowSpan="2" className="px-2 py-1">Session Due / Last Due</th>
                <th rowSpan="2" className="px-2 py-1">Sales Amount (Tk)</th>
                <th rowSpan="2" className="px-2 py-1">Return Amount (Tk)</th>
                <th rowSpan="2" className="px-2 py-1">Previous + Net Sales (Tk)</th>
                <th colSpan="5" className="px-2 py-1 text-center">Payment &amp; Expense</th>
                <th rowSpan="2" className="px-2 py-1">Total Received Amount</th>
                <th rowSpan="2" className="px-2 py-1">Total Amount Dues</th>
                <th rowSpan="2" className="px-2 py-1">Total Sales Dues</th>
                <th rowSpan="2" className="px-2 py-1">Sales Percentage (%)</th>
                <th rowSpan="2" className="px-2 py-1">Payment Percentage (%)</th>
              </tr>
              <tr>
                <th className="px-2 py-1">অফিস পেমেন্ট</th><th className="px-2 py-1">Fare</th>
                <th className="px-2 py-1">Salary</th><th className="px-2 py-1">L/C</th>
                <th className="px-2 py-1">মোট খরচ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {officers.map((officer, index) => (
                <tr key={officer.officerId || officer.officerCode || officer.officerName} className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50">
                  <td className="sticky left-0 bg-inherit px-2 py-1 text-center font-bold">{index + 1}</td>
                  <td className="sticky left-12 bg-inherit px-2 py-1 text-left font-bold text-slate-900">{officer.officerName}<span className="block text-[10px] font-normal text-slate-500">{officer.officerCode}</span></td>
                  <td className="px-2 py-1">{amount(period === 'year' ? officer.yearlyTarget : officer.sessionTarget)}</td><td className="px-2 py-1">{amount(officer.lastDue)}</td>
                  <td className="px-2 py-1">{amount(officer.salesAmount)}</td><td className="px-2 py-1">{amount(officer.returnAmount)}</td>
                  <td className="px-2 py-1 font-semibold">{amount(officer.previousPlusNetSales)}</td>
                  <td className="px-2 py-1">{amount(officer.paymentAndExpense.officePayment)}</td><td className="px-2 py-1">{amount(officer.paymentAndExpense.fare)}</td>
                  <td className="px-2 py-1">{amount(officer.paymentAndExpense.salary)}</td><td className="px-2 py-1">{amount(officer.paymentAndExpense.lc)}</td>
                  <td className="px-2 py-1">{amount(officer.totalExpenses)}</td>
                  <td className="px-2 py-1 font-bold text-emerald-800">{amount(officer.totalReceivedAmount)}</td>
                  <td className="px-2 py-1 font-bold text-rose-700">{amount(officer.totalAmountDues)}</td>
                  <td className="px-2 py-1">{amount(officer.totalSalesDues)}</td>
                  <td className="px-2 py-1">{officer.salesPercentage}%</td><td className="px-2 py-1">{officer.paymentPercentage}%</td>
                </tr>
              ))}
              <tr className="sticky bottom-0 bg-emerald-50 font-black text-slate-900">
                <td colSpan="2" className="sticky left-0 bg-emerald-50 px-2 py-1 text-left">TOTAL</td>
                <td className="px-2 py-1">{amount(totals.target)}</td><td className="px-2 py-1">{amount(totals.lastDue)}</td>
                <td className="px-2 py-1">{amount(totals.sales)}</td><td className="px-2 py-1">{amount(totals.returns)}</td>
                <td className="px-2 py-1">{amount(totals.previousPlusNetSales)}</td><td className="px-2 py-1">{amount(totals.officePayment)}</td>
                <td className="px-2 py-1">{amount(totals.fare)}</td><td className="px-2 py-1">{amount(totals.salary)}</td>
                <td className="px-2 py-1">{amount(totals.lc)}</td><td className="px-2 py-1">{amount(totals.expenses)}</td>
                <td className="px-2 py-1">{amount(totals.received)}</td>
                <td className="px-2 py-1">{amount(totals.dues)}</td>
                <td className="px-2 py-1">{amount(totals.salesDues)}</td><td className="px-2 py-1">—</td><td className="px-2 py-1">—</td>
              </tr>
              {!officers.length && <tr><td colSpan="17" className="px-4 py-10 text-center text-slate-500">{loading ? 'লাইভ রিপোর্ট লোড হচ্ছে…' : 'এই সময়সীমায় কোনো অফিসার বা লেনদেন নেই।'}</td></tr>}
            </tbody>
          </table>
        </TableFrame>
      </section>

      {selected && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [`Jan-June ${value.match(/\d{4}/)?.[0] || currentYear} Target`, amount(selected.yearlyTarget - selected.julyDecemberTarget)],
              [`July-December ${value.match(/\d{4}/)?.[0] || currentYear} Target`, amount(selected.julyDecemberTarget)],
              ['Combined Two-Session / Yearly Target', amount(selected.yearlyTarget)],
              ['Session Target', amount(selected.sessionTarget)],
              ['Sales Achievement', `${amount(selected.totalNetSales)} • ${selected.salesPercentage}%`],
              ['Total Invoices', number(selected.invoiceCount)],
              ['মোট খরচ', amount(selected.totalExpenses)],
              ['Total Dues', amount(selected.totalAmountDues)],
              ['Total Net Sales', amount(selected.totalNetSales)],
              ['Total Sales Dues', amount(selected.totalSalesDues)],
              ['Collection / Payment', `${amount(selected.totalReceivedAmount)} • ${selected.paymentPercentage}%`]
            ].map(([label, total]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{total}</p>
              </div>
            ))}
          </section>

          <section data-report-print="party" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
              <div>
                <h2 className="font-black text-slate-900">Party / Mobile &amp; Transaction Details — {selected.officerName}</h2>
                <p className="text-xs text-slate-500">পূর্বের ব্যালেন্স এবং নির্বাচিত সময়সীমার চালান ও পেমেন্টের লাইভ হিসাব</p>
              </div>
              <button type="button" onClick={() => printReportSection('party')} className="no-print inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"><Printer className="h-3.5 w-3.5" /> প্রিন্ট টেবিল</button>
            </div>
            <TableFrame>
              <table className="officer-party-table w-full min-w-[1400px] border-separate border-spacing-0 text-right text-[10px]">
                <thead className="sticky top-0 z-10 bg-emerald-900 text-white"><tr>
                  {['SL', 'ডিলারের নাম', 'Previous Dues', 'Sales Amount (Tk)', 'Return Goods (Tk)', 'Actual Sales (Tk)', 'Salary', 'অফিস পেমেন্ট', 'Fare', 'L/C', 'Received (Amount Tk)', 'Dues'].map((header) => <th key={header} className="px-2 py-1">{header}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.parties.map((party) => (
                    <tr key={party.dealerId || `${party.dealerName}-${party.mobileNo}`} className="odd:bg-white even:bg-slate-50">
                      <td className="px-2 py-1">{party.slNo}</td><td className="px-2 py-1 text-left">{party.dealerName || '—'}</td>
                      <td className="px-2 py-1">{amount(party.previousDue)}</td><td className="px-2 py-1">{amount(party.sales)}</td>
                      <td className="px-2 py-1">{amount(party.returns)}</td><td className="px-2 py-1 font-bold">{amount(party.netSales)}</td>
                      <td className="px-2 py-1">{amount(party.salary)}</td><td className="px-2 py-1">{amount(party.officePayment)}</td>
                      <td className="px-2 py-1">{amount(party.fare)}</td><td className="px-2 py-1">{amount(party.lc)}</td>
                      <td className="px-2 py-1 font-bold text-emerald-800">{amount(party.actualReceived)}</td>
                      <td className="px-2 py-1 font-bold text-rose-700">{amount(party.dues)}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50 font-black text-slate-900">
                    <td colSpan="2" className="px-2 py-1 text-left">TOTAL</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.previousDue)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.sales)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.returns)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.netSales)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.salary)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.officePayment)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.fare)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.lc)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.actualReceived)}</td>
                    <td className="px-2 py-1">{amount(selectedPartyTotals.dues)}</td>
                  </tr>
                  {!selected.parties.length && <tr><td colSpan="12" className="px-4 py-8 text-center text-slate-500">কোনো পার্টি লেনদেন পাওয়া যায়নি।</td></tr>}
                </tbody>
              </table>
            </TableFrame>
          </section>

          <section data-report-print="monthly-party" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
              <div>
                <h2 className="font-black text-slate-900">Monthly Party-wise Ledger — Name of the party</h2>
                <p className="text-xs text-slate-500">Present Month: {periodLabel} • Salary, collection, fare এবং L/C সহ রিপোর্ট শিট</p>
              </div>
              <button type="button" onClick={() => printReportSection('monthly-party')} className="no-print inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"><Printer className="h-3.5 w-3.5" /> প্রিন্ট টেবিল</button>
            </div>
            <TableFrame>
              <table className="officer-monthly-party-table w-full min-w-[1400px] border-separate border-spacing-0 text-right text-[10px]">
                <thead className="sticky top-0 z-10 bg-emerald-900 text-white">
                  <tr><th rowSpan="2" className="border border-black px-2 py-1">SL</th><th rowSpan="2" className="border border-black px-2 py-1 text-left">Name of the party</th><th rowSpan="2" className="border border-black px-2 py-1">Last Month Dues</th><th colSpan="3" className="border border-black px-2 py-1 text-center">Present Month</th><th rowSpan="2" className="border border-black px-2 py-1">Last &amp; Present Net Sales</th><th colSpan="8" className="border border-black px-2 py-1 text-center">Present Month Collection &amp; Expenses</th></tr>
                  <tr>{['Sales', 'Return', 'Net Sales', 'Salary', 'অফিস পেমেন্ট', 'Collection', 'Fare', 'L/C', 'Total Expenses', 'Total Collection', 'Dues'].map((header) => <th key={header} className="border border-black px-2 py-1">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.parties.map((party) => (
                    <tr key={party.dealerId || `${party.dealerName}-${party.mobileNo}`} className="odd:bg-white even:bg-slate-50">
                      <td className="border border-black px-2 py-1">{party.slNo}</td><td className="border border-black px-2 py-1 text-left font-semibold">{party.dealerName}</td>
                      <td className="border border-black px-2 py-1">{amount(party.previousDue)}</td><td className="border border-black px-2 py-1">{amount(party.sales)}</td>
                      <td className="border border-black px-2 py-1">{amount(party.returns)}</td><td className="border border-black px-2 py-1">{amount(party.netSales)}</td>
                      <td className="border border-black px-2 py-1 font-semibold">{amount(party.previousPlusNetSales)}</td><td className="border border-black px-2 py-1">{amount(party.salary)}</td>
                      <td className="border border-black px-2 py-1">{amount(party.officePayment)}</td><td className="border border-black px-2 py-1">{amount(party.collection + party.invoicePaid)}</td>
                      <td className="border border-black px-2 py-1">{amount(party.fare)}</td><td className="border border-black px-2 py-1">{amount(party.lc)}</td>
                      <td className="border border-black px-2 py-1">{amount(party.officePayment + party.salary + party.fare + party.lc)}</td>
                      <td className="border border-black px-2 py-1 font-bold">{amount(party.totalCollection + party.invoicePaid)}</td>
                      <td className="border border-black px-2 py-1 font-bold text-rose-700">{amount(party.ledgerDues - party.invoicePaid)}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50 font-black text-slate-900">
                    <td className="border border-black px-2 py-1">—</td>
                    <td className="border border-black px-2 py-1 text-left">TOTAL</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.previousDue)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.sales)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.returns)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.netSales)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.previousPlusNetSales)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.salary)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.officePayment)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.collection + selectedPartyTotals.invoicePaid)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.fare)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.lc)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.totalExpenses)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.totalCollection + selectedPartyTotals.invoicePaid)}</td>
                    <td className="border border-black px-2 py-1">{amount(selectedPartyTotals.ledgerDues - selectedPartyTotals.invoicePaid)}</td>
                  </tr>
                  {!selected.parties.length && <tr><td colSpan="15" className="px-4 py-8 text-center text-slate-500">কোনো পার্টি লেনদেন পাওয়া যায়নি।</td></tr>}
                </tbody>
              </table>
            </TableFrame>
          </section>
        </>
      )}
    </main>
  );
}
