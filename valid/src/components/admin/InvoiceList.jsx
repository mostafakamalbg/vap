import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus2, Pencil, Printer, Search, Trash2 } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';
import { formatInvoiceNumber } from '../../../shared/codes';
import {
  getInvoiceSessionForDate,
  INVOICE_SESSIONS,
  isCurrentSession,
  LEGACY_INVOICE_SESSION,
  sortSessionsNewestFirst
} from '../../../shared/sessions';
import { getPackageQuantityUnit } from '../../../shared/quantityUnits';
import { getInvoicePackageCount } from '../../../shared/invoiceCartons';
import { getInvoiceSalesAmount } from '../../../shared/invoiceTotals';
import { printInvoiceSheet } from '../../utils/printInvoice';
import InvoicePrintHeader from './InvoicePrintHeader';
import InvoiceGenerator from './InvoiceGenerator';
import { LOGISTIC_OFFICER_ROLE, SUPER_ADMIN_ROLE, isAdminRole } from '../../../shared/roles';

function getInvoiceSequence(invoice) {
  const match = String(invoice.invoiceNo || invoice.id || '').match(/^VAP-(\d{4})-(\d+)$/);
  return match ? Number(`${match[1]}${String(match[2]).padStart(8, '0')}`) : 0;
}

function toDamageInvoice(log) {
  return {
    id: log.id,
    invoiceNo: log.id,
    date: log.date,
    session: LEGACY_INVOICE_SESSION,
    invoiceType: 'factory_damage',
    dealerId: log.dealerId,
    dealerCode: log.dealerCode,
    dealerName: log.dealerName,
    dealerAddress: log.dealerAddress,
    dealerPhone: log.dealerPhone,
    officerId: log.officerId,
    officerCode: log.officerCode,
    officerName: log.officerName,
    items: [],
    returnAdjustments: [{
      productId: log.productId,
      productName: log.productName,
      sku: log.sku,
      size: log.size,
      packPerBox: log.packPerBox,
      quantity: log.quantityPieces,
      quantityPieces: log.quantityPieces,
      price: log.unitPrice,
      unitPrice: log.unitPrice,
      total: log.totalDamageValue,
      unit: log.unit
    }],
    returnAdjustmentTotal: log.totalDamageValue,
    totalAmount: 0,
    grandTotal: 0,
    dueAmount: 0,
    currentDue: 0,
    paidAmount: 0,
    paymentMethod: 'credit',
    note: [log.reason, log.action, log.note].filter(Boolean).join(' • ')
  };
}

