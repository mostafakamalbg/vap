import React, { useMemo, useState } from 'react';
import { FilePlus2, Pencil, Printer, Search, Trash2 } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';
import InvoicePrintHeader from './InvoicePrintHeader';

export default function InvoiceList({ onNewInvoiceClick, onEditInvoice }) {
  const { invoices, deleteInvoice } = useAgro();
  const [search, setSearch] = useState('');
  const [printInvoice, setPrintInvoice] = useState(null);
  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((invoice) => [
      invoice.id,
      invoice.dealerName,
      invoice.officerName,
      invoice.session
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [invoices, search]);

  const handleDelete = (invoice) => {
    if (!window.confirm(`ইনভয়েস ${invoice.id} মুছে ফেলবেন?`)) return;
    deleteInvoice(invoice.id);
    if (printInvoice?.id === invoice.id) setPrintInvoice(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ইনভয়েস তালিকা</h1>
          <p className="mt-1 text-sm text-slate-500">মোট ইনভয়েস: {toBn(invoices.length)}</p>
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
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3">ইনভয়েস / তারিখ</th><th className="p-3">সেশন</th><th className="p-3">ডিলার</th>
              <th className="p-3">অফিসার</th><th className="p-3 text-right">মোট</th><th className="p-3 text-right">বকেয়া</th><th className="p-3">কাজ</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-slate-100">
                <td className="p-3"><strong>{toBn(invoice.id)}</strong><p className="text-xs text-slate-500">{toBnDate(invoice.date)}</p></td>
                <td className="p-3 font-semibold text-emerald-800">{invoice.session || 'সেশন নির্ধারিত নয়'}</td>
                <td className="p-3">{invoice.dealerName || invoice.dealerId}</td>
                <td className="p-3">{invoice.officerName || invoice.officerId}</td>
                <td className="p-3 text-right">৳{toBnCurrency(invoice.totalAmount ?? invoice.grandTotal)}</td>
                <td className="p-3 text-right text-rose-700">৳{toBnCurrency(invoice.dueAmount ?? invoice.currentDue)}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button type="button" title="প্রিন্ট" onClick={() => setPrintInvoice(invoice)} className="rounded p-2 text-slate-600 hover:bg-slate-100"><Printer className="h-4 w-4" /></button>
                    {onEditInvoice && <button type="button" title="সম্পাদনা" onClick={() => onEditInvoice(invoice)} className="rounded p-2 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button>}
                    <button type="button" title="মুছুন" onClick={() => handleDelete(invoice)} className="rounded p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredInvoices.length && <tr><td colSpan="7" className="p-8 text-center text-slate-500">কোনো ইনভয়েস পাওয়া যায়নি।</td></tr>}
          </tbody>
        </table>
      </div>

      {printInvoice && (
        <section className="space-y-3">
          <div className="no-print flex justify-end">
            <button type="button" onClick={() => window.print()} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">
              <Printer className="mr-2 inline h-4 w-4" /> প্রিন্ট / PDF
            </button>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 sm:p-6"><InvoicePrintHeader invoice={printInvoice} /></div>
        </section>
      )}
    </div>
  );
}
