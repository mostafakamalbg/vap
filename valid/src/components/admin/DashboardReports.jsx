import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { INVOICE_SESSIONS, getInvoiceSessionForDate } from '../../../shared/sessions';
import { useAgro } from '../../context/AgroContext';

const currentMonth = new Date().toISOString().slice(0, 7);
const currentYear = String(new Date().getFullYear());
const amount = (value) => `৳${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
const number = (value) => Math.round(Number(value) || 0).toLocaleString('en-US');

async function requestReport(query) {
  const response = await fetch(`/api/dashboard-reports?${query}`, { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'রিপোর্ট লোড করা যায়নি।');
  return result;
}

function TableFrame({ children }) {
  return (
    <div className="max-h-[34rem] overflow-auto rounded-xl border border-slate-200">
      {children}
    </div>
  );
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
  const selected = officers.find((officer) => (
    officer.officerId === selectedOfficer || officer.officerCode === selectedOfficer
  )) || officers[0];
  const totals = officers.reduce((sum, officer) => ({
    target: sum.target + officer.julyDecemberTarget,
    lastDue: sum.lastDue + officer.lastDue,
    sales: sum.sales + officer.salesAmount,
    returns: sum.returns + officer.returnAmount,
    previousPlusNetSales: sum.previousPlusNetSales + officer.previousPlusNetSales,
    officePay: sum.officePay + officer.paymentAndExpense.officePay,
    fare: sum.fare + officer.paymentAndExpense.fare,
    salary: sum.salary + officer.paymentAndExpense.salary,
    lc: sum.lc + officer.paymentAndExpense.lc,
    received: sum.received + officer.totalReceivedAmount,
    dues: sum.dues + officer.totalAmountDues,
    netSales: sum.netSales + officer.totalNetSales,
    salesDues: sum.salesDues + officer.totalSalesDues
  }), {
    target: 0, lastDue: 0, sales: 0, returns: 0, previousPlusNetSales: 0,
    officePay: 0, fare: 0, salary: 0, lc: 0, received: 0, dues: 0,
    netSales: 0, salesDues: 0
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
    <main className="mx-auto max-w-[96rem] space-y-6 px-4 py-8">
      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-emerald-700 p-6 text-white shadow-lg sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Valid Agro Product Limited</p>
          <h1 className="mt-1 text-2xl font-black">লাইভ অফিসার পারফরম্যান্স রিপোর্ট</h1>
          <p className="mt-1 text-sm text-emerald-100">{periodLabel} • ইনভয়েস ও পেমেন্ট কালেকশন থেকে সরাসরি</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshIndex((index) => index + 1)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"
          aria-label="রিপোর্ট রিফ্রেশ করুন"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> রিফ্রেশ
        </button>
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
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
            <input type="month" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          ) : period === 'year' ? (
            <select value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {[...new Set([currentYear, ...INVOICE_SESSIONS.map((session) => session.match(/\d{4}/)?.[0]).filter(Boolean)])].sort().reverse().map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          ) : (
            <select value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {INVOICE_SESSIONS.slice().reverse().map((session) => <option key={session} value={session}>{session}</option>)}
            </select>
          )}
        </label>
        <label className="text-xs font-bold text-slate-600">
          অফিসার
          <select value={selectedOfficer} onChange={(event) => setSelectedOfficer(event.target.value)} disabled={currentUser?.role !== 'admin'} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100">
            {currentUser?.role === 'admin' && <option value="">সকল অফিসার (Top Sheet)</option>}
            {officers.map((officer) => (
              <option key={officer.officerId || officer.officerCode} value={officer.officerId || officer.officerCode}>
                {officer.officerName} {officer.officerCode ? `(${officer.officerCode})` : ''}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 p-4">
          <div>
            <h2 className="font-black text-slate-900">Officer / Session Summary Master Table</h2>
            <p className="text-xs text-slate-500">সকল অফিসারের সমন্বিত Top Sheet • নির্বাচিত সময়সীমা: {periodLabel}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{number(officers.length)} জন অফিসার</span>
        </div>
        <TableFrame>
          <table className="w-full min-w-[1800px] border-separate border-spacing-0 text-right text-xs">
            <thead className="sticky top-0 z-10 bg-emerald-900 text-white">
              <tr>
                <th rowSpan="2" className="sticky left-0 z-20 bg-emerald-900 px-3 py-3 text-center">SL</th>
                <th rowSpan="2" className="sticky left-12 z-20 bg-emerald-900 px-3 py-3 text-left">Officer Name</th>
                <th rowSpan="2" className="px-3 py-3">July-December {value.match(/\d{4}/)?.[0] || currentYear} Sales Target</th>
                <th rowSpan="2" className="px-3 py-3">Session Due / Last Due</th>
                <th rowSpan="2" className="px-3 py-3">Sales Amount (Tk)</th>
                <th rowSpan="2" className="px-3 py-3">Return Amount (Tk)</th>
                <th rowSpan="2" className="px-3 py-3">Previous + Net Sales (Tk)</th>
                <th colSpan="4" className="px-3 py-2 text-center">Payment &amp; Expense</th>
                <th rowSpan="2" className="px-3 py-3">Total Received Amount</th>
                <th rowSpan="2" className="px-3 py-3">Total Amount Dues</th>
                <th rowSpan="2" className="px-3 py-3">Total Net Sales</th>
                <th rowSpan="2" className="px-3 py-3">Total Sales Dues</th>
                <th rowSpan="2" className="px-3 py-3">Sales Percentage (%)</th>
                <th rowSpan="2" className="px-3 py-3">Payment Percentage (%)</th>
              </tr>
              <tr>
                <th className="px-3 py-2">Office Pay</th><th className="px-3 py-2">Fare</th>
                <th className="px-3 py-2">Salary</th><th className="px-3 py-2">L/C</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {officers.map((officer, index) => (
                <tr key={officer.officerId || officer.officerCode || officer.officerName} className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50">
                  <td className="sticky left-0 bg-inherit px-3 py-3 text-center font-bold">{index + 1}</td>
                  <td className="sticky left-12 bg-inherit px-3 py-3 text-left font-bold text-slate-900">{officer.officerName}<span className="block text-[10px] font-normal text-slate-500">{officer.officerCode}</span></td>
                  <td className="px-3 py-3">{amount(officer.julyDecemberTarget)}</td><td className="px-3 py-3">{amount(officer.lastDue)}</td>
                  <td className="px-3 py-3">{amount(officer.salesAmount)}</td><td className="px-3 py-3">{amount(officer.returnAmount)}</td>
                  <td className="px-3 py-3 font-semibold">{amount(officer.previousPlusNetSales)}</td>
                  <td className="px-3 py-3">{amount(officer.paymentAndExpense.officePay)}</td><td className="px-3 py-3">{amount(officer.paymentAndExpense.fare)}</td>
                  <td className="px-3 py-3">{amount(officer.paymentAndExpense.salary)}</td><td className="px-3 py-3">{amount(officer.paymentAndExpense.lc)}</td>
                  <td className="px-3 py-3 font-bold text-emerald-800">{amount(officer.totalReceivedAmount)}</td>
                  <td className="px-3 py-3 font-bold text-rose-700">{amount(officer.totalAmountDues)}</td>
                  <td className="px-3 py-3 font-bold">{amount(officer.totalNetSales)}</td><td className="px-3 py-3">{amount(officer.totalSalesDues)}</td>
                  <td className="px-3 py-3">{officer.salesPercentage}%</td><td className="px-3 py-3">{officer.paymentPercentage}%</td>
                </tr>
              ))}
              <tr className="sticky bottom-0 bg-emerald-50 font-black text-slate-900">
                <td colSpan="2" className="sticky left-0 bg-emerald-50 px-3 py-3 text-left">TOTAL</td>
                <td className="px-3 py-3">{amount(totals.target)}</td><td className="px-3 py-3">{amount(totals.lastDue)}</td>
                <td className="px-3 py-3">{amount(totals.sales)}</td><td className="px-3 py-3">{amount(totals.returns)}</td>
                <td className="px-3 py-3">{amount(totals.previousPlusNetSales)}</td><td className="px-3 py-3">{amount(totals.officePay)}</td>
                <td className="px-3 py-3">{amount(totals.fare)}</td><td className="px-3 py-3">{amount(totals.salary)}</td>
                <td className="px-3 py-3">{amount(totals.lc)}</td><td className="px-3 py-3">{amount(totals.received)}</td>
                <td className="px-3 py-3">{amount(totals.dues)}</td><td className="px-3 py-3">{amount(totals.netSales)}</td>
                <td className="px-3 py-3">{amount(totals.salesDues)}</td><td className="px-3 py-3">—</td><td className="px-3 py-3">—</td>
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
              ['Yearly Target', amount(selected.yearlyTarget)],
              ['Session Target', amount(selected.sessionTarget)],
              ['Sales Achievement', `${amount(selected.totalNetSales)} • ${selected.salesPercentage}%`],
              ['Total Invoices', number(selected.invoiceCount)],
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

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="font-black text-slate-900">Party / Mobile &amp; Transaction Details — {selected.officerName}</h2>
              <p className="text-xs text-slate-500">পূর্বের ব্যালেন্স এবং নির্বাচিত সময়সীমার চালান ও পেমেন্টের লাইভ হিসাব</p>
            </div>
            <TableFrame>
              <table className="w-full min-w-[1450px] border-separate border-spacing-0 text-right text-xs">
                <thead className="sticky top-0 z-10 bg-slate-800 text-white"><tr>
                  {['SL', 'Mobile No', 'Previous Dues', 'Sales Amount (Tk)', 'Return Goods (Tk)', 'Actual Sales (Tk)', 'Salary', 'Depot', 'Fare', 'L/C', 'Received (Amount Tk)', 'Dues'].map((header) => <th key={header} className="px-3 py-3">{header}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.parties.map((party) => (
                    <tr key={party.dealerId || `${party.dealerName}-${party.mobileNo}`} className="odd:bg-white even:bg-slate-50">
                      <td className="px-3 py-3">{party.slNo}</td><td className="px-3 py-3 text-left">{party.mobileNo || '—'}</td>
                      <td className="px-3 py-3">{amount(party.previousDue)}</td><td className="px-3 py-3">{amount(party.sales)}</td>
                      <td className="px-3 py-3">{amount(party.returns)}</td><td className="px-3 py-3 font-bold">{amount(party.netSales)}</td>
                      <td className="px-3 py-3">{amount(party.salary)}</td><td className="px-3 py-3">{amount(party.officePay)}</td>
                      <td className="px-3 py-3">{amount(party.fare)}</td><td className="px-3 py-3">{amount(party.lc)}</td>
                      <td className="px-3 py-3 font-bold text-emerald-800">{amount(party.actualReceived)}</td>
                      <td className="px-3 py-3 font-bold text-rose-700">{amount(party.dues)}</td>
                    </tr>
                  ))}
                  {!selected.parties.length && <tr><td colSpan="12" className="px-4 py-8 text-center text-slate-500">কোনো পার্টি লেনদেন পাওয়া যায়নি।</td></tr>}
                </tbody>
              </table>
            </TableFrame>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="font-black text-slate-900">Monthly Party-wise Ledger — Name of the party</h2>
              <p className="text-xs text-slate-500">Present Month: {periodLabel} • Salary, collection, fare এবং L/C সহ রিপোর্ট শিট</p>
            </div>
            <TableFrame>
              <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-right text-xs">
                <thead className="sticky top-0 z-10 bg-slate-800 text-white">
                  <tr><th rowSpan="2" className="px-3 py-3">SL</th><th rowSpan="2" className="px-3 py-3 text-left">Name of the party</th><th rowSpan="2" className="px-3 py-3">Last Month Dues</th><th colSpan="3" className="px-3 py-2 text-center">Present Month</th><th rowSpan="2" className="px-3 py-3">Last &amp; Present Net Sales</th><th colSpan="6" className="px-3 py-2 text-center">Present Month Collection &amp; Expenses</th></tr>
                  <tr>{['Sales', 'Return', 'Net Sales', 'Salary', 'Collection', 'Fare', 'L/C', 'Total Collection', 'Dues'].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.parties.map((party) => (
                    <tr key={party.dealerId || `${party.dealerName}-${party.mobileNo}`} className="odd:bg-white even:bg-slate-50">
                      <td className="px-3 py-3">{party.slNo}</td><td className="px-3 py-3 text-left font-semibold">{party.dealerName}</td>
                      <td className="px-3 py-3">{amount(party.previousDue)}</td><td className="px-3 py-3">{amount(party.sales)}</td>
                      <td className="px-3 py-3">{amount(party.returns)}</td><td className="px-3 py-3">{amount(party.netSales)}</td>
                      <td className="px-3 py-3 font-semibold">{amount(party.previousPlusNetSales)}</td><td className="px-3 py-3">{amount(party.salary)}</td>
                      <td className="px-3 py-3">{amount(party.collection + party.invoicePaid)}</td><td className="px-3 py-3">{amount(party.fare)}</td>
                      <td className="px-3 py-3">{amount(party.lc)}</td><td className="px-3 py-3 font-bold">{amount(party.totalCollection + party.invoicePaid)}</td>
                      <td className="px-3 py-3 font-bold text-rose-700">{amount(party.ledgerDues - party.invoicePaid)}</td>
                    </tr>
                  ))}
                  {!selected.parties.length && <tr><td colSpan="13" className="px-4 py-8 text-center text-slate-500">কোনো পার্টি লেনদেন পাওয়া যায়নি।</td></tr>}
                </tbody>
              </table>
            </TableFrame>
          </section>
        </>
      )}
    </main>
  );
}
