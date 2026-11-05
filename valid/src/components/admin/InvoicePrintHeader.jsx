import React from 'react';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';

export default function InvoicePrintHeader({ invoice }) {
  if (!invoice) return null;

  return (
    <article className="invoice-print-sheet mx-auto max-w-4xl bg-white p-8 text-slate-900">
      <header className="flex items-start justify-between gap-6 border-b-2 border-emerald-700 pb-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Valid Agro</p>
          <h1 className="mt-1 text-2xl font-extrabold">বিক্রয় ইনভয়েস</h1>
          <p className="mt-1 text-sm text-slate-600">Valid Agro Products Ltd. &amp; Mahananda Agro Industries</p>
        </div>
        <div className="rounded-lg border-2 border-emerald-700 bg-emerald-50 px-5 py-3 text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">সেশন</p>
          <p className="mt-1 text-lg font-extrabold text-emerald-900">{invoice.session || 'সেশন নির্ধারিত নয়'}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 py-5 text-sm sm:grid-cols-4">
        <div><p className="text-slate-500">ইনভয়েস নং</p><p className="font-bold">{toBn(invoice.invoiceNo || invoice.id)}</p></div>
        <div><p className="text-slate-500">তারিখ</p><p className="font-bold">{toBnDate(invoice.date)}</p></div>
        <div><p className="text-slate-500">সেলস অফিসার</p><p className="font-bold">{invoice.officerName || '—'}</p></div>
        <div><p className="text-slate-500">অফিসার আইডি</p><p className="font-bold">{toBn(invoice.officerCode || invoice.officerId || '—')}</p></div>
      </div>

      <section className="mb-5 rounded-lg bg-slate-50 p-4 text-sm">
        <h2 className="font-bold">ডিলার</h2>
        <p className="mt-1 font-semibold">{invoice.dealerName || '—'}</p>
        <p className="text-slate-600">{invoice.dealerAddress || ''}</p>
        <p className="text-slate-600">আইডি: {toBn(invoice.dealerCode || invoice.dealerId || '—')} {invoice.dealerPhone ? ` • ${toBn(invoice.dealerPhone)}` : ''}</p>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-emerald-800 text-left text-white">
              <th className="border border-emerald-800 p-2">পণ্য</th>
              <th className="border border-emerald-800 p-2">পরিমাণ</th>
              <th className="border border-emerald-800 p-2 text-right">একক মূল্য</th>
              <th className="border border-emerald-800 p-2 text-right">মোট</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, index) => (
              <tr key={`${item.sku || item.productId}-${index}`} className="odd:bg-white even:bg-slate-50">
                <td className="border border-slate-200 p-2">
                  <span className="font-semibold">{item.productName || 'পণ্য'}</span>
                  {item.size && <span className="ml-1 text-slate-500">({item.size})</span>}
                </td>
                <td className="border border-slate-200 p-2">{toBn(item.cartons ?? item.quantity)} কার্টন</td>
                <td className="border border-slate-200 p-2 text-right">৳{toBnCurrency(item.cartonPrice ?? item.unitPrice)}</td>
                <td className="border border-slate-200 p-2 text-right font-semibold">৳{toBnCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="ml-auto mt-5 w-full max-w-sm space-y-2 text-sm">
        <div className="flex justify-between"><span>মোট</span><strong>৳{toBnCurrency(invoice.subtotal ?? invoice.totalAmount ?? invoice.grandTotal)}</strong></div>
        {Number(invoice.commissionAmount) > 0 && (
          <div className="flex justify-between"><span>কমিশন</span><span>− ৳{toBnCurrency(invoice.commissionAmount)}</span></div>
        )}
        {Number(invoice.transportCost) > 0 && (
          <div className="flex justify-between"><span>পরিবহন</span><span>৳{toBnCurrency(invoice.transportCost)}</span></div>
        )}
        <div className="flex justify-between border-t border-slate-300 pt-2 text-base"><strong>মোট বিল</strong><strong>৳{toBnCurrency(invoice.totalAmount ?? invoice.grandTotal)}</strong></div>
        <div className="flex justify-between"><span>পরিশোধ</span><span>৳{toBnCurrency(invoice.paidAmount)}</span></div>
        <div className="flex justify-between text-rose-700"><strong>বকেয়া</strong><strong>৳{toBnCurrency(invoice.dueAmount ?? invoice.currentDue)}</strong></div>
      </section>

      {invoice.note && <p className="mt-6 border-t border-slate-200 pt-3 text-sm text-slate-600">নোট: {invoice.note}</p>}
      <footer className="mt-12 flex justify-between text-xs text-slate-500">
        <span>পণ্য গ্রহণকারীর স্বাক্ষর</span>
        <span>অনুমোদিত স্বাক্ষর</span>
      </footer>
    </article>
  );
}
