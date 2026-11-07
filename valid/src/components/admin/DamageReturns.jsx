import React, { useState } from 'react';
import {
  RotateCcw,
  PlusCircle,
  AlertOctagon,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Building2,
  FileText
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { formatDealerCode, formatOfficerCode } from '../../../shared/codes';

function formatDamageQuantity(log, products) {
  const product = products.find((entry) => entry.id === log.productId);
  const variant = product?.variants.find((entry) => entry.sku === log.sku);
  const packSize = Number(log.packPerBox || variant?.packPerBox) || 1;
  const quantity = Number(log.quantityPieces) || 0;
  const unit = log.unit || variant?.unit || 'পিস/বোতল';
  return `${Math.floor(quantity / packSize)} কার্টুন ${quantity % packSize} ${unit}`;
}

export default function DamageReturns() {
  const { products, dealers, officers, damageLogs, recordDamageReturn } = useAgro();

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDealerFilter, setSelectedDealerFilter] = useState('ALL');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    dealerId: dealers[0]?.id || '',
    officerId: officers[0]?.id || '',
    productId: products[0]?.id || '',
    sku: products[0]?.variants[0]?.sku || '',
    quantityPieces: 2,
    reason: 'পরিবহনে বোতলের ক্যাপ ফেটে লিকেজ হয়েছিল',
    actionType: 'ledger_credit', // 'ledger_credit' or 'replaced_stock' or 'write_off'
    note: ''
  });

  // When product changes, update sku
  const handleProductChange = (prodId) => {
    const prod = products.find((p) => p.id === prodId);
    setForm({
      ...form,
      productId: prodId,
      sku: prod?.variants[0]?.sku || ''
    });
  };

  // When dealer changes, auto-set officer
  const handleDealerChange = (dlrId) => {
    const dlr = dealers.find((d) => d.id === dlrId);
    setForm({
      ...form,
      dealerId: dlrId,
      officerId: dlr?.assignedOfficerId || officers[0]?.id || ''
    });
  };

  // Submit Damage Entry
  const handleSubmit = (e) => {
    e.preventDefault();
    const dealer = dealers.find((d) => d.id === form.dealerId);
    const officer = officers.find((o) => o.id === form.officerId);
    const prod = products.find((p) => p.id === form.productId);
    const variant = prod?.variants.find((v) => v.sku === form.sku);

    const unitPrice = variant ? variant.tp : 0;
    const totalDamageValue = Number(form.quantityPieces) * unitPrice;

    let actionLabel = 'ডিলার লেজারে টাকা ক্রেডিট/মাইনাস করা হয়েছে';
    if (form.actionType === 'replaced_stock') {
      actionLabel = 'নতুন ফ্রেশ পন্য দিয়ে রিপ্লেসমেন্ট প্রদান করা হয়েছে';
    } else if (form.actionType === 'write_off') {
      actionLabel = 'কোম্পানি ক্ষতি হিসেবে রাইট-অফ করা হয়েছে';
    }

    const damageRecord = {
      date: form.date,
      dealerId: form.dealerId,
      dealerName: dealer?.shopName || 'ডিলার',
      officerId: form.officerId,
      officerName: officer?.name || 'অফিসার',
      productId: form.productId,
      productName: prod?.name || '',
      sku: form.sku,
      size: variant?.size || '',
      packPerBox: Number(variant?.packPerBox) || 1,
      unit: variant?.unit || 'পিস/বোতল',
      quantityPieces: Number(form.quantityPieces),
      unitPrice,
      totalDamageValue,
      reason: form.reason,
      action: actionLabel,
      actionType: form.actionType,
      note: form.note || 'ডিস্ট্রিবিউশন অফিসে ডেমেজ মাল জমা গৃহীত।'
    };

    recordDamageReturn(damageRecord);
    setSuccessMsg(`ডিলার ${dealer?.shopName} এর ${form.quantityPieces} টি ক্ষতিগ্রস্ত পণ্যের ফেরত সফলভাবে সংরক্ষিত হয়েছে!`);
    setTimeout(() => setSuccessMsg(''), 4500);

    setShowAddForm(false);
  };

  // Filter logs
  const filteredLogs = damageLogs.filter((log) => {
    const matchesDealer = selectedDealerFilter === 'ALL' || log.dealerId === selectedDealerFilter;
    const matchesSearch =
      log.dealerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.reason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDealer && matchesSearch;
  });

  // Calculate totals
  const damageQuantityTotals = damageLogs.reduce((totals, log) => {
    const quantity = Number(log.quantityPieces) || 0;
    const product = products.find((entry) => entry.id === log.productId);
    const variant = product?.variants.find((entry) => entry.sku === log.sku);
    const packSize = Number(log.packPerBox || variant?.packPerBox) || 1;
    totals.cartons += Math.floor(quantity / packSize);
    totals.looseUnits += quantity % packSize;
    return totals;
  }, { cartons: 0, looseUnits: 0 });
  const totalDamageFinancialValue = damageLogs.reduce((acc, curr) => acc + (Number(curr.totalDamageValue) || 0), 0);
  const totalAdjustedCredits = damageLogs
    .filter((d) => d.actionType === 'ledger_credit')
    .reduce((acc, curr) => acc + (Number(curr.totalDamageValue) || 0), 0);

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </span>
            ডেমেজ ও ক্ষতিগ্রস্ত পণ্য ফেরত ম্যানেজমেন্ট
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            ডিস্ট্রিবিউশন অফিস ডিপো • কোন ডিলার কি ডেমেজ ফেরত দিলো ও তার হিসাব সমন্বয়
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{showAddForm ? 'লিস্ট দেখুন' : 'নতুন ডেমেজ ফেরত এন্ট্রি'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-sm">{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট ডেমেজ ফেরত পণ্য</p>
            <p className="text-xl font-black text-rose-700 mt-1">
              {damageQuantityTotals.cartons.toLocaleString('bn-BD')} কার্টুন + {damageQuantityTotals.looseUnits.toLocaleString('bn-BD')} পিস/বোতল
            </p>
            <p className="mt-1 text-[10px] text-slate-500">প্যাক সাইজ অনুযায়ী অবশিষ্ট ইউনিটসহ</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট ডেমেজ আর্থিক ক্ষতি</p>
            <p className="text-2xl font-black text-slate-800 mt-1">৳{totalDamageFinancialValue.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <span className="font-bold">৳</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">ডিলার লেজারে সমন্বয়কৃত</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">৳{totalAdjustedCredits.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Form: Add Damage Return */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-rose-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              ডিলার হতে ডেমেজ পণ্য ফেরত রিসিভ ফর্ম
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ভাঙা, লিকেজ বা ক্ষতিগ্রস্ত মাল ফেরত নিলে ডিলারের বাকি থেকে সমন্বয় বা ফ্রেশ মাল রিপ্লেস করতে পারবেন
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">তারিখ</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ফেরতকারী ডিলার</label>
                <select
                  value={form.dealerId}
                  onChange={(e) => handleDealerChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  required
                >
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatDealerCode(d.code)} • {d.shopName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">দায়িত্বপ্রাপ্ত সেলস অফিসার</label>
                <select
                  value={form.officerId}
                  onChange={(e) => setForm({ ...form, officerId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  required
                >
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {formatOfficerCode(o.code, o.designation)} • {o.name} • {o.designation}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-rose-50/40 border border-rose-100 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ক্ষতিগ্রস্ত পণ্য</label>
                <select
                  value={form.productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">প্যাক সাইজ</label>
                <select
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  {products
                    .find((p) => p.id === form.productId)
                    ?.variants.map((v) => (
                      <option key={v.sku} value={v.sku}>
                        {v.size} (টিপি: ৳{v.tp})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ফেরত সংখ্যা (পিস/বোতল)</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantityPieces}
                  onChange={(e) => setForm({ ...form, quantityPieces: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-center text-rose-700"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ক্ষতির সুনির্দিষ্ট কারণ</label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="পরিবহনে বোতলের ক্যাপ ফেটে লিকেজ হয়েছিল">পরিবহনে বোতলের ক্যাপ ফেটে লিকেজ হয়েছিল</option>
                  <option value="কার্টুন ভিজে প্যাকেট নষ্ট ও পাউডার জমাট বাধা">কার্টুন ভিজে প্যাকেট নষ্ট ও পাউডার জমাট বাধা</option>
                  <option value="সিল ও বারকোড লেবেল ত্রুটি">সিল ও বারকোড লেবেল ত্রুটি</option>
                  <option value="মেয়াদোত্তীর্ণ পণ্য ফেরত (Expired Goods)">মেয়াদোত্তীর্ণ পণ্য ফেরত (Expired Goods)</option>
                  <option value="ফ্যাক্টরি গুণগত মান ত্রুটি">ফ্যাক্টরি গুণগত মান ত্রুটি</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">গৃহীত পদক্ষেপ (Action Type)</label>
                <select
                  value={form.actionType}
                  onChange={(e) => setForm({ ...form, actionType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  <option value="ledger_credit">ডিলার লেজারে টাকা ক্রেডিট / বাকি থেকে মাইনাস</option>
                  <option value="replaced_stock">নতুন ফ্রেশ পণ্য রিপ্লেসমেন্ট প্রদান (স্টক থেকে)</option>
                  <option value="write_off">কোম্পানির ড্যামেজ খাতে অবলোপন (Write-off)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">অতিরিক্ত নোট / গোডাউন মন্তব্য</label>
              <input
                type="text"
                placeholder="যেমন: ৩ বোতলের নমুনা ঢাকায় কোয়ালিটি ল্যাবে পাঠানো হয়েছে"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow transition"
              >
                ডেমেজ ফেরত এন্ট্রি সম্পন্ন করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Damage Return History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ডিলার, পণ্য বা ক্ষতির কারণ দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedDealerFilter}
              onChange={(e) => setSelectedDealerFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              <option value="ALL">সকল ডিলারের রিটার্ন</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.shopName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
              <tr>
                <th className="py-3 px-3">তারিখ ও আইডি</th>
                <th className="py-3 px-3">ডিলারের নাম ও এলাকা</th>
                <th className="py-3 px-3">ফেরত পণ্য ও সাইজ</th>
                <th className="py-3 px-3 text-center">পরিমাণ</th>
                <th className="py-3 px-3 text-right">আর্থিক মূল্য (৳)</th>
                <th className="py-3 px-3">ক্ষতির কারণ</th>
                <th className="py-3 px-3">গৃহীত পদক্ষেপ</th>
                <th className="py-3 px-3">অফিসার</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-slate-800">{log.id}</span>
                    <span className="block text-slate-400 text-[11px]">{log.date}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">
                    {log.dealerName}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-700">{log.productName}</span>
                    <span className="block text-slate-500 text-[11px]">{log.size}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-rose-700 font-mono text-sm">
                    {formatDamageQuantity(log, products)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                    ৳{(Number(log.totalDamageValue) || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-slate-600 max-w-[200px]">
                    {log.reason}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        log.actionType === 'ledger_credit'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    {log.officerName}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    কোনো ডেমেজ বা পণ্য ফেরতের রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
