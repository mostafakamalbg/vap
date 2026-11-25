import React, { useState } from 'react';
import { ArrowLeft, KeyRound, UserRoundPlus } from 'lucide-react';
import { useAgro } from '../context/AgroContext';

export default function DealerAccess({ onNavigate, onLoginSuccess }) {
  const { loginDealer, registerDealer } = useAgro();
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ dealerCode: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (isRegistering) {
        const result = await registerDealer(form);
        setMessage(result.message);
        if (result.user) onLoginSuccess(result.user);
      } else {
        const user = await loginDealer(form);
        onLoginSuccess(user);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex min-h-[65vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <button type="button" onClick={() => onNavigate('website-home')} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700">
          <ArrowLeft className="h-4 w-4" /> হোমে ফিরুন
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            {isRegistering ? <UserRoundPlus className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-900">ডিলার লেজার অ্যাক্সেস</h1>
            <p className="text-xs text-slate-500">শুধু আপনার নিজস্ব ডিলার লেজার দেখা যাবে।</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => { setIsRegistering(false); setError(''); setMessage(''); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${!isRegistering ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>লগইন</button>
          <button type="button" onClick={() => { setIsRegistering(true); setError(''); setMessage(''); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${isRegistering ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>নিবন্ধন</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1 text-xs font-bold text-slate-700">ডিলার কোড
            <input required maxLength={40} autoCapitalize="characters" value={form.dealerCode} onChange={(event) => setForm((previous) => ({ ...previous, dealerCode: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1 text-xs font-bold text-slate-700">ফোন নম্বর
            <input required type="tel" maxLength={24} autoComplete="tel" value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1 text-xs font-bold text-slate-700">পাসওয়ার্ড
            <input required type="password" minLength={10} maxLength={128} autoComplete={isRegistering ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
            {isRegistering && <span className="block font-normal text-slate-500">কমপক্ষে ১০ অক্ষর। নিবন্ধনের জন্য নম্বরটি ডিলার রেকর্ডের সঙ্গে মিলতে হবে।</span>}
          </label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{message}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy ? 'অপেক্ষা করুন…' : isRegistering ? 'ডিলার অ্যাকাউন্ট তৈরি করুন' : 'লগইন করুন'}
          </button>
        </form>
      </div>
    </section>
  );
}
