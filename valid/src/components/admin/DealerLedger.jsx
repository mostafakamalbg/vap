import React, { useState } from 'react';
import {
  Users,
  PlusCircle,
  CreditCard,
  Search,
  Printer,
  CheckCircle,
  FileText,
  Phone,
  MapPin,
  TrendingDown,
  TrendingUp,
  X,
  AlertCircle,
  Plus
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import {
  formatDealerCode,
  formatOfficerCode,
  getNextDealerCode,
  normalizeOfficerCode
} from '../../../shared/codes';
import {
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  normalizePaymentMethod,
  normalizePaymentType
} from '../../../shared/paymentMethods';

function findDealerOfficer(dealer, officers) {
  const assignedCode = normalizeOfficerCode(
    dealer?.assignedOfficerCode || dealer?.officerCode
  );
  return officers.find((officer) => (
    officer.id === dealer?.assignedOfficerId
    || officer.officerId === dealer?.assignedOfficerId
    || Boolean(assignedCode)
      && normalizeOfficerCode(officer.code, officer.designation) === assignedCode
  ));
}

export default function DealerLedger() {
  const {
    dealers,
    officers,
    addNewDealer,
    addDealerPayment,
    getDealerSummary,
    invoices,
    payments
  } = useAgro();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDealerModal, setShowAddDealerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDealerForLedger, setSelectedDealerForLedger] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    dealerId: dealers[0]?.id || '',
    officerId: officers[0]?.id || '',
    paymentMethod: 'cash',
    reference: '',
    receivedBy: 'ক্যাশিয়ার, নিশিন্দারা বগুড়া',
    note: '',
    entries: [{ paymentType: 'dealer_collection', amount: '' }]
  });

  // New Dealer Form State
  const [newDealerForm, setNewDealerForm] = useState({
    code: '',
    shopName: '',
    proprietor: '',
    zone: 'পীরগঞ্জ',
    address: 'পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '',
    assignedOfficerId: officers[0]?.id || '',
    creditLimit: 500000,
    openingDue: 0
  });

  // Calculate summaries for all dealers
  const dealerSummaries = dealers.map((d) => getDealerSummary(d.id));

  // Totals
  const totalSalesToDealers = dealerSummaries.reduce((acc, curr) => acc + (curr?.totalPurchases || 0), 0);
  const totalPaidByDealers = dealerSummaries.reduce((acc, curr) => acc + (curr?.totalPaid || 0), 0);
  const totalOutstandingDue = dealerSummaries.reduce((acc, curr) => acc + (curr?.currentDue || 0), 0);

  // Filter dealers
  const filteredSummaries = dealerSummaries.filter((d) => {
    if (!d) return false;
    return (
      d.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.proprietor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDealerCode(d.code).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.zone && d.zone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      d.phone.includes(searchTerm) ||
      d.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Open Payment modal for specific dealer
  const handleOpenPayment = (dealerId) => {
    if (!dealerId) return;
    const d = dealers.find((dl) => dl.id === dealerId);
    setPaymentForm({
      date: new Date().toISOString().slice(0, 10),
      dealerId,
      officerId: findDealerOfficer(d, officers)?.id || officers[0]?.id || '',
      paymentMethod: 'cash',
      reference: `MR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      receivedBy: 'ক্যাশিয়ার, নিশিন্দারা বগুড়া',
      note: '',
      entries: [{ paymentType: 'dealer_collection', amount: '' }]
    });
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    const invalidEntry = paymentForm.entries.some((entry) => (
      !Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0
    ));
    if (!paymentForm.entries.length || invalidEntry) {
      alert('প্রতিটি পেমেন্টের সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    const d = dealers.find((dl) => dl.id === paymentForm.dealerId);
    const o = officers.find((of) => of.id === paymentForm.officerId);

    paymentForm.entries.forEach((entry) => {
      const paymentType = normalizePaymentType(entry.paymentType);
      addDealerPayment({
        date: paymentForm.date,
        paymentType,
        dealerId: paymentForm.dealerId,
        dealerName: d?.shopName || 'ডিলার',
        officerId: paymentForm.officerId,
        officerCode: o?.code || '',
        officerName: o?.name || 'অফিসার',
        amount: Number(entry.amount),
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference || 'নগদ রসিদ',
        receivedBy: paymentForm.receivedBy,
        note: paymentForm.note || PAYMENT_TYPES.find((type) => type.value === paymentType)?.label || ''
      });
    });

    const total = paymentForm.entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    setSuccessMsg(`${d?.shopName || 'ডিলার'}-এর ${paymentForm.entries.length}টি আলাদা পেমেন্ট পোস্টিং, মোট ৳${total.toLocaleString()} সংরক্ষণ হয়েছে।`);
    setTimeout(() => setSuccessMsg(''), 4500);
    setShowPaymentModal(false);
  };

  // Submit New Dealer
  const handleNewDealerSubmit = (e) => {
    e.preventDefault();
    if (!newDealerForm.shopName) {
      alert('প্রতিষ্ঠানের নাম আবশ্যক');
      return;
    }

    addNewDealer({
      ...newDealerForm,
      creditLimit: Number(newDealerForm.creditLimit) || 0,
      openingDue: Number(newDealerForm.openingDue) || 0
    });

    setSuccessMsg(`নতুন ডিলার "${newDealerForm.shopName}" সফলভাবে তালিকায় যুক্ত হয়েছে!`);
    setTimeout(() => setSuccessMsg(''), 4500);

    setNewDealerForm({
      shopName: '',
      proprietor: '',
      address: 'বগুড়া সদর',
      phone: '',
      assignedOfficerId: officers[0]?.id || '',
      creditLimit: 500000,
      openingDue: 0
    });
    setShowAddDealerModal(false);
  };

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </span>
            ডিলার হিসাব ও বাকি-বকেয়া লেজার
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            কোন ডিলার কত টাকা দিলো, কত টাকা বাকি থাকলো এবং সম্পূর্ণ খতিয়ান বিবরণী
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddDealerModal(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>নতুন ডিলার নিবন্ধন</span>
          </button>

          <button
            onClick={() => handleOpenPayment(dealers[0]?.id)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition"
          >
            <CreditCard className="w-4 h-4" />
            <span>টাকা জমা নিন (Payment)</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2 no-print">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-sm">{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট চালানের মাল বিক্রি</p>
            <p className="text-2xl font-black text-slate-800 mt-1">৳{totalSalesToDealers.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট আদায়কৃত টাকা (পরিশোধ)</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">৳{totalPaidByDealers.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">ডিলারদের নিকট মোট বকেয়া (বাকি)</p>
            <p className="text-2xl font-black text-rose-600 mt-1">৳{totalOutstandingDue.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dealers Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 no-print">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="দোকানের নাম, প্রোপাইটর, মোবাইল বা এলাকা দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
              <tr>
                <th className="py-3 px-3">ডিলার কোড</th>
                <th className="py-3 px-3">প্রতিষ্ঠান ও মালিকের নাম</th>
                <th className="py-3 px-3">ঠিকানা ও মোবাইল</th>
                <th className="py-3 px-3">দায়িত্বপ্রাপ্ত অফিসার</th>
                <th className="py-3 px-3 text-right">মোট ক্রয় (৳)</th>
                <th className="py-3 px-3 text-right">মোট পরিশোধ (৳)</th>
                <th className="py-3 px-3 text-right">ডেমেজ সমন্বয় (৳)</th>
                <th className="py-3 px-3 text-right">অবশিষ্ট বকেয়া (৳)</th>
                <th className="py-3 px-3 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSummaries.map((d) => {
                const assignedOfficer = findDealerOfficer(d, officers);
                const hasDue = d.currentDue > 0;

                return (
                  <tr key={d.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <span className="inline-block bg-emerald-100 text-emerald-900 font-mono font-bold px-2 py-0.5 rounded text-xs">
                        {formatDealerCode(d.code || d.id)}
                      </span>
                      {d.zone && <span className="block text-[10px] text-slate-400 mt-0.5">{d.zone}</span>}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800 text-sm">{d.shopName}</div>
                      <div className="text-[11px] text-slate-500">প্রোপাইটর: {d.proprietor}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      <div>{d.address}</div>
                      <div className="text-[11px] font-mono text-emerald-700">{d.phone}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {assignedOfficer?.name || '-'}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                      ৳{d.totalPurchases.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      ৳{d.totalPaid.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-500">
                      {d.damageCredits > 0 ? `৳${d.damageCredits.toLocaleString()}` : '-'}
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md font-extrabold text-sm ${
                          hasDue ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        ৳{d.currentDue.toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenPayment(d.id)}
                          title="টাকা জমা নিন"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold border border-emerald-200 transition"
                        >
                          পেমেন্ট
                        </button>

                        <button
                          onClick={() => setSelectedDealerForLedger(d)}
                          title="বিস্তারিত খতিয়ান দেখুন"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-semibold transition"
                        >
                          খতিয়ান
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Payment Collection */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-700" />
                ডিলার লেনদেন / আয়-ব্যয় পোস্টিং
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">তারিখ</label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ডিলার নির্বাচন</label>
                  <select
                    value={paymentForm.dealerId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, dealerId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-semibold"
                  >
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.shopName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-700">একই দিনে হওয়া আলাদা পেমেন্ট পোস্টিং</p>
                  <button
                    type="button"
                    onClick={() => setPaymentForm((previous) => ({
                      ...previous,
                      entries: [...previous.entries, { paymentType: 'dealer_collection', amount: '' }]
                    }))}
                    className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> আরেকটি ধরন
                  </button>
                </div>
                {paymentForm.entries.map((entry, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="font-semibold text-slate-600">
                      পেমেন্টের ধরন
                      <select
                        value={entry.paymentType}
                        onChange={(event) => setPaymentForm((previous) => ({
                          ...previous,
                          entries: previous.entries.map((row, rowIndex) => (
                            rowIndex === index ? { ...row, paymentType: event.target.value } : row
                          ))
                        }))}
                        className="mt-1 w-full rounded border border-slate-300 bg-slate-50 p-2"
                      >
                        {PAYMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="font-semibold text-slate-600">
                      টাকার পরিমাণ (৳)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={entry.amount}
                        onChange={(event) => setPaymentForm((previous) => ({
                          ...previous,
                          entries: previous.entries.map((row, rowIndex) => (
                            rowIndex === index ? { ...row, amount: event.target.value } : row
                          ))
                        }))}
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 font-bold"
                        required
                      />
                    </label>
                    <button
                      type="button"
                      disabled={paymentForm.entries.length === 1}
                      onClick={() => setPaymentForm((previous) => ({
                        ...previous,
                        entries: previous.entries.filter((_, rowIndex) => rowIndex !== index)
                      }))}
                      aria-label="পেমেন্টের ধরন সরান"
                      className="self-end rounded p-2 text-rose-700 disabled:opacity-30"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-slate-500">প্রতিটি সারি আলাদা রেকর্ড হবে। বেতন, গাড়ি ভাড়া ও LC কমিশন ডিলারের বকেয়া কমাবে না।</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">পেমেন্ট মেথড</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  >
                    {PAYMENT_METHODS.filter((method) => method.value !== 'credit').map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">মানি রসিদ / চেক / ট্রানজেকশন নং</label>
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">দায়িত্বপ্রাপ্ত অফিসার</label>
                  <select
                    value={paymentForm.officerId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, officerId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  >
                    <option value="">অফিসার নির্বাচন করুন</option>
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {formatOfficerCode(o.code, o.designation)} • {o.name} • {o.designation}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">রিসিভ করেছেন</label>
                  <input
                    type="text"
                    value={paymentForm.receivedBy}
                    onChange={(e) => setPaymentForm({ ...paymentForm, receivedBy: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">মন্তব্য / নোট</label>
                <input
                  type="text"
                  placeholder="যেমন: ইসলামী ব্যাংক বগুড়া শাখায় জমা"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded text-xs font-bold shadow"
                >
                  টাকা জমা কনফার্ম করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Dealer */}
      {showAddDealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-700" />
                নতুন ডিলার বা কাস্টমার নিবন্ধন
              </h3>
              <button onClick={() => setShowAddDealerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNewDealerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ডিলার কোড *</label>
                  <input
                    type="text"
                    placeholder="DL-09"
                    value={getNextDealerCode(dealers)}
                    readOnly
                    className="w-full bg-slate-100 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-emerald-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1">দোকান / প্রতিষ্ঠানের নাম *</label>
                  <input
                    type="text"
                    placeholder="যেমন: সততা এগ্রো ভান্ডার"
                    value={newDealerForm.shopName}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, shopName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">প্রোপাইটর / মালিকের নাম</label>
                  <input
                    type="text"
                    placeholder="মালিকের নাম"
                    value={newDealerForm.proprietor}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, proprietor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="text"
                    placeholder="017xxxxxxxx"
                    value={newDealerForm.phone}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ঠিকানা / বাজার এলাকা</label>
                  <input
                    type="text"
                    placeholder="বাজার, উপজেলা, বগুড়া"
                    value={newDealerForm.address}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">দায়িত্বপ্রাপ্ত অফিসার</label>
                  <select
                    value={newDealerForm.assignedOfficerId}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, assignedOfficerId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  >
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {formatOfficerCode(o.code, o.designation)} • {o.name} • {o.designation}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ক্রেডিট লিমিট (৳)</label>
                  <input
                    type="number"
                    value={newDealerForm.creditLimit}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, creditLimit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">পূর্বের প্রারম্ভিক বাকি (Opening Due)</label>
                  <input
                    type="number"
                    value={newDealerForm.openingDue}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, openingDue: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-rose-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddDealerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded text-xs font-bold shadow"
                >
                  ডিলার সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Detailed Ledger Statement (Printable) */}
      {selectedDealerForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="dealer-ledger-print bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 no-print">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                ডিলার খতিয়ান ও লেনদেন বিবরণী
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow hover:bg-emerald-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  প্রিন্ট খতিয়ান
                </button>
                <button
                  onClick={() => setSelectedDealerForLedger(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Ledger Header */}
            <div className="text-center border-b border-emerald-800 pb-3">
              <h2 className="text-xl font-black text-slate-900">ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড</h2>
              <p className="text-xs text-emerald-800 font-bold">মহানন্দা এগ্রো ইন্ডাস্ট্রিজ • নিশিন্দারা, বগুড়া</p>
              <div className="mt-2 inline-block bg-slate-100 text-slate-800 border border-slate-300 px-3 py-0.5 rounded text-xs font-bold">
                ডিলার লেজার ও বাকি হিসাব বিবরণী
              </div>
            </div>

            {/* Dealer Info Bar */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <p><span className="font-bold">প্রতিষ্ঠান:</span> {selectedDealerForLedger.shopName}</p>
                <p><span className="font-bold">প্রোপাইটর:</span> {selectedDealerForLedger.proprietor}</p>
                <p><span className="font-bold">ঠিকানা:</span> {selectedDealerForLedger.address}</p>
                <p><span className="font-bold">ফোন:</span> {selectedDealerForLedger.phone}</p>
              </div>
              <div className="text-right">
                <p><span className="font-bold">ডিলার কোড:</span> {formatDealerCode(selectedDealerForLedger.code)}</p>
                <p><span className="font-bold">প্রারম্ভিক বাকি:</span> ৳{selectedDealerForLedger.openingDue.toLocaleString()}</p>
                <p><span className="font-bold text-emerald-700">মোট পরিশোধ:</span> ৳{selectedDealerForLedger.totalPaid.toLocaleString()}</p>
                <p className="text-sm font-extrabold text-rose-700 mt-1">
                  বর্তমান অবশিষ্ট বকেয়া: ৳{selectedDealerForLedger.currentDue.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                ১. পণ্য ক্রয়ের চালান তালিকা (Invoices)
              </h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="p-2">চালান নং</th>
                    <th className="p-2">তারিখ</th>
                    <th className="p-2">পণ্য বিবরণ</th>
                    <th className="p-2 text-right">চালান মূল্য</th>
                    <th className="p-2 text-right">তাত্ক্ষণিক জমা</th>
                    <th className="p-2 text-right">বাকি</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedDealerForLedger.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="p-2 font-mono font-bold text-emerald-800">{inv.id}</td>
                      <td className="p-2">{inv.date}</td>
                      <td className="p-2 text-slate-600">
                        {inv.items.map(it => `${it.productName} (${it.size})`).join(', ')}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold">৳{inv.grandTotal.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono text-emerald-700">৳{inv.paidAmount.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono font-bold text-rose-700">৳{inv.currentDue.toLocaleString()}</td>
                    </tr>
                  ))}
                  {selectedDealerForLedger.invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-3 text-center text-slate-400 italic">কোনো চালানের রেকর্ড নেই</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Payments List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                ২. টাকা জমার রশিদ তালিকা (Payment Collections)
              </h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="p-2">তারিখ</th>
                    <th className="p-2">পেমেন্টের ধরন</th>
                    <th className="p-2">মাধ্যম / মেথড</th>
                    <th className="p-2">রেফারেন্স / চেক নং</th>
                    <th className="p-2">রিসিভার</th>
                    <th className="p-2 text-right">জমার পরিমাণ (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedDealerForLedger.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2 font-mono">{p.date}</td>
                      <td className="p-2">{PAYMENT_TYPES.find((type) => type.value === normalizePaymentType(p.paymentType))?.label}</td>
                      <td className="p-2">{PAYMENT_METHODS.find((method) => method.value === normalizePaymentMethod(p.paymentMethod))?.label}</td>
                      <td className="p-2 font-mono">{p.reference || '-'}</td>
                      <td className="p-2">{p.receivedBy || '-'}</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-700">৳{p.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {selectedDealerForLedger.payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-3 text-center text-slate-400 italic">কোনো জমার রেকর্ড নেই</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures for Print */}
            <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs">
              <div>
                <div className="border-t border-slate-400 pt-1">ডিলার স্বাক্ষর</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1">হিসাবরক্ষক / ম্যানেজার, নিশিন্দারা বগুড়া</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
