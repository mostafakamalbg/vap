import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus2, Pencil, Printer, Search, Trash2 } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';
import { formatInvoiceNumber } from '../../../shared/codes';
import { LEGACY_INVOICE_SESSION } from '../../../shared/sessions';
import { getPackageQuantityUnit } from '../../../shared/quantityUnits';
import { printInvoiceSheet } from '../../utils/printInvoice';
import InvoicePrintHeader from './InvoicePrintHeader';

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

export default function InvoiceList({ onNewInvoiceClick, onEditInvoice, initialInvoiceId = '' }) {
  const { invoices, damageLogs, deleteInvoice } = useAgro();
  const [search, setSearch] = useState('');
  const [printInvoice, setPrintInvoice] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const printSelectedInvoice = () => {
    printInvoiceSheet(document.querySelector('.invoice-print-sheet'));
  };
  const historyRecords = useMemo(() => [
    ...invoices.map((invoice) => ({ type: 'invoice', record: invoice })),
    ...damageLogs.map((log) => ({ type: 'damage', record: log }))
  ].sort((a, b) => {
    const aSequence = a.type === 'invoice' ? getInvoiceSequence(a.record) : 0;
    const bSequence = b.type === 'invoice' ? getInvoiceSequence(b.record) : 0;
    if (aSequence && bSequence && aSequence !== bSequence) return bSequence - aSequence;
    const aTime = new Date(a.record.createdAt || a.record.date || 0).getTime() || aSequence;
    const bTime = new Date(b.record.createdAt || b.record.date || 0).getTime() || bSequence;
    return bTime - aTime;
  }), [damageLogs, invoices]);
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

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ইনভয়েস তালিকা</h1>
          <p className="mt-1 text-sm text-slate-500">মোট ইনভয়েস: {toBn(invoices.length)} • ডেমেজ/ফেরত: {toBn(damageLogs.length)}</p>
        </div>
        <button type="button" onClick={onNewInvoiceClick} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">
          <FilePlus2 className="mr-2 inline h-4 w-4" /> নতুন ইনভয়েস
        </button>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Search className="h-5 w-5 text-slate-400" />
        <span className="sr-only">ইনভয়েস খুঁজুন</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ইনভয়েস, ডিলার, অফিসার বা সেশন খুঁজুন" className="w-full outline-none" />
      </label>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3">ইনভয়েস / তারিখ</th><th className="p-3">সেশন</th><th className="p-3">ডিলার</th>
              <th className="p-3">অফিসার</th><th className="p-3 text-right">মোট প্যাকেজ</th><th className="p-3 text-right">মোট</th><th className="p-3 text-right">বকেয়া</th><th className="p-3">কাজ</th>
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
                : (invoice.items || []).reduce((sum, item) => sum + (Number(item.cartons ?? item.quantity) || 0), 0);
              return (
              <tr key={`${type}-${record.id}`} className="border-t border-slate-100">
                <td className="p-3"><strong>{toBn(formatInvoiceNumber(invoice.invoiceNo || invoice.id))}</strong><p className="text-xs text-slate-500">{toBnDate(invoice.date)}</p>{isDamage && <span className="text-[10px] font-bold text-rose-700">ডেমেজ / ফেরত</span>}</td>
                <td className="p-3 font-semibold text-emerald-800">{invoice.session || 'সেশন নির্ধারিত নয়'}</td>
                <td className="p-3">{invoice.dealerName || invoice.dealerId}</td>
                <td className="p-3">{invoice.officerName || invoice.officerId}</td>
                <td className="p-3 text-right">{isDamage ? quantity : toBn(quantity)}</td>
                <td className="p-3 text-right">৳{toBnCurrency(isDamage ? record.totalDamageValue : invoice.totalAmount ?? invoice.grandTotal)}</td>
                <td className="p-3 text-right text-rose-700">৳{toBnCurrency(isDamage ? 0 : invoice.dueAmount ?? invoice.currentDue)}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button type="button" title="প্রিন্ট" onClick={() => setPrintInvoice(invoice)} className="rounded p-2 text-slate-600 hover:bg-slate-100"><Printer className="h-4 w-4" /></button>
                    {!isDamage && onEditInvoice && <button type="button" title={isWithinEditWindow(invoice) ? 'সম্পাদনা' : 'ইনভয়েস তৈরির ১৫ দিনের পর সম্পাদনা করা যাবে না'} disabled={!isWithinEditWindow(invoice)} onClick={() => onEditInvoice(invoice)} className="rounded p-2 text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Pencil className="h-4 w-4" /></button>}
                    {!isDamage && <button type="button" title={isWithinDeleteWindow(invoice) ? 'পাসওয়ার্ড দিয়ে মুছুন' : 'ইনভয়েস তৈরির এক মাস পর মুছতে পারবেন না'} disabled={!isWithinDeleteWindow(invoice) || deletingId === invoice.id} onClick={() => handleDelete(invoice)} className="rounded p-2 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
              );
            })}
            {!filteredRecords.length && <tr><td colSpan="8" className="p-8 text-center text-slate-500">কোনো ইনভয়েস পাওয়া যায়নি।</td></tr>}
          </tbody>
        </table>
      </div>

      {printInvoice && (
        <section className="space-y-3">
          <div className="no-print flex justify-end">
            <button type="button" onClick={printSelectedInvoice} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">
              <Printer className="mr-2 inline h-4 w-4" /> প্রিন্ট করুন
            </button>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 sm:p-6"><InvoicePrintHeader invoice={printInvoice} /></div>
        </section>
      )}
    </div>
  );
}
