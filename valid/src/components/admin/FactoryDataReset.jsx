import React, { useState } from 'react';
import { AlertTriangle, RotateCw, ShieldCheck } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';

export default function FactoryDataReset() {
  const { currentUser, cloudReady, resetToFactoryData } = useAgro();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const reset = await resetToFactoryData();
      if (reset) setMessage('ফ্যাক্টরি ডেটা পুনরুদ্ধার হয়েছে।');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'ফ্যাক্টরি ডেটা রিসেট করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  if (currentUser?.role !== 'admin') return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <header className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-rose-300">অ্যাডমিন প্যানেল</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black">
          <RotateCw className="h-6 w-6" /> ফ্যাক্টরি ডেটা রিসেট
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          এই নির্দিষ্ট পেজ থেকেই মূল ফ্যাক্টরি ডেটা পুনরুদ্ধার করা যায়।
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-5">
        <div className="flex items-start gap-3 text-rose-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-black">এই কাজটি বর্তমান ডেটা প্রতিস্থাপন করবে</h2>
            <p className="mt-1 text-sm leading-6">
              পণ্য, স্টক, ইনভয়েস, ডিলার, সেলস ও কালেকশন চুক্তি এবং হিসাব মুছে মূল ফ্যাক্টরি ডেটা ফিরিয়ে আনা হবে। আগে ব্যাকআপ নিন।
            </p>
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-white p-3 text-sm font-semibold text-rose-700">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-white p-3 text-sm font-semibold text-emerald-800">{message}</p>}
        {!cloudReady && <p role="status" className="text-sm font-semibold text-amber-900">ডেটাবেস সংযোগ সম্পন্ন হওয়ার অপেক্ষায়…</p>}
        <button
          type="button"
          disabled={busy || !cloudReady}
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCw className="h-4 w-4" />
          {busy ? 'রিসেট হচ্ছে…' : 'ফ্যাক্টরি ডেটা রিসেট করুন'}
        </button>
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-900">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          রিসেটের আগে RESET নিশ্চিতকরণ এবং অ্যাডমিন পাসওয়ার্ড প্রয়োজন।
        </p>
      </section>
    </div>
  );
}
