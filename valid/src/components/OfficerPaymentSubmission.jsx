import React, { useState } from 'react';
import { Camera, Send } from 'lucide-react';
import { PAYMENT_METHODS } from '../../shared/paymentMethods';
import { getBangladeshBusinessDate, getInvoiceSessionForDate } from '../../shared/sessions';
import { readImageFile } from '../utils/imageUpload';

export default function OfficerPaymentSubmission({ dealers, officer }) {
  const [form, setForm] = useState({
    dealerId: '',
    amount: '',
    date: getBangladeshBusinessDate(),
    session: getInvoiceSessionForDate(getBangladeshBusinessDate()) || '',
    paymentMethod: 'cash',
    note: '',
    proofDataUrl: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));
  const chooseProof = async (event) => {
    setError('');
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      update('proofDataUrl', await readImageFile(file));
    } catch (uploadError) {
      update('proofDataUrl', '');
      setError(uploadError.message);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/officer-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'পেমেন্ট জমা করা যায়নি।');
      setMessage(result.message);
      setForm((previous) => ({
        ...previous,
        dealerId: '',
        amount: '',
        note: '',
        proofDataUrl: ''
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-black text-slate-900">পেমেন্ট জমা দিন</h2>
        <p className="mt-1 text-xs text-slate-500">ছবি প্রমাণসহ জমা হবে; অ্যাডমিন অনুমোদনের পরেই লেজারে যোগ হবে{officer?.name ? ` • ${officer.name}` : ''}।</p>
      </div>
      <label className="block text-xs font-semibold text-slate-600">ডিলার
        <select required value={form.dealerId} onChange={(event) => update('dealerId', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">ডিলার নির্বাচন করুন</option>
          {dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.shopName} • {dealer.code}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-600">টাকার পরিমাণ
          <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-slate-600">পরিশোধের মাধ্যম
          <select value={form.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {PAYMENT_METHODS.filter((method) => method.value !== 'credit').map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-600">তারিখ
          <input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-slate-600">সেশন
          <input required maxLength={100} value={form.session} onChange={(event) => update('session', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-xs font-semibold text-slate-600">রসিদ / পেমেন্টের ছবি (আবশ্যক, সর্বোচ্চ ১.৫ এমবি)
        <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
          <Camera className="h-4 w-4 text-slate-500" />
          <input required={!form.proofDataUrl} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseProof} className="w-full text-xs" />
        </span>
      </label>
      {form.proofDataUrl && <img src={form.proofDataUrl} alt="পেমেন্টের প্রমাণ" className="h-28 rounded-lg object-cover" />}
      <textarea maxLength={500} rows={2} placeholder="নোট (ঐচ্ছিক)" value={form.note} onChange={(event) => update('note', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">{message}</p>}
      <button disabled={busy || !dealers.length || !form.proofDataUrl} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        <Send className="h-4 w-4" /> {busy ? 'জমা হচ্ছে…' : 'অনুমোদনের জন্য জমা দিন'}
      </button>
    </form>
  );
}
