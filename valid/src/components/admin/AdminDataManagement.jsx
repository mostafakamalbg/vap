import React, { useRef, useState } from 'react';
import { Database, Download, FileUp, ShieldCheck } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';

export default function AdminDataManagement() {
  const {
    currentUser,
    cloudReady,
    exportBackup,
    importBackup
  } = useAgro();
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

    </div>
  );
}