import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Search,
  Calendar,
  User,
  PlusCircle,
  Eye,
  Edit,
  X,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';

export default function InvoiceList({ onNewInvoiceClick, onEditInvoice }) {
  const { invoices } = useAgro();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const filteredInvoices = invoices.filter((inv) => {
    return (
      inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.dealerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.officerCode && inv.officerCode.toString().includes(searchTerm)) ||
      inv.date.includes(searchTerm)
    );
  });

  const handlePrint = (inv) => {
    setSelectedInvoice(inv);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </span>
            সকল বিক্রয় চালান ও ইনভয়েস হিস্ট্রি
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            পূর্বে প্রস্তুতকৃত সকল চালান দেখা, সার্চ করা ও পুন:প্রিন্ট করার সুবিধা
          </p>
        </div>

        <button
          onClick={onNewInvoiceClick}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg font-bold text-xs shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>নতুন ইনভয়েস তৈরি করুন</span>
        </button>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 no-print">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ইনভয়েস নং, ডিলার নাম বা অফিসার দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
              <tr>
                <th className="py-3 px-3">চালান নং ও ধরন</th>
                <th className="py-3 px-3">তারিখ</th>
                <th className="py-3 px-3">ডিলার ও ঠিকানা</th>
                <th className="py-3 px-3 text-center">অফিসার কোড</th>
                <th className="py-3 px-3 text-center">মোট কার্টুন</th>
                <th className="py-3 px-3 text-right">মোট বিল (৳)</th>
                <th className="py-3 px-3 text-right">জমা (৳)</th>
                <th className="py-3 px-3 text-right">অবশিষ্ট বাকি (৳)</th>
                <th className="py-3 px-3 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3">
                    <div className="font-bold text-emerald-800 text-sm">
                      {toBn(inv.id)}
                    </div>
                    {inv.invoiceType === 'dealer_return' ? (
                      <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        ফেরত চালান
                      </span>
                    ) : inv.invoiceType === 'factory_damage' ? (
                      <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                        ড্যামেজ চালান
                      </span>
                    ) : (
                      <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                        রেগুলার বিক্রয়
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">
                    {toBnDate(inv.date)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-800">{inv.dealerName}</div>
                    <div className="text-[11px] text-slate-400">{inv.dealerAddress}</div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-xs border border-slate-200">
                      কোড: {toBn(inv.officerCode || '5')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-emerald-800">
                    {toBn(inv.totalCartons || inv.items?.reduce((s, it) => s + (Number(it.cartons) || 0), 0) || 0)} কাটুন
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800 text-sm">
                    ৳{toBnCurrency(inv.grandTotal)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    ৳{toBnCurrency(inv.paidAmount)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-rose-700">
                    ৳{toBnCurrency(inv.currentDue)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        title="চালান দেখুন"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onEditInvoice && onEditInvoice(inv)}
                        title="চালান এডিট / সংশোধন করুন"
                        className="bg-amber-50 hover:bg-amber-100 text-amber-800 p-1.5 rounded transition border border-amber-200"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handlePrint(inv)}
                        title="চালান প্রিন্ট করুন"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded transition border border-emerald-200"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    কোনো ইনভয়েসের তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal Preview */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 no-print">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                চালান কপি: #{selectedInvoice.id}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onEditInvoice) {
                      onEditInvoice(selectedInvoice);
                      setSelectedInvoice(null);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow hover:bg-amber-700"
                >
                  <Edit className="w-3.5 h-3.5" />
                  চালান এডিট করুন
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow hover:bg-emerald-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  প্রিন্ট
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Header with Both Logos */}
            <div className="border-b-2 border-emerald-800 pb-3">
              <div className="flex items-center justify-between mb-2">
                <img
                  src="/logos/valid-logo.png"
                  alt="Valid Agro"
                  className="h-16 w-auto object-contain"
                />
                <div className="text-center flex-1 px-4">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড
                  </h2>
                  <h3 className="text-sm sm:text-base font-bold text-emerald-800">
                    এন্ড মহানন্দা এগ্রো ইন্ডাস্ট্রিজ
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    হেড অফিস ও ডিস্ট্রিবিউশন ডিপো: নিশিন্দারা, বগুড়া। • হটলাইন: 01867912167
                  </p>
                  <div className="mt-1 inline-block px-3 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded text-xs border border-emerald-300">
                    {selectedInvoice.invoiceType === 'dealer_return'
                      ? 'ডিলার ফেরত / রিটার্ন চালান'
                      : selectedInvoice.invoiceType === 'factory_damage'
                      ? 'ফ্যাক্টরি ড্যামেজ / এক্সপায়ার এডজাস্টমেন্ট'
                      : 'ডিলার সেলস চালান ও ক্যাশ মেমো'}
                  </div>
                </div>
                <img
                  src="/logos/mahananda-logo.png"
                  alt="Mahananda Agro"
                  className="h-16 w-auto object-contain"
                />
              </div>
            </div>

            {/* Meta - Officer Code ONLY, NO officer name, Bengali numerals */}
            <div className="grid grid-cols-2 gap-4 text-xs py-3 border-b border-slate-200">
              <div className="space-y-1">
                <p><span className="font-bold">ডিলার কোড:</span> <span className="font-bold text-emerald-800">{toBn(selectedInvoice.dealerCode)}</span></p>
                <p><span className="font-bold">প্রতিষ্ঠানের নাম:</span> {selectedInvoice.dealerName}</p>
                {selectedInvoice.dealerProprietor && (
                  <p><span className="font-bold">প্রোপাইটর:</span> {selectedInvoice.dealerProprietor}</p>
                )}
                <p><span className="font-bold">ঠিকানা:</span> {selectedInvoice.dealerAddress}</p>
                <p><span className="font-bold">মোবাইল:</span> {toBn(selectedInvoice.dealerPhone)}</p>
              </div>
              <div className="space-y-1 text-right">
                <p><span className="font-bold">চালান নং:</span> <span className="font-black text-emerald-800 text-sm">{toBn(selectedInvoice.id)}</span></p>
                <p><span className="font-bold">তারিখ:</span> {toBnDate(selectedInvoice.date)}</p>
                <p className="bg-slate-100 inline-block px-2.5 py-0.5 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">অফিসার কোড:</span> <span className="font-black text-emerald-800">{toBn(selectedInvoice.officerCode || selectedInvoice.officerId?.replace('OFF-', '') || '5')}</span>
                </p>
                {selectedInvoice.transport && (
                  <p><span className="font-bold">পরিবহন:</span> {selectedInvoice.transport}</p>
                )}
              </div>
            </div>

            {/* Items Table: Exactly 8 columns requested by client in Bengali numerals */}
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-800 uppercase mb-1">সরবরাহকৃত পণ্য ও কার্টুন বিবরণী:</p>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="py-2 px-2 text-left w-7 border-r border-slate-200">নং</th>
                    <th className="py-2 px-2 text-left border-r border-slate-200">পণ্যের নাম</th>
                    <th className="py-2 px-2 text-left border-r border-slate-200">প্যাক সাইজ</th>
                    <th className="py-2 px-2 text-center border-r border-slate-200">কাটুন সংখ্যা</th>
                    <th className="py-2 px-2 text-right border-r border-slate-200">ট্রেড প্রইজ</th>
                    <th className="py-2 px-2 text-right border-r border-slate-200">মোট ট্রেড প্রাইজ</th>
                    <th className="py-2 px-2 text-center border-r border-slate-200">কমিশন(%)</th>
                    <th className="py-2 px-2 text-right border-r border-slate-200">কমিশন এ্যামাউন্ট</th>
                    <th className="py-2 px-2 text-right">নীট মূল্য</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedInvoice.items?.map((it, idx) => {
                    const cartons = Number(it.cartons) || 1;
                    const cartonPrice = Number(it.cartonPrice || (it.subtotal && it.cartons ? it.subtotal / it.cartons : it.unitPrice || 0));
                    const subtotal = it.subtotal ?? (cartons * cartonPrice);
                    const commPct = Number(it.commissionPercent) ?? 20;
                    const commAmt = it.commissionAmount ?? Math.round((subtotal * commPct) / 100);
                    const lineNetTotal = it.total ?? (subtotal - commAmt);

                    return (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="py-1.5 px-2 text-slate-600 border-r border-slate-200">{toBn(idx + 1)}</td>
                        <td className="py-1.5 px-2 font-bold text-slate-900 border-r border-slate-200">{it.productName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200">{it.size}</td>
                        <td className="py-1.5 px-2 text-center font-bold text-slate-900 border-r border-slate-200">{toBn(cartons)}</td>
                        <td className="py-1.5 px-2 text-right border-r border-slate-200">৳{toBnCurrency(cartonPrice)}</td>
                        <td className="py-1.5 px-2 text-right font-medium border-r border-slate-200">৳{toBnCurrency(subtotal)}</td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">{toBn(commPct)}%</td>
                        <td className="py-1.5 px-2 text-right text-rose-700 border-r border-slate-200">৳{toBnCurrency(commAmt)}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-emerald-900">৳{toBnCurrency(lineNetTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financials & Signatures */}
            <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-300 text-xs">
              <div>
                <p className="font-bold text-slate-700">মন্তব্য / নোট:</p>
                <p className="text-slate-500 italic mt-0.5">{selectedInvoice.note || 'মালামাল সঠিক কার্টুন সংখ্যায় বুঝিয়া পাইলাম।'}</p>
                <p className="font-bold text-slate-700 mt-2">পেমেন্ট মেথড: <span className="font-normal">{selectedInvoice.paymentMethod}</span></p>
                <p className="text-[11px] text-slate-400 mt-4 leading-tight">
                  * বিক্রিত পণ্য ডিলার কর্তৃক সঠিকভাবে বুঝে নেওয়া হলো।
                </p>
              </div>

              <div className="space-y-1 text-right font-medium">
                <div className="flex justify-between">
                  <span>মোট কাটুন:</span>
                  <span className="font-bold text-slate-900">{toBn(selectedInvoice.totalCartons || selectedInvoice.items?.reduce((s, it) => s + (Number(it.cartons) || 0), 0) || 0)} কাটুন</span>
                </div>
                <div className="flex justify-between">
                  <span>মোট ট্রেড প্রাইজ:</span>
                  <span>৳{toBnCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {(selectedInvoice.commissionAmount > 0 || selectedInvoice.discountAmount > 0) && (
                  <div className="flex justify-between text-emerald-700">
                    <span>ট্রেড কমিশন:</span>
                    <span>- ৳{toBnCurrency(selectedInvoice.commissionAmount || selectedInvoice.discountAmount)}</span>
                  </div>
                )}
                {selectedInvoice.returnAdjustmentTotal > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>ফেরত মাল সমন্বয় কর্তন:</span>
                    <span>- ৳{toBnCurrency(selectedInvoice.returnAdjustmentTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1">
                  <span>চালানের নিট বিল:</span>
                  <span className="font-bold text-emerald-800">৳{toBnCurrency(selectedInvoice.grandTotal)}</span>
                </div>
                {selectedInvoice.previousDue > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>পূর্বের বকেয়া:</span>
                    <span>+ ৳{toBnCurrency(selectedInvoice.previousDue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>নগদ / চেক জমা:</span>
                  <span>- ৳{toBnCurrency(selectedInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-rose-700 border-t-2 border-slate-300 pt-1">
                  <span>বর্তমান অবশিষ্ট বকেয়া:</span>
                  <span>৳{toBnCurrency(selectedInvoice.currentDue)}</span>
                </div>
              </div>
            </div>

            {/* Bottom Signatures: Exactly as requested by user */}
            <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
              <div className="border-t border-slate-500 pt-1.5 font-bold text-slate-800">
                পরিবেশক/পক্ষের স্বাক্ষর ও তাং
              </div>
              <div className="border-t border-slate-500 pt-1.5 font-bold text-slate-800">
                সেলস অফিসারের স্বাক্ষর ও তাং
              </div>
              <div className="border-t border-slate-500 pt-1.5 font-bold text-slate-800">
                কোম্পানীর পক্ষে লজিস্টিক অফিসারের স্বাক্ষর ও তাং
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
