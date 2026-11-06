import React from 'react';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';
import { INVOICE_SESSIONS } from '../../../shared/sessions';

export default function InvoicePrintHeader({ invoice }) {
  if (!invoice) return null;

  return (
    <article className="invoice-print-sheet mx-auto max-w-4xl bg-white p-8 text-slate-900">
      <header className="border-b-2 border-emerald-700 pb-4 text-center">
        <div className="flex items-center justify-between gap-3">
          <img src="/logos/valid-logo.png" alt="Valid Agro" className="h-12 w-12 flex-none object-contain sm:h-16 sm:w-16" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড</h1>
            <p className="text-sm font-bold text-emerald-800 sm:text-base">এন্ড মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</p>
            <p className="text-xs text-slate-600">হেড অফিস ও ডিস্ট্রিবিউশন হাব: নিশিন্দারা, বগুড়া।</p>
            <p className="text-xs font-semibold text-slate-700">হটলাইনঃ 01867912167 • ডিস্ট্রিবিউশন হাব ও সেন্ট্রাল ইনভেন্টরি শাখা</p>
          </div>
          <img src="/logos/mahananda-logo.png" alt="Mahananda Agro" className="h-12 w-12 flex-none object-contain sm:h-16 sm:w-16" />
        </div>
        <div className="mx-auto mt-3 inline-block rounded-lg border-2 border-emerald-700 bg-emerald-50 px-5 py-2 text-center [print-color-adjust:exact]">
          <p className="text-xs font-bold text-emerald-800">সেশন</p>
          <p className="mt-0.5 text-base font-extrabold text-emerald-900 sm:text-lg">{invoice.session || INVOICE_SESSIONS[0]}</p>
        </div>
        <p className="mt-3 text-xl font-extrabold">বিক্রয় ইনভয়েস</p>
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
