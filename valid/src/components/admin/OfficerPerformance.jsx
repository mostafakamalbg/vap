import React, { useState } from 'react';
import {
  UserCheck,
  PlusCircle,
  TrendingUp,
  Award,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Search,
  Package,
  X,
  Printer
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { createOfficerCode, formatOfficerCode, getNextOfficerCode, OFFICER_DESIGNATIONS, normalizeOfficerCode } from '../../../shared/codes';
import { getInvoiceCartons } from '../../../shared/invoiceCartons';
import { getInvoiceSalesAmount } from '../../../shared/invoiceTotals';

export default function OfficerPerformance() {
  const { officers, addNewOfficer, getOfficerSummary } = useAgro();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddOfficerModal, setShowAddOfficerModal] = useState(false);
  const [selectedOfficerDetail, setSelectedOfficerDetail] = useState(null);

  // New Officer Form with unique code
  const [newOfficer, setNewOfficer] = useState({
    code: '',
    name: '',
    designation: 'ফিল্ড সেলস অফিসার (FSO)',
    territory: 'পীরগঞ্জ ও ঠাকুরগাঁও জোন',
    phone: '',
    joinDate: new Date().toISOString().slice(0, 10)
  });

  const [statusMsg, setStatusMsg] = useState('');

  // Summaries sorted by Cartons Sold descending (Highest seller first)
  const officerSummaries = officers
    .map((o) => getOfficerSummary(o.id))
    .sort((a, b) => (b?.totalCartonsSold || 0) - (a?.totalCartonsSold || 0));

  // Filter
  const filteredOfficers = officerSummaries.filter((o) => {
    if (!o) return false;
    return (
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.territory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      normalizeOfficerCode(o.code, o.designation).toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.phone.includes(searchTerm)
    );
  });

  // Totals: Client explicitly requested: কার্টুন দেখাতে হবে (পিস নয়)
  const totalCompanySales = officerSummaries.reduce((acc, curr) => acc + (curr?.totalSalesAmount || 0), 0);
  const totalCompanyCartons = officerSummaries.reduce((acc, curr) => acc + (curr?.totalCartonsSold || 0), 0);
  const totalCompanyCollected = officerSummaries.reduce((acc, curr) => acc + (curr?.totalCollected || 0), 0);

  const handleSubmitNewOfficer = (e) => {
    e.preventDefault();
    if (!newOfficer.name) {
      alert('অফিসারের নাম আবশ্যক');
      return;
    }

    const assignedCode = createOfficerCode(
      newOfficer.code || getNextOfficerCode(officers, newOfficer.designation),
      newOfficer.designation
    );
    if (!assignedCode) {
      alert('অফিসার কোডে ১ বা তার বেশি সংখ্যা দিন।');
      return;
    }
    if (officers.some((officer) => normalizeOfficerCode(officer.code, officer.designation) === assignedCode)) {
      alert('এই পদবির অফিসার কোডটি আগে থেকেই আছে।');
      return;
    }

    try {
      addNewOfficer({ ...newOfficer, code: assignedCode });
    } catch (error) {
      alert(error.message || 'অফিসার যুক্ত করা যায়নি।');
      return;
    }

    setStatusMsg(`নতুন অফিসার "${newOfficer.name}" (কোড: ${assignedCode}) সফলভাবে যুক্ত হয়েছে!`);
    setTimeout(() => setStatusMsg(''), 4000);

    setNewOfficer({
      code: '',
      name: '',
      designation: 'ফিল্ড সেলস অফিসার (FSO)',
      territory: '',
      phone: '',
      joinDate: new Date().toISOString().slice(0, 10)
    });
    setShowAddOfficerModal(false);
  };

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </span>
            অফিসার সেলস ও কার্টুন বিক্রয় ট্র্যাকিং
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            কোন অফিসার কতো কার্টুন মাল সেলস করলো, কতো টাকার বিক্রয় করলো ও ক্যাশ কালেকশন হিসাব
          </p>
        </div>

        <button
          onClick={() => setShowAddOfficerModal(true)}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg font-bold text-xs shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>নতুন অফিসার নিয়োগ / এন্ট্রি</span>
        </button>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2 no-print">
          <Award className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-sm">{statusMsg}</span>
        </div>
      )}

      {/* KPI Overview: Client requested Cartons only, NOT pieces */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট কার্টুন বিক্রয় (Total Cartons)</p>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{totalCompanyCartons.toLocaleString()} কার্টুন</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">সকল টেরিটরি মিলে সরবরাহকৃত কার্টুন</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট সেলস ভ্যালু</p>
            <p className="text-2xl font-black text-slate-800 mt-1 font-mono">৳{totalCompanySales.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">নিট চালানের মোট বিল</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট আদায়কৃত কালেকশন</p>
            <p className="text-2xl font-black text-emerald-800 mt-1 font-mono">৳{totalCompanyCollected.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">নগদ ও ব্যাংক পরিশোধ</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <span className="font-bold text-base">৳</span>
          </div>
        </div>
      </div>

      {/* Officers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 no-print">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="অফিসারের নাম, কোড বা এলাকা দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
              <tr>
                <th className="py-3 px-3 text-center">র‍্যাংক</th>
                <th className="py-3 px-3">অফিসার কোড</th>
                <th className="py-3 px-3">নাম ও পদবী</th>
                <th className="py-3 px-3">টেরিটরি / জোন</th>
                <th className="py-3 px-3">মোবাইল নম্বর</th>
                <th className="py-3 px-3 text-center">চালান সংখ্যা</th>
                <th className="py-3 px-3 text-center">মোট কার্টুন বিক্রয়</th>
                <th className="py-3 px-3 text-right">মোট সেলস (৳)</th>
                <th className="py-3 px-3 text-right">আদায়কৃত কালেকশন (৳)</th>
                <th className="py-3 px-3 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOfficers.map((off, idx) => (
                <tr key={off.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 text-center">
                    {idx === 0 && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-xs border border-amber-300">
                        🥇 ১ম
                      </span>
                    )}
                    {idx === 1 && (
                      <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full text-xs border border-slate-300">
                        🥈 ২য়
                      </span>
                    )}
                    {idx === 2 && (
                      <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-900 font-bold px-2 py-0.5 rounded-full text-xs border border-orange-300">
                        🥉 ৩য়
                      </span>
                    )}
                    {idx > 2 && (
                      <span className="inline-block text-slate-500 font-mono font-bold text-xs">
                        #{idx + 1}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span className="inline-block bg-emerald-100 text-emerald-900 font-mono font-black px-2.5 py-0.5 rounded text-xs">
                      কোড: {formatOfficerCode(off.code, off.designation)}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-800 text-sm">{off.name}</div>
                    <div className="text-[11px] text-emerald-700 font-medium">{off.designation}</div>
                  </td>

                  <td className="py-3 px-3 text-slate-600 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {off.territory}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-600 font-medium">
                    {off.phone}
                  </td>

                  <td className="py-3 px-3 text-center font-bold text-slate-700 font-mono">
                    {off.invoiceCount} টি
                  </td>

                  {/* DISPLAY CARTONS ONLY */}
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-mono font-black text-xs border border-emerald-200">
                      {off.totalCartonsSold} কার্টুন
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 text-sm">
                    ৳{off.totalSalesAmount.toLocaleString()}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                    ৳{off.totalCollected.toLocaleString()}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => setSelectedOfficerDetail(off)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded text-xs font-semibold transition"
                    >
                      রিপোর্ট দেখুন
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Officer Breakdown & Cartons */}
      {selectedOfficerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {selectedOfficerDetail.name} ({selectedOfficerDetail.designation})
                </h3>
                <p className="text-xs text-slate-500">
                  অফিসার কোড: <span className="font-bold text-emerald-800 font-mono">{formatOfficerCode(selectedOfficerDetail.code, selectedOfficerDetail.designation)}</span> | টেরিটরি: {selectedOfficerDetail.territory} | মোবাইল: {selectedOfficerDetail.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedOfficerDetail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Officer Performance Stats */}
            <div className="grid grid-cols-3 gap-3 bg-emerald-50 p-3 rounded-lg text-xs border border-emerald-200">
              <div>
                <p className="text-slate-500 font-medium">মোট কার্টুন বিক্রয়</p>
                <p className="text-base font-black text-emerald-800 font-mono">{selectedOfficerDetail.totalCartonsSold} কার্টুন</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">মোট সেলস ভ্যালু</p>
                <p className="text-base font-black text-slate-800 font-mono">৳{selectedOfficerDetail.totalSalesAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">আদায়কৃত কালেকশন</p>
                <p className="text-base font-black text-emerald-700 font-mono">৳{selectedOfficerDetail.totalCollected.toLocaleString()}</p>
              </div>
            </div>

            {/* Invoices List by this officer */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase">
                অফিসার কর্তৃক প্রস্তুতকৃত চালানের বিবরণী:
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2">চালান নং</th>
                      <th className="p-2">তারিখ</th>
                      <th className="p-2">ডিলার প্রতিষ্ঠান</th>
                      <th className="p-2 text-center">কার্টুন সংখ্যা</th>
                      <th className="p-2 text-right">চালান মূল্য</th>
                      <th className="p-2 text-right">আদায়</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedOfficerDetail.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="p-2 font-mono font-bold text-emerald-800">{inv.id}</td>
                        <td className="p-2">{inv.date}</td>
                        <td className="p-2 font-medium">{inv.dealerName}</td>
                        <td className="p-2 text-center font-bold text-emerald-800 font-mono">{getInvoiceCartons(inv)} কার্টুন</td>
                        <td className="p-2 text-right font-mono font-bold">৳{getInvoiceSalesAmount(inv).toLocaleString()}</td>
                        <td className="p-2 text-right font-mono text-emerald-700">৳{(Number(inv.paidAmount) || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {selectedOfficerDetail.invoices.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400 italic">কোনো ইনভয়েসের রেকর্ড পাওয়া যায়নি</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedOfficerDetail(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Officer */}
      {showAddOfficerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-700" />
                নতুন সেলস অফিসার নিয়োগ এন্ট্রি
              </h3>
              <button onClick={() => setShowAddOfficerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewOfficer} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">অফিসার কোড (ঐচ্ছিক, ফাঁকা রাখলে স্বয়ংক্রিয়)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={getNextOfficerCode(officers, newOfficer.designation).split('-')[1]}
                    value={newOfficer.code}
                    onChange={(e) => setNewOfficer({ ...newOfficer, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-emerald-800"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    কোড: {createOfficerCode(newOfficer.code || getNextOfficerCode(officers, newOfficer.designation), newOfficer.designation)}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">পদবী (Designation)</label>
                  <select
                    value={newOfficer.designation}
                    onChange={(e) => setNewOfficer({ ...newOfficer, designation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-medium"
                  >
                    {OFFICER_DESIGNATIONS.map((designation) => (
                      <option key={designation.value} value={designation.value}>{designation.value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">অফিসারের পূর্ণ নাম *</label>
                <input
                  type="text"
                  placeholder="যেমন: মো: কামরুল হাসান"
                  value={newOfficer.name}
                  onChange={(e) => setNewOfficer({ ...newOfficer, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">নির্ধারিত টেরিটরি / জোন</label>
                <input
                  type="text"
                  placeholder="যেমন: পীরগঞ্জ ও বোচাগঞ্জ"
                  value={newOfficer.territory}
                  onChange={(e) => setNewOfficer({ ...newOfficer, territory: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">মোবাইল নম্বর</label>
                  <input
                    type="text"
                    placeholder="017xxxxxxxx"
                    value={newOfficer.phone}
                    onChange={(e) => setNewOfficer({ ...newOfficer, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">যোগদানের তারিখ</label>
                  <input
                    type="date"
                    value={newOfficer.joinDate}
                    onChange={(e) => setNewOfficer({ ...newOfficer, joinDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddOfficerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded text-xs font-bold shadow"
                >
                  অফিসার সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
