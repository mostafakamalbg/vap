import React, { useRef, useState } from 'react';
import { AlertTriangle, Database, Download, FileUp, ShieldCheck } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';

export default function AdminDataManagement() {
  const { currentUser, cloudReady, exportBackup, importBackup, clearSalesStockData } = useAgro();
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const backup = JSON.parse(await file.text());
      if (!window.confirm('ইমপোর্ট করলে বর্তমান ব্যবসায়িক ডেটা ব্যাকআপের ডেটা দিয়ে প্রতিস্থাপিত হবে। আগে বর্তমান ডেটার ব্যাকআপ নিন। এগোবেন?')) {
        return;
      }
      const password = window.prompt('ব্যাকআপ ইমপোর্ট নিশ্চিত করতে আপনার অ্যাডমিন পাসওয়ার্ড দিন।');
      if (!password) return;
      await importBackup(backup, password);
      setMessage('ব্যাকআপ সফলভাবে ইমপোর্ট হয়েছে।');
    } catch (requestError) {
      setError(requestError instanceof SyntaxError
        ? 'JSON ফাইলটি পড়া যায়নি। সঠিক ব্যাকআপ ফাইল নির্বাচন করুন।'
        : requestError.message);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const handleSalesStockReset = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (resetConfirmation !== 'মুছুন') {
        throw new Error('নিশ্চিত করতে “মুছুন” লিখুন।');
      }
      if (!window.confirm('সতর্কতা: সব ইনভয়েস, অর্ডার, ড্যামেজ/ফেরত, স্টক-ইন ও পেমেন্ট/কালেকশন ইতিহাস স্থায়ীভাবে মুছে যাবে এবং সব পণ্যের স্টক শূন্য হবে। এই কাজ ফেরানো যাবে না। এগোবেন?')) {
        return;
      }
      const result = await clearSalesStockData(resetPassword);
      setMessage(`${result.message} (ইনভয়েস ${result.deleted.invoices}, ড্যামেজ ${result.deleted.damages}, স্টক-ইন ${result.deleted.stockInLogs}, পেমেন্ট ${result.deleted.payments})`);
      setResetPassword('');
      setResetConfirmation('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">অ্যাডমিন প্যানেল</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black">
          <Database className="h-6 w-6" /> ডেটা এক্সপোর্ট ও ইমপোর্ট
        </h1>
        <p className="mt-2 text-sm text-slate-300">ব্যবসায়িক রেকর্ডের ব্যাকআপ ডাউনলোড বা পূর্বের JSON ব্যাকআপ পুনরুদ্ধার করুন।</p>
      </header>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}

      <section className="grid gap-5 md:grid-cols-2">
        <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-700" />
            <h2 className="font-black text-slate-900">ব্যাকআপ এক্সপোর্ট</h2>
          </div>
          <p className="text-sm text-slate-600">Excel/ডকুমেন্ট রিপোর্ট অথবা পরে পুনরায় ইমপোর্টযোগ্য সম্পূর্ণ JSON ব্যাকআপ ডাউনলোড করুন।</p>
          <div className="grid gap-2">
            <button type="button" onClick={() => exportBackup('json')} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
              সম্পূর্ণ JSON ব্যাকআপ ডাউনলোড
            </button>
            <button type="button" onClick={() => exportBackup('excel')} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Excel (.xls) ডাউনলোড
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => exportBackup('google-docs')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                Google Docs (.html)
              </button>
              <button type="button" onClick={() => exportBackup('word')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                Word (.doc)
              </button>
            </div>
          </div>
        </article>

        <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-amber-700" />
            <h2 className="font-black text-slate-900">ব্যাকআপ ইমপোর্ট</h2>
          </div>
          <p className="text-sm text-slate-600">আগে এক্সপোর্ট করা Valid Agro JSON ব্যাকআপ থেকে ডেটা পুনরুদ্ধার করুন। ইমপোর্ট বর্তমান ব্যবসায়িক রেকর্ড প্রতিস্থাপন করবে।</p>
          {!cloudReady && <p className="text-xs font-semibold text-amber-800">ডেটাবেস সংযোগ সম্পন্ন হওয়ার অপেক্ষায়…</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            disabled={busy || !cloudReady || currentUser?.role !== 'admin'}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileUp className="h-4 w-4" /> {busy ? 'ইমপোর্ট হচ্ছে…' : 'JSON ব্যাকআপ নির্বাচন করুন'}
          </button>
          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            শুধু অ্যাডমিন অ্যাকাউন্ট থেকে ইমপোর্ট করা যায়; সার্ভারে সফল হলে তবেই পরিবর্তন প্রয়োগ হবে।
          </p>
        </article>
      </section>

      {currentUser?.role === 'admin' && (
        <section className="rounded-xl border border-rose-300 bg-rose-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div className="w-full space-y-3">
              <div>
                <h2 className="font-black text-rose-900">নতুন স্টক শুরুর জন্য পুরনো হিসাব পরিষ্কার</h2>
                <p className="mt-1 text-sm text-rose-800">সব ইনভয়েস/অর্ডার, ড্যামেজ ও ফেরত, স্টক-ইন এবং পেমেন্ট/কালেকশন ইতিহাস স্থায়ীভাবে মুছে যাবে। পণ্যের তালিকা ও ডিলার থাকবে; সব পণ্যের স্টক শূন্য হবে। চালানোর আগে JSON ব্যাকআপ ডাউনলোড করুন।</p>
              </div>
              <form onSubmit={handleSalesStockReset} className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-bold text-rose-900">
                  অ্যাডমিন পাসওয়ার্ড
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </label>
                <label className="text-xs font-bold text-rose-900">
                  নিশ্চিত করতে “মুছুন” লিখুন
                  <input
                    value={resetConfirmation}
                    onChange={(event) => setResetConfirmation(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !cloudReady}
                  className="self-end rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'প্রক্রিয়াধীন…' : 'ইনভয়েস, হিসাব ও স্টক মুছুন'}
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}