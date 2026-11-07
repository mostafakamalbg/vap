import React, { useState } from 'react';
import {
  BarChart3,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Calendar,
  Layers,
  CheckCircle,
  Package,
  TrendingUp,
  Building2,
  Users,
  UserCheck,
  Search,
  Filter,
  Clock
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';
import { formatDealerCode, formatOfficerCode } from '../../../shared/codes';

export default function MonthlyReport() {
  const { products, invoices, stockInLogs, damageLogs, payments, officers, dealers } = useAgro();

  // Mode: 'month' | 'year' | 'dealer' | 'officer'
  const [filterMode, setFilterMode] = useState('dealer');

  // Filter States
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentYearStr = new Date().getFullYear().toString();

  // Date Range for Dealer & Officer filtering
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(todayStr);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedDealerId, setSelectedDealerId] = useState(dealers[0]?.id || '');
  const [selectedOfficerCode, setSelectedOfficerCode] = useState(officers[0]?.code || '5');
  const [searchTerm, setSearchTerm] = useState('');

  // Date Preset Handlers
  const handlePresetDate = (months) => {
    const end = new Date();
    const start = new Date();
    if (months === 'all') {
      setStartDate('2024-01-01');
      setEndDate(end.toISOString().slice(0, 10));
      return;
    }
    start.setMonth(start.getMonth() - months);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  // Determine filtered invoices & returns based on current mode & date range
  let filteredInvoices = [];
  let filteredDamages = [];
  let reportTitle = '';
  let reportSubtitle = '';

  if (filterMode === 'month') {
    filteredInvoices = invoices.filter((inv) => inv.date.startsWith(selectedMonth));
    filteredDamages = damageLogs.filter((d) => d.date.startsWith(selectedMonth));
    const [y, m] = selectedMonth.split('-');
    const bMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const bMonthName = bMonths[parseInt(m, 10) - 1] || 'অক্টোবর';
    reportTitle = `মাসিক সেলস ও ইনভেন্টরি রিপোর্ট (${bMonthName}, ${toBn(y)})`;
    reportSubtitle = `নির্দিষ্ট মাস অনুযায়ী বিক্রয়, কার্টুন প্রবাহ ও রিটার্ন বিবরণী`;
  } else if (filterMode === 'year') {
    filteredInvoices = invoices.filter((inv) => inv.date.startsWith(selectedYear));
    filteredDamages = damageLogs.filter((d) => d.date.startsWith(selectedYear));
    reportTitle = `বার্ষিক সেলস ও ইনভেন্টরি স্টেটমেন্ট (সালঃ ${toBn(selectedYear)})`;
    reportSubtitle = `এক বছরে সম্পন্ন হওয়া সকল বিক্রয়, কার্টুন সরবরাহ ও আর্থিক সমন্বয়`;
  } else if (filterMode === 'dealer') {
    const d = dealers.find((dl) => dl.id === selectedDealerId);
    filteredInvoices = invoices.filter((inv) => {
      const isDealer = inv.dealerId === selectedDealerId || inv.dealerCode === d?.code;
      const inDateRange = (!startDate || inv.date >= startDate) && (!endDate || inv.date <= endDate);
      return isDealer && inDateRange;
    });
    filteredDamages = damageLogs.filter((dmg) => {
      const isDealer = dmg.dealerId === selectedDealerId || dmg.dealerCode === d?.code;
      const inDateRange = (!startDate || dmg.date >= startDate) && (!endDate || dmg.date <= endDate);
      return isDealer && inDateRange;
    });
    reportTitle = `ডিলারভিত্তিক বিক্রয় ও রিটার্ন স্টেটমেন্ট: ${d?.shopName || 'ডিলার'}`;
    reportSubtitle = `ডিলার কোড: ${toBn(d?.code)} | প্রোপ্রাইটার: ${d?.proprietor} | এলাকা: ${d?.address} | মোবাইল: ${toBn(d?.phone)} • সময়কাল: ${toBnDate(startDate)} হতে ${toBnDate(endDate)}`;
    reportSubtitle = reportSubtitle.replace(toBn(d?.code), formatDealerCode(d?.code));
  } else if (filterMode === 'officer') {
    const off = officers.find((o) => String(o.code) === String(selectedOfficerCode) || o.id === selectedOfficerCode);
    filteredInvoices = invoices.filter((inv) => {
      const isOfficer = String(inv.officerCode) === String(selectedOfficerCode) || inv.officerId === off?.id;
      const inDateRange = (!startDate || inv.date >= startDate) && (!endDate || inv.date <= endDate);
      return isOfficer && inDateRange;
    });
    filteredDamages = damageLogs.filter((dmg) => {
      const isOfficer = dmg.officerId === off?.id || dmg.officerName === off?.name;
      const inDateRange = (!startDate || dmg.date >= startDate) && (!endDate || dmg.date <= endDate);
      return isOfficer && inDateRange;
    });
    reportTitle = `অফিসার সেলস ও পারফরম্যান্স রিপোর্ট: কোড [${toBn(selectedOfficerCode)}]`;
    reportTitle = reportTitle.replace(
      `[${toBn(selectedOfficerCode)}]`,
      `[${formatOfficerCode(off?.code, off?.designation)}]`
    );
    reportSubtitle = `টেরিটরি: ${off?.territory} | পদবী: ${off?.designation} • সময়কাল: ${toBnDate(startDate)} হতে ${toBnDate(endDate)}`;
  }

  // Search filter
  if (searchTerm) {
    filteredInvoices = filteredInvoices.filter(
      (inv) =>
        inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.dealerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.officerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Summary Computations
  let totalSalesValue = 0;
  let totalCartonsSold = 0;
  let totalDealerReturnCartons = 0;
  let totalFactoryReturnCartons = 0;
  let totalCollected = 0;
  let totalDueOutstanding = 0;
  const productCartonStockChange = {};

  filteredInvoices.forEach((inv) => {
    const cartons = Number(inv.totalCartons) || 0;
    const isDealerReturn = inv.invoiceType === 'dealer_return';
    const isFactoryReturn = inv.invoiceType === 'factory_damage';

    if (isDealerReturn) {
      totalSalesValue -= Number(inv.grandTotal) || 0;
      totalDealerReturnCartons += cartons;
    } else if (isFactoryReturn) {
      totalFactoryReturnCartons += cartons;
    } else {
      totalSalesValue += Number(inv.grandTotal) || 0;
      totalCartonsSold += cartons;
      totalCollected += Number(inv.paidAmount) || 0;
      totalDueOutstanding += Number(inv.currentDue) || 0;
    }

    (inv.items || []).forEach((item) => {
      const key = `${item.productName} (${item.size})`;
      const direction = isDealerReturn ? 1 : -1;
      productCartonStockChange[key] =
        (productCartonStockChange[key] || 0) + direction * (Number(item.cartons) || 0);
    });
  });

  const totalDamagesCount = filteredDamages.reduce(
    (acc, curr) => acc + (Number(curr.quantityPieces) || 0),
    0
  );
  const totalDamageValue = filteredDamages.reduce(
    (acc, curr) => acc + (Number(curr.totalDamageValue) || 0),
    0
  );

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </span>
            রিপোর্ট ও এনালাইটিক্স (মাসিক, বার্ষিক, ডিলার ও অফিসারভিত্তিক)
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            এক মাসে কত সেলস/রিটার্ন, এক বছরে কত এবং যেকোনো ডিলার বা অফিসারের আলাদা আলাদা রিপোর্ট তৈরি ও প্রিন্ট
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition"
        >
          <Printer className="w-4 h-4" />
          <span>রিপোর্ট প্রিন্ট করুন</span>
        </button>
      </div>

      {/* Filter Mode Switcher (4 Modes) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4 no-print">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <span className="text-xs font-bold text-slate-500 uppercase mr-2">ফিল্টার মোড:</span>

          <button
            onClick={() => setFilterMode('month')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              filterMode === 'month'
                ? 'bg-emerald-700 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>মাসিক রিপোর্ট (Monthly)</span>
          </button>

          <button
            onClick={() => setFilterMode('year')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              filterMode === 'year'
                ? 'bg-emerald-700 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>বার্ষিক হিসাব (Yearly / Annual)</span>
          </button>

          <button
            onClick={() => setFilterMode('dealer')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              filterMode === 'dealer'
                ? 'bg-emerald-700 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>ডিলারভিত্তিক রিপোর্ট (By Dealer)</span>
          </button>

          <button
            onClick={() => setFilterMode('officer')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              filterMode === 'officer'
                ? 'bg-emerald-700 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>অফিসারভিত্তিক রিপোর্ট (By Officer)</span>
          </button>
        </div>

        {/* Dynamic Controls based on selected mode */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-xs">
            {filterMode === 'month' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">মাস নির্বাচন করুন:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800"
                />
              </div>
            )}

            {filterMode === 'year' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">বছর নির্বাচন করুন:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-800"
                >
                  <option value="2026">২০২৬ সাল</option>
                  <option value="2025">২০২৫ সাল</option>
                  <option value="2024">২০২৪ সাল</option>
                </select>
              </div>
            )}

            {filterMode === 'dealer' && (
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">ডিলার নির্বাচন করুন ({dealers.length} জন):</label>
                <select
                  value={selectedDealerId}
                  onChange={(e) => setSelectedDealerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800"
                >
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatDealerCode(d.code)} • {d.shopName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'officer' && (
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">ফিল্ড অফিসার নির্বাচন করুন:</label>
                <select
                  value={selectedOfficerCode}
                  onChange={(e) => setSelectedOfficerCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800"
                >
                  {officers.map((o) => (
                    <option key={o.id} value={o.code}>
                      {formatOfficerCode(o.code, o.designation)} • {o.name} • {o.designation}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick search input */}
            <div className="relative">
              <label className="block font-bold text-slate-700 mb-1">তালিকায় দ্রুত সার্চ:</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="চালান নং বা নাম দিয়ে খুঁজুন..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Date Range Selector for Dealer and Officer Modes */}
          {(filterMode === 'dealer' || filterMode === 'officer') && (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  ক্যালেন্ডার ও তারিখ পরিসর (Date Range):
                </span>
                <div className="flex items-center gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">হতে:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-xs font-semibold"
                    />
                  </div>
                  <span className="text-slate-400 self-end pb-1.5">—</span>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">পর্যন্ত:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2.5 py-1 font-mono text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">শর্টকাট:</span>
                <button
                  type="button"
                  onClick={() => handlePresetDate(1)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ১ মাস
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(3)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ৩ মাস
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(6)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ৬ মাস
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(12)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ১ বছর
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(24)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-700"
                >
                  ২ বছর
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate('all')}
                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold"
                >
                  সব সময়
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards for the filtered data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট কার্টুন সরবরাহ</p>
            <p className="text-2xl font-black text-emerald-800 mt-1 font-mono">{totalCartonsSold} কার্টুন</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ডিলার ফেরত: {totalDealerReturnCartons} • ফ্যাক্টরি ফেরত: {totalFactoryReturnCartons}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">নিট সেলস ভ্যালু</p>
            <p className="text-2xl font-black text-slate-800 mt-1 font-mono">৳{totalSalesValue.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">বিক্রয় − ডিলার ফেরত ক্রেডিট</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট ক্যাশ কালেকশন</p>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">৳{totalCollected.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">নগদ ও চেক জমা</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মেয়াদোত্তীর্ণ / ফেরত মাল</p>
            <p className="text-2xl font-black text-rose-600 mt-1 font-mono">{totalDamagesCount} বোতল</p>
            <p className="text-[11px] text-slate-400 mt-0.5">মূল্য: ৳{totalDamageValue.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Official Printable Statement Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="border-b-2 border-emerald-800 pb-4">
          <div className="flex items-center justify-between mb-3">
            <img
              src="/logos/valid-logo.png"
              alt="Valid Agro"
              className="h-16 w-auto object-contain"
            />
            <div className="text-center flex-1 px-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড
              </h2>
              <h3 className="text-base font-bold text-emerald-800">
                এন্ড মহানন্দা এগ্রো ইন্ডাস্ট্রিজ • নিশিন্দারা, বগুড়া।
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                হটলাইনঃ 01867912167 • ডিস্ট্রিবিউশন হাব ও সেন্ট্রাল ইনভেন্টরি শাখা
              </p>
              <div className="mt-2 inline-block bg-emerald-800 text-white px-5 py-1 rounded text-xs font-black uppercase tracking-wider">
                {reportTitle}
              </div>
            </div>
            <img
              src="/logos/mahananda-logo.png"
              alt="Mahananda Agro"
              className="h-16 w-auto object-contain"
            />
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium text-center">{reportSubtitle}</p>
        </div>

        {/* Summary Metric Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 font-medium">মোট বিক্রিত কার্টুন:</span>
            <p className="text-base font-black text-emerald-800 font-mono">{totalCartonsSold} কার্টুন</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">মোট চালান মূল্য:</span>
            <p className="text-base font-black text-slate-900 font-mono">৳{totalSalesValue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500">বিক্রয় − ডিলার ফেরত</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">আদায়কৃত নগদ / চেক:</span>
            <p className="text-base font-black text-emerald-700 font-mono">৳{totalCollected.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">অবশিষ্ট বকেয়া / বাকি:</span>
            <p className="text-base font-black text-rose-700 font-mono">৳{totalDueOutstanding.toLocaleString()}</p>
          </div>
        </div>

        {/* Product Carton Dispatch Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-700" />
            ইনভয়েসভিত্তিক কার্টুন স্টক পরিবর্তন (+ জমা, − বহিঃপ্রবাহ):
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-3 w-10">নং</th>
                  <th className="py-2.5 px-3">পণ্যের বিবরণ ও প্যাক সাইজ</th>
                  <th className="py-2.5 px-3 text-center">নিট স্টক পরিবর্তন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.keys(productCartonStockChange).map((pKey, idx) => (
                  <tr key={pKey} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{pKey}</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-800 font-mono text-sm">
                      {productCartonStockChange[pKey] > 0 ? '+' : ''}
                      {productCartonStockChange[pKey]} কার্টুন
                    </td>
                  </tr>
                ))}
                {Object.keys(productCartonStockChange).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400 italic">
                      নির্বাচিত ফিল্টারে কোনো স্টক পরিবর্তনের ইনভয়েস নেই।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoices Log Table */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            অন্তর্ভুক্ত চালানের বিস্তারিত তালিকা:
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-2">চালান নং</th>
                  <th className="p-2">তারিখ</th>
                  <th className="p-2">ডিলার প্রতিষ্ঠান</th>
                  <th className="p-2 text-center">অফিসার কোড</th>
                  <th className="p-2 text-center">কার্টুন</th>
                  <th className="p-2 text-right">চালান বিল (৳)</th>
                  <th className="p-2 text-right">জমা (৳)</th>
                  <th className="p-2 text-right">বকেয়া (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono font-bold text-emerald-800">{inv.id}</td>
                    <td className="p-2 font-mono">{inv.date}</td>
                    <td className="p-2 font-semibold text-slate-800">
                      {inv.dealerName} <span className="text-[10px] text-slate-400 font-mono">[{formatDealerCode(inv.dealerCode)}]</span>
                    </td>
                    <td className="p-2 text-center">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        কোড: {formatOfficerCode(inv.officerCode)}
                      </span>
                    </td>
                    <td className="p-2 text-center font-bold text-emerald-800 font-mono">{inv.totalCartons || 0}</td>
                    <td className="p-2 text-right font-mono font-bold">৳{inv.grandTotal.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono text-emerald-700 font-bold">৳{inv.paidAmount.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono text-rose-700 font-bold">৳{inv.currentDue.toLocaleString()}</td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                      কোনো চালানের রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures for Print */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold">প্রস্তুতকারী (ডাটা এন্ট্রি)</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold">একাউন্টস বিভাগ, নিশিন্দারা বগুড়া</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 font-semibold">ব্যবস্থাপনা পরিচালক / জিএম</div>
          </div>
        </div>
      </div>
    </div>
  );
}
