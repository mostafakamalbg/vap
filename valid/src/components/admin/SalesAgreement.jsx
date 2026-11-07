import React, { useMemo, useState } from 'react';
import { Printer, Save, Trash2 } from 'lucide-react';
import { INVOICE_SESSIONS } from '../../../shared/sessions';
import { toBn, toBnDate } from '../../utils/bengali';
import { useAgro } from '../../context/AgroContext';
import SearchableRecordSelect from './SearchableRecordSelect';

const emptyAgreement = () => ({
  id: '',
  reference: '',
  date: new Date().toISOString().slice(0, 10),
  session: INVOICE_SESSIONS[0],
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

function amount(value) {
  return `৳${(Number(value) || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`;
}

function getAgreementMetrics(agreement, invoices, payments) {
  const range = getSessionRange(agreement.session);
  const withinRange = (date) => date >= agreement.date
    && (!range || (date >= range.start && date <= range.end));
  const sales = invoices
    .filter((invoice) => (
      invoice.dealerId === agreement.dealerId
      && withinRange(invoice.date)
      && (!invoice.session || invoice.session === agreement.session)
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

  const updateTerm = (index, value) => {
    setForm((current) => ({
      ...current,
      terms: current.terms.map((term, termIndex) => termIndex === index ? value : term)
    }));
  };

  const resetForm = () => {
    setForm(emptyAgreement());
    setError('');
    setMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.dealerId || !form.reference.trim() || !form.date || !form.session) {
      setError('ডিলার, রেফারেন্স, তারিখ ও সেশন পূরণ করুন।');
      return;
    }
    const agreement = saveSalesAgreement({
      ...form,
      reference: form.reference.trim(),
      annualSalesTarget: Number(form.annualSalesTarget) || 0,
      benefitAmount: Number(form.benefitAmount) || 0,
      minimumCollection: Number(form.minimumCollection) || 0,
      terms: form.terms.map((term) => term.trim())
    });
    setForm(agreement);
    setMessage('চুক্তি সংরক্ষণ হয়েছে।');
    setError('');
  };

  const loadAgreement = (agreement) => {
    setForm({ ...emptyAgreement(), ...agreement, terms: agreement.terms || Array(9).fill('') });
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
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">
              সেশন *
              <select required value={form.session} onChange={(event) => updateField('session', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                {INVOICE_SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
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
              <input value={form.annualSalesTargetWords} onChange={(event) => updateField('annualSalesTargetWords', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              প্রদত্ত সুবিধা / টাকা
              <input type="number" min="0" step="1" value={form.benefitAmount} onChange={(event) => updateField('benefitAmount', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              সুবিধার বিবরণ
              <input value={form.benefitDescription} onChange={(event) => updateField('benefitDescription', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
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
              <input value={form.minimumCollectionWords} onChange={(event) => updateField('minimumCollectionWords', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
          </div>

          <section className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="font-black text-slate-900">চুক্তির ৯টি শর্ত লিখুন</h3>
            {form.terms.map((term, index) => (
              <label key={`term-${index}`} className="block text-sm font-bold text-slate-700">
                শর্ত {toBn(index + 1)}
                <textarea rows="2" value={term} onChange={(event) => updateTerm(index, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            ))}
          </section>
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
            <header className="agreement-header text-center">
              <h1>মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</h1>
              <p className="agreement-subtitle">(Agricultural Commodities Importer, Repacker &amp; Supplier)</p>
              <p>Office/Factory: Matidali, Bogra Sadar, Bogra</p>
            </header>
            <div className="agreement-ref-row">
              <span><strong>Ref:</strong> {form.reference || '________________'}</span>
              <span><strong>Date:</strong> {toBnDate(form.date) || '________________'}</span>
            </div>
            <h2 className="agreement-title">সেলস ও কালেকশনের বিপরীতে অতিরিক্ত সুবিধা প্রদান ও গ্রহণের চুক্তি</h2>
            <p className="agreement-intro">
              এই চুক্তি {toBnDate(form.date) || '________________'} তারিখে প্রথম পক্ষ মহানন্দা এগ্রো ইন্ডাস্ট্রিজ এবং দ্বিতীয় পক্ষের মধ্যে সম্পাদিত হলো।
            </p>
            <div className="agreement-dealer-details">
              <p><strong>মেসার্স:</strong> {form.dealerName || '________________'} <strong>প্রোপাইটর:</strong> {form.proprietor || '________________'}</p>
              <p><strong>বাজার/গ্রাম:</strong> {form.marketVillage || '________________'} <strong>থানা:</strong> {form.thana || '________________'} <strong>জেলা:</strong> {form.district || '________________'}</p>
              <p><strong>মোবাইল:</strong> {form.phone || '________________'} <strong>সেশন:</strong> {form.session}</p>
            </div>
            <div className="agreement-commercial-terms">
              <p><strong>বার্ষিক সেলস টার্গেট:</strong> {form.annualSalesTarget ? amount(form.annualSalesTarget) : '৳____________'} ({form.annualSalesTargetWords || '________________________________'})</p>
              <p><strong>প্রদত্ত সুবিধা:</strong> {form.benefitAmount ? amount(form.benefitAmount) : '৳____________'} {form.benefitDescription && `(${form.benefitDescription})`}</p>
              <p><strong>মাসিক ন্যূনতম কালেকশন:</strong> প্রতি মাসের {toBn(form.collectionDueDay)} তারিখে {form.minimumCollection ? amount(form.minimumCollection) : '৳____________'} ({form.minimumCollectionWords || '________________________________'})</p>
            </div>
            <h3 className="agreement-clauses-heading">চুক্তির শর্তাবলী</h3>
            <ol className="agreement-clauses">
              {form.terms.map((term, index) => (
                <li key={`print-term-${index}`}>{term || '________________________________________________________________________________'}</li>
              ))}
            </ol>
            <p className="agreement-declaration">উভয় পক্ষ চুক্তির সকল শর্ত পড়ে, বুঝে ও স্বেচ্ছায় সম্মত হয়ে স্বাক্ষর করলেন।</p>
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
                    <td className="p-3">{agreement.session}<p className="text-xs text-slate-500">{toBnDate(agreement.date)}</p></td>
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