export default function InvoiceList({ onNewInvoiceClick, initialInvoiceId = '' }) {
  const { invoices, damageLogs, deleteInvoice, currentUser } = useAgro();
  const canEditSales = isAdminRole(currentUser?.role)
    || currentUser?.role === LOGISTIC_OFFICER_ROLE;
  const canDeleteSales = currentUser?.role === SUPER_ADMIN_ROLE || currentUser?.isSuperAdmin;
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [serverInvoices, setServerInvoices] = useState([]);
  const [filterError, setFilterError] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const hasPeriodFilter = sessionFilter !== 'ALL' || monthFilter !== 'ALL' || Boolean(dateFilter);
  const sessions = useMemo(() => sortSessionsNewestFirst([
    ...INVOICE_SESSIONS,
    ...invoices.map((invoice) => invoice.session).filter(Boolean)
  ].filter(isCurrentSession)), [invoices]);
  const months = useMemo(() => [...new Set([
    ...invoices.map((invoice) => String(invoice.date || '').slice(0, 7)),
    ...damageLogs.map((entry) => String(entry.date || '').slice(0, 7))
  ].filter((month) => /^\d{4}-\d{2}$/.test(month) && month >= '2025-07'))].sort().reverse(), [damageLogs, invoices]);

  useEffect(() => {
    if (!hasPeriodFilter) {
      setServerInvoices([]);
      setFilterError('');
      setFilterLoading(false);
      return undefined;
    }
    let cancelled = false;
    const query = new URLSearchParams();
    if (sessionFilter !== 'ALL') query.set('session', sessionFilter);
    if (monthFilter !== 'ALL') query.set('month', monthFilter);
    if (dateFilter) query.set('date', dateFilter);
    setServerInvoices([]);
    setFilterLoading(true);
    setFilterError('');
    fetch(`/api/invoices?${query}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'ইনভয়েস ফিল্টার করা যায়নি।');
        return result;
      })
      .then((result) => { if (!cancelled) setServerInvoices(Array.isArray(result) ? result : []); })
      .catch((error) => {
        if (!cancelled) {
          setServerInvoices([]);
          setFilterError(error.message);
        }
      })
      .finally(() => { if (!cancelled) setFilterLoading(false); });
    return () => { cancelled = true; };
  }, [dateFilter, hasPeriodFilter, monthFilter, sessionFilter]);

  const printSelectedInvoice = () => {
    document.body.classList.add('print-invoice-only');
    try {
      printInvoiceSheet(document.querySelector('.invoice-print-preview .invoice-print-sheet'));
    } finally {
      document.body.classList.remove('print-invoice-only');
    }
  };
  const printInvoiceList = () => {
    document.body.classList.add('print-invoice-list-only');
    window.print();
    document.body.classList.remove('print-invoice-list-only');
  };
  const historySource = hasPeriodFilter ? serverInvoices : invoices;
  const historyRecords = useMemo(() => [
    ...historySource.map((invoice) => ({ type: 'invoice', record: invoice })),
    ...damageLogs.filter((log) => (
      (sessionFilter === 'ALL' || getInvoiceSessionForDate(log.date) === sessionFilter)
      && (monthFilter === 'ALL' || String(log.date || '').startsWith(monthFilter))
      && (!dateFilter || log.date === dateFilter)
    )).map((log) => ({ type: 'damage', record: log }))
  ].sort((a, b) => {
    const aSequence = a.type === 'invoice' ? getInvoiceSequence(a.record) : 0;
    const bSequence = b.type === 'invoice' ? getInvoiceSequence(b.record) : 0;
    if (aSequence && bSequence && aSequence !== bSequence) return bSequence - aSequence;
    const aTime = new Date(a.record.createdAt || a.record.date || 0).getTime() || aSequence;
    const bTime = new Date(b.record.createdAt || b.record.date || 0).getTime() || bSequence;
    return bTime - aTime;
  }), [dateFilter, damageLogs, historySource, monthFilter, sessionFilter]);
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return historyRecords;
    return historyRecords.filter(({ record }) => [
      record.id,
      record.invoiceNo,
      record.dealerName,
      record.officerName,
      record.session,
      record.productName
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [historyRecords, search]);
  const listedInvoices = filteredRecords.filter(({ type }) => type === 'invoice').map(({ record }) => record);
  const totalRegularAmount = listedInvoices.filter((invoice) => (
    !invoice.invoiceType || invoice.invoiceType === 'regular'
  )).reduce((sum, invoice) => sum + getInvoiceSalesAmount(invoice), 0);
  const totalReturnAmount = listedInvoices.filter((invoice) => invoice.invoiceType === 'dealer_return')
    .reduce((sum, invoice) => sum + getInvoiceSalesAmount(invoice), 0);
  const totalNetSales = totalRegularAmount - totalReturnAmount;
  const totalPackages = listedInvoices.reduce((sum, invoice) => sum + getInvoicePackageCount(invoice), 0);
  const totalDue = listedInvoices
    .filter((invoice) => !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType))
    .reduce((sum, invoice) => (
      sum + Math.max(0, getInvoiceSalesAmount(invoice) - (Number(invoice.paidAmount) || 0))
    ), 0);

  useEffect(() => {
    if (!initialInvoiceId) return;
    const invoice = invoices.find((entry) => entry.id === initialInvoiceId);
    if (invoice) setPrintInvoice(invoice);
  }, [initialInvoiceId, invoices]);

  const getCreatedAt = (invoice) => {
    const createdAt = invoice.createdAt
      ? new Date(invoice.createdAt)
      : new Date(`${invoice.date}T00:00:00.000Z`);
    return Number.isNaN(createdAt.valueOf()) ? null : createdAt;
  };
  const isWithinEditWindow = (invoice) => {
    const createdAt = getCreatedAt(invoice);
    if (!createdAt) return false;
    const age = Date.now() - createdAt.valueOf();
    return age >= 0 && age <= 15 * 24 * 60 * 60 * 1000;
  };
  const isWithinDeleteWindow = (invoice) => {
    const createdAt = getCreatedAt(invoice);
    if (!createdAt || createdAt.valueOf() > Date.now()) return false;
    const year = createdAt.getUTCFullYear();
    const month = createdAt.getUTCMonth() + 1;
    const day = createdAt.getUTCDate();
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const deadline = new Date(createdAt);
    deadline.setUTCFullYear(year, month, Math.min(day, lastDayOfMonth));
    return Date.now() <= deadline.valueOf();
  };
  const handleDelete = async (invoice) => {
    if (!window.confirm(`ইনভয়েস ${invoice.id} মুছে ফেলবেন? সংশ্লিষ্ট লেজার ও স্টকও সমন্বয় হবে।`)) return;
    const password = window.prompt('ইনভয়েস মুছতে আপনার অ্যাডমিন পাসওয়ার্ড দিন।');
    if (!password) return;
    setDeletingId(invoice.id);
    try {
      await deleteInvoice(invoice.id, password);
      if (printInvoice?.id === invoice.id) setPrintInvoice(null);
    } catch (error) {
      window.alert(error.message || 'ইনভয়েস মুছতে ব্যর্থ হয়েছে।');
    } finally {
      setDeletingId('');
    }
  };
  const beginInlineEdit = (invoice) => {
    if (!window.confirm(`ইনভয়েস ${invoice.id} সম্পাদনা খুলবেন? পরিবর্তন অনুমোদনের জন্য জমা হতে পারে।`)) return;
    setPrintInvoice(null);
    setEditingInvoiceId(invoice.id);
  };

  return (
    <div className="invoice-list-print mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ইনভয়েস তালিকা</h1>
          <p className="mt-1 text-sm text-slate-500">মোট ইনভয়েস: {toBn(listedInvoices.length)} • মোট রেগুলার চালান: {toBn(listedInvoices.filter((invoice) => !invoice.invoiceType || invoice.invoiceType === 'regular').length)} • মোট ফেরত চালান: {toBn(listedInvoices.filter((invoice) => invoice.invoiceType === 'dealer_return').length)} • ডেমেজ: {toBn(damageLogs.length)}</p>
        </div>
        <div className="no-print flex gap-2">
          <button type="button" onClick={printInvoiceList} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700">
            <Printer className="mr-2 inline h-4 w-4" /> প্রিন্ট তালিকা
          </button>
          {canEditSales && (
            <button type="button" onClick={onNewInvoiceClick} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">
              <FilePlus2 className="mr-2 inline h-4 w-4" /> নতুন ইনভয়েস
            </button>
          )}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ['মোট ইনভয়েস (চালান সংখ্যা)', listedInvoices.length],
          ['মোট রেগুলার ইনভয়েস (৳)', `৳${toBnCurrency(totalRegularAmount)}`],
          ['মোট ফেরত ইনভয়েস (৳)', `৳${toBnCurrency(totalReturnAmount)}`],
          ['নিট সেলস', `৳${toBnCurrency(totalNetSales)}`],
          ['মোট প্যাকেজ', totalPackages],
          ['বকেয়া', `৳${toBnCurrency(totalDue)}`]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{typeof value === 'number' ? toBn(value) : value}</p>
          </div>
        ))}
      </section>

      <label className="no-print flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Search className="h-5 w-5 text-slate-400" />
        <span className="sr-only">ইনভয়েস খুঁজুন</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ইনভয়েস, ডিলার, অফিসার বা সেশন খুঁজুন" className="w-full outline-none" />
      </label>

      <div className="no-print grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">সেশন
          <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="ALL">সকল সেশন</option>
            {sessions.map((session) => <option key={session} value={session}>{session}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">মাস
          <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="ALL">সকল মাস</option>
            {months.map((month) => <option key={month} value={month}>{month}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">তারিখ
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </label>
      </div>
      {filterError && <p role="alert" className="no-print rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{filterError}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-2">ইনভয়েস / তারিখ</th><th className="p-2">সেশন</th><th className="p-2">ডিলার</th>
              <th className="p-2">অফিসার</th><th className="p-2 text-right">রেগুলার ইনভয়েস মূল্য (৳)</th><th className="p-2 text-right">মোট ফেরত ইনভয়েস (৳)</th><th className="p-2 text-right">নিট সেলস</th><th className="p-2 text-right">মোট প্যাকেজ</th><th className="p-2 text-right">চালানের মূল্য (৳)</th><th className="p-2 text-right">চালানের বকেয়া (৳)</th><th className="no-print p-2">কাজ</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map(({ type, record }) => {
              const isDamage = type === 'damage';
              const invoice = isDamage ? toDamageInvoice(record) : record;
              const quantity = isDamage
                ? getPackageQuantityUnit(record) === 'কার্টুন'
                  ? `${toBn(Math.floor((Number(record.quantityPieces) || 0) / (Number(record.packPerBox) || 1)))} কার্টুন`
                  : `${toBn(record.quantityPieces)} ${getPackageQuantityUnit(record)}`
                : getInvoicePackageCount(invoice);
              const retailPieces = isDamage ? 0 : (invoice.items || [])
                .reduce((sum, item) => sum + (Number(item.retailPieces) || 0), 0);
              const isReturnInvoice = invoice.invoiceType === 'dealer_return';
              const isRegularInvoice = !invoice.invoiceType || invoice.invoiceType === 'regular';
              return (
              <React.Fragment key={`${type}-${record.id}`}>
              <tr className="border-t border-slate-100">
                <td className="p-2"><strong>{toBn(formatInvoiceNumber(invoice.invoiceNo || invoice.id))}</strong><p className="text-xs text-slate-500">{toBnDate(invoice.date)}</p>{isDamage && <span className="text-[10px] font-bold text-rose-700">ডেমেজ / ফেরত</span>}</td>
                <td className="p-2 font-semibold text-emerald-800">{invoice.session || 'সেশন নির্ধারিত নয়'}</td>
                <td className="p-2">{invoice.dealerName || invoice.dealerId}</td>
                <td className="p-2">{invoice.officerName || invoice.officerId}</td>
                <td className="p-2 text-right">{isRegularInvoice ? `৳${toBnCurrency(getInvoiceSalesAmount(invoice))}` : '—'}</td>
                <td className="p-2 text-right text-rose-700">{isReturnInvoice ? `৳${toBnCurrency(getInvoiceSalesAmount(invoice))}` : '—'}</td>
                <td className="p-2 text-right font-semibold">{isRegularInvoice
                  ? `৳${toBnCurrency(getInvoiceSalesAmount(invoice))}`
                  : isReturnInvoice
                    ? `− ৳${toBnCurrency(Math.abs(getInvoiceSalesAmount(invoice)))}`
                    : '—'}</td>
                <td className="p-2 text-right">
                  {isDamage
                    ? quantity
                    : `${toBn(quantity)}${retailPieces ? ` (${toBn(retailPieces)} পিস)` : ''}`}
                </td>
                <td className="p-2 text-right">৳{toBnCurrency(isDamage ? record.totalDamageValue : invoice.totalAmount ?? invoice.grandTotal)}</td>
                <td className="p-2 text-right text-rose-700">৳{toBnCurrency(isDamage || isReturnInvoice ? 0 : Math.max(0, getInvoiceSalesAmount(invoice) - (Number(invoice.paidAmount) || 0)))}</td>
                <td className="no-print p-2">
                  <div className="flex gap-1">
                    <button type="button" title="প্রিন্ট" onClick={() => setPrintInvoice(invoice)} className="rounded p-2 text-slate-600 hover:bg-slate-100"><Printer className="h-4 w-4" /></button>
                    {canEditSales && !isDamage && <button type="button" title={isWithinEditWindow(invoice) ? 'সারির ভেতরে সম্পাদনা' : 'ইনভয়েস তৈরির ১৫ দিনের পর সম্পাদনা করা যাবে না'} disabled={!isWithinEditWindow(invoice)} onClick={() => beginInlineEdit(invoice)} className="rounded p-2 text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Pencil className="h-4 w-4" /></button>}
                    {canDeleteSales && !isDamage && <button type="button" title={isWithinDeleteWindow(invoice) ? 'পাসওয়ার্ড দিয়ে মুছুন' : 'ইনভয়েস তৈরির এক মাস পর মুছতে পারবেন না'} disabled={!isWithinDeleteWindow(invoice) || deletingId === invoice.id} onClick={() => handleDelete(invoice)} className="rounded p-2 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
              {editingInvoiceId === invoice.id && !isDamage && (
                <tr className="border-t border-blue-100 bg-blue-50/40">
                  <td colSpan="11" className="p-3 sm:p-5">
                    <InvoiceGenerator
                      key={`inline-${invoice.id}`}
                      editInvoiceData={invoice}
                      onCancelEdit={() => setEditingInvoiceId('')}
                    />
                  </td>
                </tr>
              )}
              </React.Fragment>
              );
            })}
            {!filteredRecords.length && <tr><td colSpan="11" className="p-8 text-center text-slate-500">{filterLoading ? 'ইনভয়েস লোড হচ্ছে…' : 'কোনো ইনভয়েস পাওয়া যায়নি।'}</td></tr>}
          </tbody>
        </table>
      </div>

      {printInvoice && (
        <div className="invoice-print-preview fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="ইনভয়েস প্রিন্ট প্রিভিউ">
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="no-print flex justify-end gap-2">
              <button type="button" onClick={() => setPrintInvoice(null)} className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-700">বন্ধ করুন</button>
              <button type="button" onClick={printSelectedInvoice} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">
                <Printer className="mr-2 inline h-4 w-4" /> প্রিন্ট করুন
              </button>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 sm:p-6"><InvoicePrintHeader invoice={printInvoice} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
