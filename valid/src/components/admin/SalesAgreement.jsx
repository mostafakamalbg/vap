import React, { useMemo, useState } from 'react';
import { Printer, Save, Trash2 } from 'lucide-react';
import { INVOICE_SESSIONS } from '../../../shared/sessions';
import { toBn, toBnDate } from '../../utils/bengali';
import { useAgro } from '../../context/AgroContext';
import SearchableRecordSelect from './SearchableRecordSelect';

const DEFAULT_AGREEMENT_START_SESSION = 'জানুয়ারি - জুন ২০২৭';
const DEFAULT_AGREEMENT_END_SESSION = 'জুলাই - ডিসেম্বর ২০২৭';
const BENGALI_NUMBER_WORDS = [
  'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়',
  'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ',
  'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ',
  'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ',
  'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ',
  'পঞ্চাশ', 'একান্ন', 'বাহান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট',
  'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর',
  'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি',
  'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই',
  'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'
];

const emptyAgreement = () => ({
  id: '',
  reference: '',
  date: new Date().toISOString().slice(0, 10),
  session: DEFAULT_AGREEMENT_END_SESSION,
  sessionStart: DEFAULT_AGREEMENT_START_SESSION,
  sessionEnd: DEFAULT_AGREEMENT_END_SESSION,
  dealerId: '',
  dealerName: '',
  proprietor: '',
  marketVillage: '',
  thana: '',
  district: '',
  phone: '',
  annualSalesTarget: '',
  annualSalesTargetWords: '',
  benefitAmount: '',
  benefitAmountWords: '',
  benefitDescription: '',
  collectionDueDay: '5',
  minimumCollection: '',
  minimumCollectionWords: '',
  terms: Array(9).fill('')
});

function getAddressParts(address = '') {
  const parts = String(address)
    .split(/[,\u060c।]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    marketVillage: parts[0] || '',
    thana: parts[1] || '',
    district: parts.slice(2).join(', ')
  };
}

function getSessionRange(session) {
  const years = String(session).match(/[০-৯]+/g) || [];
  const year = Number(years[0]?.replace(/[০-৯]/g, (digit) => (
    String('০১২৩৪৫৬৭৮৯'.indexOf(digit))
  )));
  if (!year) return null;
  return session.includes('জানুয়ারি')
    ? { start: `${year}-01-01`, end: `${year}-06-30` }
    : { start: `${year}-07-01`, end: `${year}-12-31` };
}

function getAgreementRange(agreement) {
  const startSession = agreement.sessionStart || agreement.session || '';
  const endSession = agreement.sessionEnd || agreement.session || startSession;
  const startRange = getSessionRange(startSession);
  const endRange = getSessionRange(endSession);
  return startRange && endRange
    ? { start: startRange.start, end: endRange.end }
    : null;
}

function amount(value) {
  return `৳${(Number(value) || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`;
}

function AgreementAmount({ value, words }) {
  const hasAmount = value !== '' && value !== null && value !== undefined;
  const formattedAmount = hasAmount
    ? `=${Number(value).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}/- টাকা`
    : '............................................';
  return (
    <>
      <strong>{formattedAmount}</strong> <u>কথায়:</u> ({words || '........................................'} টাকা)
    </>
  );
}

function numberBelowThousandInWords(value) {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const parts = [];
  if (hundreds) parts.push(`${BENGALI_NUMBER_WORDS[hundreds]}শত`);
  if (remainder) parts.push(BENGALI_NUMBER_WORDS[remainder]);
  return parts.join(' ');
}

function amountInBengaliWords(value) {
  if (value === '' || value === null || value === undefined) return '';
  const amountValue = Number(value);
  if (!Number.isFinite(amountValue) || amountValue < 0) return '';

  let remaining = Math.round(amountValue);
  if (remaining === 0) return BENGALI_NUMBER_WORDS[0];

  const parts = [];
  [
    [1000000000000000, 'পদ্ম'],
    [10000000000000, 'নীল'],
    [100000000000, 'খরব'],
    [1000000000, 'আরব'],
    [10000000, 'কোটি'],
    [100000, 'লাখ'],
    [1000, 'হাজার'],
    [100, 'শত']
  ].forEach(([unit, label]) => {
    const group = Math.floor(remaining / unit);
    if (group > 0) {
      parts.push(`${numberBelowThousandInWords(group)} ${label}`);
      remaining %= unit;
    }
  });
  if (remaining) parts.push(BENGALI_NUMBER_WORDS[remaining]);
  return parts.join(' ');
}

