import React, { useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { isAdminRole } from '../../../shared/roles';
import { STOCK_RECONCILIATION_START_DATE } from '../../../shared/stockReconciliation';

export default function StockResetButton({ className = '', disabled = false }) {
  const { currentUser, cloudError, cloudReady, recalculateStock } = useAgro();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleRecalculate = async () => {
    if (!window.confirm('৩০-০৯-২০২৬ থেকে ইনভয়েস ও স্টক-ইন হিসাব করে পণ্যের বর্তমান স্টক পুনর্গণনা হবে। ইনভয়েস, ডিলার লেজার ও স্টক-ইন রেকর্ড পরিবর্তন বা মুছে ফেলা হবে না। এগোবেন?')) {
      return;
    }
    const confirmationText = window.prompt('নিশ্চিত করতে RECALCULATE লিখুন।');
    if (confirmationText !== 'RECALCULATE') return;
    const password = window.prompt('স্টক পুনর্গণনা নিশ্চিত করতে আপনার অ্যাডমিন পাসওয়ার্ড দিন।');
    if (!password) return;

    setBusy(true);
    try {
      const response = await recalculateStock(password, confirmationText);
      setResult({
        success: true,
        message: `${response.message} (${response.products}টি পণ্য, ${response.invoices}টি ইনভয়েস ও ${response.stockInLogs}টি স্টক-ইন হিসাব করা হয়েছে; শুরু ${STOCK_RECONCILIATION_START_DATE}.)`
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'স্টক পুনর্গণনা করা যায়নি।'
      });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdminRole(currentUser?.role)) return null;

  return (
    <>
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          disabled={busy || disabled || !cloudReady}
          onClick={handleRecalculate}
          title={!cloudReady ? 'ডেটাবেস সংযোগ প্রস্তুত হলে স্টক পুনর্গণনা চালু হবে।' : undefined}
          className={className || 'inline-flex items-center justify-center rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50'}
        >
          {busy ? 'পুনর্গণনা হচ্ছে…' : 'Recalculate Stock'}
        </button>
        {!cloudReady && (
          <p role={cloudError ? 'alert' : 'status'} className="text-xs font-semibold text-amber-800">
            {cloudError || 'ডেটাবেসের সঙ্গে সংযোগ সম্পন্ন হওয়ার অপেক্ষায়…'}
          </p>
        )}
      </div>
      {result && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-reset-result-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className={`flex items-center gap-2 ${result.success ? 'text-emerald-800' : 'text-rose-800'}`}>
              {result.success
                ? <CheckCircle className="h-6 w-6" />
                : <AlertTriangle className="h-6 w-6" />}
              <h2 id="stock-reset-result-title" className="text-lg font-black">
                {result.success ? 'পুনর্গণনা সফল' : 'পুনর্গণনা ব্যর্থ'}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700" role={result.success ? 'status' : 'alert'}>
              {result.message}
            </p>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              বন্ধ করুন
            </button>
          </section>
        </div>
      )}
    </>
  );
}