function getAgreementMetrics(agreement, invoices, payments) {
  const range = getAgreementRange(agreement);
  const withinRange = (date) => date >= agreement.date
    && (!range || (date >= range.start && date <= range.end));
  const sales = invoices
    .filter((invoice) => (
      invoice.dealerId === agreement.dealerId
      && withinRange(invoice.date)
    ))
    .reduce((sum, invoice) => sum + Number(invoice.totalAmount ?? invoice.grandTotal ?? 0), 0);
  const collection = payments
    .filter((payment) => payment.dealerId === agreement.dealerId && withinRange(payment.date))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const target = Number(agreement.annualSalesTarget) || 0;
  return { sales, collection, target, remaining: Math.max(0, target - sales) };
}

export default function SalesAgreement() {
  const {
    dealers,
    invoices,
    payments,
    salesAgreements,
    saveSalesAgreement,
    deleteSalesAgreement
  } = useAgro();
  const [form, setForm] = useState(emptyAgreement);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const metrics = useMemo(
    () => new Map(salesAgreements.map((agreement) => [
      agreement.id,
      getAgreementMetrics(agreement, invoices, payments)
    ])),
    [salesAgreements, invoices, payments]
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setMessage('');
  };

  const selectDealer = (dealerId) => {
    const dealer = dealers.find((entry) => entry.id === dealerId);
    const address = getAddressParts(dealer?.address);
    setForm((current) => ({
      ...current,
      dealerId,
      dealerName: dealer?.shopName || '',
      proprietor: dealer?.proprietor || '',
      marketVillage: address.marketVillage,
      thana: address.thana || dealer?.zone || '',
      district: address.district,
      phone: dealer?.phone || ''
    }));
    setError('');
    setMessage('');
  };

  const resetForm = () => {
    setForm(emptyAgreement());
    setError('');
    setMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.dealerId || !form.reference.trim() || !form.date || !form.sessionStart || !form.sessionEnd) {
      setError('ডিলার, রেফারেন্স, তারিখ এবং শুরুর ও শেষ সেশন পূরণ করুন।');
      return;
    }
    if (INVOICE_SESSIONS.indexOf(form.sessionStart) > INVOICE_SESSIONS.indexOf(form.sessionEnd)) {
      setError('শেষ সেশন শুরুর সেশনের আগে হতে পারবে না।');
      return;
    }
    const agreement = saveSalesAgreement({
      ...form,
      reference: form.reference.trim(),
      session: form.sessionEnd,
      annualSalesTarget: Number(form.annualSalesTarget) || 0,
      annualSalesTargetWords: amountInBengaliWords(form.annualSalesTarget),
      benefitAmount: Number(form.benefitAmount) || 0,
      benefitAmountWords: amountInBengaliWords(form.benefitAmount),
      minimumCollection: Number(form.minimumCollection) || 0,
      minimumCollectionWords: amountInBengaliWords(form.minimumCollection),
      terms: form.terms.map((term) => term.trim())
    });
    setForm(agreement);
    setMessage('চুক্তি সংরক্ষণ হয়েছে।');
    setError('');
  };

  const loadAgreement = (agreement) => {
    const legacySession = agreement.session || DEFAULT_AGREEMENT_END_SESSION;
    setForm({
      ...emptyAgreement(),
      ...agreement,
      sessionStart: agreement.sessionStart || legacySession,
      sessionEnd: agreement.sessionEnd || legacySession,
      terms: agreement.terms || Array(9).fill('')
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (agreement) => {
    if (!window.confirm(`${agreement.dealerName} এর চুক্তিটি মুছে ফেলবেন?`)) return;
    deleteSalesAgreement(agreement.id);
    if (form.id === agreement.id) resetForm();
    setMessage('চুক্তি মুছে ফেলা হয়েছে।');
  };

  const currentMetrics = form.id
    ? getAgreementMetrics(form, invoices, payments)
    : { sales: 0, collection: 0, target: Number(form.annualSalesTarget) || 0, remaining: Number(form.annualSalesTarget) || 0 };
  const agreementSessionRange = `${form.sessionStart || '____________'} থেকে ${form.sessionEnd || '____________'}`;
  const annualSalesTargetWords = amountInBengaliWords(form.annualSalesTarget);
  const benefitAmountWords = amountInBengaliWords(form.benefitAmount);
  const minimumCollectionWords = amountInBengaliWords(form.minimumCollection);

  return (
    <div className="sales-agreement-page mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">সেলস ও কালেকশনের বিপরীতে অতিরিক্ত সুবিধা প্রদান ও গ্রহণের চুক্তি</h1>
          <p className="mt-1 text-sm text-slate-500">চুক্তি তৈরি, প্রিন্ট এবং ডিলারভিত্তিক বিক্রয়-কালেকশন হিসাব</p>
        </div>
        <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">নতুন চুক্তি</button>
      </header>

      {error && <p role="alert" className="no-print rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="no-print rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={handleSubmit} className="no-print space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">{form.id ? 'চুক্তি সম্পাদনা' : 'চুক্তির তথ্য'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              রেফারেন্স (Ref) *
              <input required maxLength={100} value={form.reference} onChange={(event) => updateField('reference', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              চুক্তির তারিখ *
              <input required type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              চুক্তির শুরুর সেশন *
              <select required value={form.sessionStart} onChange={(event) => updateField('sessionStart', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                {INVOICE_SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              চুক্তির শেষ সেশন *
              <select required value={form.sessionEnd} onChange={(event) => updateField('sessionEnd', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                {INVOICE_SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">শুরু ও শেষ সেশন আলাদাভাবে নির্বাচন করুন।</span>
            </label>
            <div className="sm:col-span-2">
              <SearchableRecordSelect
                label="ডিলার নির্বাচন করুন *"
                items={dealers}
                value={form.dealerId}
                onChange={selectDealer}
                placeholder="ডিলার নির্বাচন করুন"
                searchPlaceholder="ডিলার কোড বা নাম দিয়ে খুঁজুন"
                optionLabel={(dealer) => `${dealer.code || ''} • ${dealer.shopName}`}
                searchText={(dealer) => `${dealer.code || ''} ${dealer.shopName || ''} ${dealer.proprietor || ''}`}
              />
            </div>
            {[
              ['dealerName', 'মেসার্স / প্রতিষ্ঠানের নাম'],
              ['proprietor', 'প্রোপাইটর'],
              ['marketVillage', 'বাজার / গ্রাম'],
              ['thana', 'থানা'],
              ['district', 'জেলা'],
              ['phone', 'মোবাইল নম্বর']
            ].map(([field, label]) => (
              <label key={field} className="text-sm font-bold text-slate-700">
                {label}
                <input value={form[field]} onChange={(event) => updateField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            ))}
            <label className="text-sm font-bold text-slate-700">
              বার্ষিক সেলস টার্গেট (টাকা)
              <input type="number" min="0" step="1" value={form.annualSalesTarget} onChange={(event) => updateField('annualSalesTarget', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              টার্গেট টাকার কথায়
              <input readOnly value={annualSalesTargetWords} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              প্রদত্ত সুবিধা / টাকা
              <input type="number" min="0" step="1" value={form.benefitAmount} onChange={(event) => updateField('benefitAmount', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              সুবিধার টাকার পরিমাণ কথায়
              <input readOnly value={benefitAmountWords} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              মাসিক কালেকশনের তারিখ
              <select value={form.collectionDueDay} onChange={(event) => updateField('collectionDueDay', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="5">প্রতি মাসের ৫ তারিখে</option>
                <option value="10">প্রতি মাসের ১০ তারিখে</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              ন্যূনতম কালেকশন (টাকা)
              <input type="number" min="0" step="1" value={form.minimumCollection} onChange={(event) => updateField('minimumCollection', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">
              ন্যূনতম কালেকশন টাকার কথায়
              <input readOnly value={minimumCollectionWords} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-normal" />
            </label>
          </div>

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 font-black text-white hover:bg-emerald-800">
            <Save className="h-4 w-4" /> {form.id ? 'চুক্তি আপডেট করুন' : 'চুক্তি সংরক্ষণ করুন'}
          </button>
        </form>

        <section className="space-y-3">
          <div className="no-print flex justify-end">
            <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-bold text-white">
              <Printer className="h-4 w-4" /> চুক্তি প্রিন্ট / PDF
            </button>
          </div>
          <article className="sales-agreement-print bg-white p-6 text-slate-900 shadow-sm sm:p-10">
            <header className="agreement-header">
              <div className="agreement-brand-row">
                <div className="agreement-brand">
                  <img src="/logos/valid-logo.png" alt="ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড লোগো" />
                  <h1>ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড</h1>
                </div>
                <div className="agreement-brand">
                  <img src="/logos/mahananda-logo-transparent.png" alt="মহানন্দা এগ্রো ইন্ডাস্ট্রিজ লোগো" />
                  <h1>মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</h1>
                </div>
              </div>
              <p className="agreement-subtitle">(Agricultural Commodities Importer, Repacker &amp; Supplier)</p>
              <p>Office/Factory: Matidali, Bogra Sadar, Bogra</p>
            </header>
            <div className="agreement-ref-row">
              <span><strong>Ref:</strong> {form.reference || '________________'}</span>
              <span><strong>Date:</strong> {toBnDate(form.date) || '________________'}</span>
            </div>
            <h2 className="agreement-title">সেলস ও কালেকশনের বিপরীতে অতিরিক্ত সুবিধা প্রদান ও গ্রহণের চুক্তি</h2>
            <p className="agreement-intro">
              <strong>প্রথম পক্ষ কোম্পানী:</strong> ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড ও মহানন্দা এগ্রো ইন্ডাস্ট্রিজ।
            </p>
            <div className="agreement-dealer-details">
              <p className="agreement-party-label"><strong>দ্বিতীয় পক্ষ পরিবেশক:</strong></p>
              <p><strong>মেসার্স:</strong> {form.dealerName || '..............................................................'} <strong>প্রো:</strong> {form.proprietor || '..............................................................'}</p>
              <p><strong>বাজার/গ্রাম:</strong> {form.marketVillage || '.......................................................'} <strong>থানা:</strong> {form.thana || '..............................................................'}</p>
              <p><strong>জেলা:</strong> {form.district || '................................................................'} <strong>মোবাইল নং:</strong> {form.phone || '....................................................'}</p>
            </div>
            <p className="agreement-intro">
              প্রকাশ থাকে যে, দ্বিতীয় পক্ষ প্রথম পক্ষের একজন নিয়োজিত পরিবেশক। ব্যবসা চলাকালীন সময়ে দ্বিতীয় পক্ষ উভয় সেশনে ব্যবসা বাড়ানো এবং শতভাগ ক্লোজিং এর বিনিময় অতিরিক্ত সুযোগ-সুবিধা পাওয়ার জন্য প্রথম পক্ষকে মৌখিকভাবে প্রস্তাব দেন। পরবর্তীতে উভয়ের উপস্থিতিতে একটি মৌখিক চুক্তি হয়, যা এখানে লিখিত আকারে সম্পাদিত হলো।
            </p>
            <h3 className="agreement-clauses-heading">উভয়ের আলোচনা সাপেক্ষে চুক্তি সমূহ নিম্নে প্রদত্ত হলো:</h3>
            <ol className="agreement-clauses">
              <li>দ্বিতীয় পক্ষকে বাৎসরিক <AgreementAmount value={form.annualSalesTarget} words={annualSalesTargetWords} /> সেলস করিতে হইবে। বিনিময়ে প্রথম পক্ষ দ্বিতীয় পক্ষকে <AgreementAmount value={form.benefitAmount} words={benefitAmountWords} /> প্রদান করিবে।</li>
              <li>চুক্তির মেয়াদ {agreementSessionRange}।</li>
              <li>জুলাই থেকে ডিসেম্বর যে পরিমাণ সেলস হবে তা ২৮শে ডিসেম্বরের এবং জানুয়ারি থেকে জুন পর্যন্ত যে পরিমাণ সেলস হবে তা ৩০শে জুন এর মধ্যে শতভাগ টাকা পরিশোধ করিতে হবে।</li>
              <li>অতিরিক্ত সুযোগ-সুবিধার পুরো টাকা ক্লোজিং-এ একসাথে প্রদান করা হবে।</li>
              <li>দ্বিতীয় পক্ষ উল্লেখিত বিক্রয় লক্ষ্য মাত্রা অর্জন করিতে ব্যর্থ হইলে অতিরিক্ত সুযোগ সুবিধা থেকে বঞ্চিত হইবে।</li>
              <li>মোট বিক্রয় লক্ষ্য মাত্রার ২৫% পণ্য প্রথম পক্ষ সরবরাহ করিতে ব্যর্থ হইলে দ্বিতীয় পক্ষ পণ্যের অজুহাতে বিক্রয় লক্ষ্য মাত্রা কমাইতে পারিবে না। বরং যে সকল পণ্য যথাযথ সরবরাহ থাকিবে সে সকল পণ্য বিক্রয় করিয়া লক্ষ্য মাত্রা পূরণ করিতে হইবে।</li>
              <li>এই চুক্তি {agreementSessionRange} পর্যন্ত বলবৎ থাকিবে; যদি উভয় পক্ষ পরবর্তীতে আবার চুক্তি করিতে চাহিলে একই নিয়মে চুক্তি সম্পাদিত হইবে।</li>
              <li>আন্তর্জাতিক বাজারের কারণে যে কোন সময় প্রথম পক্ষ পণ্যের দাম বাড়াইতে কিংবা কমাইতে পারিবে।</li>
              <li>দ্বিতীয় পক্ষ প্রথম পক্ষকে ক্লোজিং মাস ছাড়া প্রতি মাসে {toBn(form.collectionDueDay)} তারিখের মধ্যে ন্যূনতম একটি কালেকশন দিতে হইবে, যার সর্বনিম্ন পরিমাণ <AgreementAmount value={form.minimumCollection} words={minimumCollectionWords} />। মাসিক কালেকশন বাদে বাকী যে টাকা থাকিবে তাহা কোম্পানীর ক্লোজিং-এর নির্ধারিত সময়ের মধ্যে পরিশোধ করিতে হইবে।</li>
            </ol>
            <p className="agreement-declaration">এমতাবস্থায় উপরোক্ত সকল বিষয় উভয় পক্ষ জেনে বুঝে স্বজ্ঞানে স্বেচ্ছায় নিম্নে স্বাক্ষর করিলেন।</p>
            <footer className="agreement-signatures">
              {['দ্বিতীয় পক্ষ (ডিলার)', 'দায়িত্বপ্রাপ্ত অফিসার', 'ম্যানেজার', 'প্রথম পক্ষ (কোম্পানি)'].map((signature) => (
                <div key={signature}><span>{signature}</span></div>
              ))}
            </footer>
          </article>
        </section>
      </div>

      <section className="no-print overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-black text-slate-900">চুক্তি ও বিক্রয়-কালেকশন হিসাব</h2>
          <p className="text-xs text-slate-500">চুক্তির তারিখ থেকে নির্বাচিত সেশনের শেষ পর্যন্ত ইনভয়েস ও কালেকশন হিসাব।</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">ডিলার / রেফারেন্স</th>
                <th className="p-3">সেশন / তারিখ</th>
                <th className="p-3 text-right">টার্গেট</th>
                <th className="p-3 text-right">সেলস</th>
                <th className="p-3 text-right">বাকি টার্গেট</th>
                <th className="p-3 text-right">কালেকশন</th>
                <th className="p-3">কাজ</th>
              </tr>
            </thead>
            <tbody>
              {salesAgreements.map((agreement) => {
                const summary = metrics.get(agreement.id);
                return (
                  <tr key={agreement.id} className="border-t border-slate-100">
                    <td className="p-3"><strong>{agreement.dealerName}</strong><p className="text-xs text-slate-500">{agreement.reference}</p></td>
                    <td className="p-3">{agreement.sessionStart && agreement.sessionEnd ? `${agreement.sessionStart} – ${agreement.sessionEnd}` : agreement.session}<p className="text-xs text-slate-500">{toBnDate(agreement.date)}</p></td>
                    <td className="p-3 text-right">{amount(summary.target)}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{amount(summary.sales)}</td>
                    <td className="p-3 text-right font-bold text-rose-700">{amount(summary.remaining)}</td>
                    <td className="p-3 text-right">{amount(summary.collection)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => loadAgreement(agreement)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">খুলুন / প্রিন্ট</button>
                        <button type="button" aria-label="চুক্তি মুছুন" onClick={() => handleDelete(agreement)} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {salesAgreements.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-500">এখনও কোনো চুক্তি সংরক্ষণ করা হয়নি।</td></tr>}
            </tbody>
            {form.dealerId && (
              <tfoot className="border-t-2 border-slate-200 bg-emerald-50 font-bold">
                <tr>
                  <td className="p-3" colSpan="2">বর্তমান চুক্তি: {form.dealerName || 'নির্বাচিত ডিলার'}</td>
                  <td className="p-3 text-right">{amount(currentMetrics.target)}</td>
                  <td className="p-3 text-right text-emerald-700">{amount(currentMetrics.sales)}</td>
                  <td className="p-3 text-right text-rose-700">{amount(currentMetrics.remaining)}</td>
                  <td className="p-3 text-right">{amount(currentMetrics.collection)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
