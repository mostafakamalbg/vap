import React, { useEffect, useMemo, useState } from 'react';
import { getInvoiceSalesAmount } from '../../shared/invoiceTotals';
import { isDealerBalanceCredit } from '../../shared/paymentMethods';
import { getDealerLedgerTransactions, getDealerNetDue } from '../../shared/dealerLedger';
import { toBnCurrency, toBnDate } from '../utils/bengali';

export default function DealerLedgerPortal() {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dealer-ledger', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'ডিলার লেজার লোড করা যায়নি।');
        return result;
      })
      .then((result) => { if (!cancelled) setLedger(result); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    if (!ledger) return null;
    const regularInvoices = (ledger.invoices || []).filter((invoice) => (
      !invoice.invoiceType || invoice.invoiceType === 'regular'
    ));
    const returns = (ledger.invoices || []).filter((invoice) => invoice.invoiceType === 'dealer_return');
    const purchases = regularInvoices.reduce((sum, invoice) => sum + getInvoiceSalesAmount(invoice), 0);
    const returnAmount = returns.reduce((sum, invoice) => sum + Math.abs(getInvoiceSalesAmount(invoice)), 0);
    const paidAmount = (ledger.payments || []).filter(isDealerBalanceCredit)
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const due = getDealerNetDue({
      openingDue: ledger.dealer.openingDue,
      totalBillAmount: purchases,
      totalReturnAmount: returnAmount,
      totalPaidAmount: paidAmount
    });
    return {
      purchases,
      returnAmount,
      paidAmount,
      due,
      transactions: getDealerLedgerTransactions({
        ...ledger.dealer,
        invoices: ledger.invoices,
        payments: ledger.payments
      }).reverse()
    };
  }, [ledger]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <header className="rounded-2xl bg-emerald-900 p-6 text-white shadow-lg">
        <p className="text-xs font-bold text-emerald-200">ডিলার অ্যাকাউন্ট</p>
        <h1 className="mt-1 text-2xl font-black">{ledger?.dealer?.shopName || 'আপনার লেজার'}</h1>
        {ledger?.dealer?.code && <p className="mt-1 text-sm text-emerald-100">ডিলার কোড: {ledger.dealer.code}</p>}
      </header>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">লেজার লোড হচ্ছে…</p>}
      {!loading && summary && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['প্রারম্ভিক বকেয়া', ledger.dealer.openingDue],
              ['মোট বিক্রয়', summary.purchases],
              ['মোট আদায়', summary.paidAmount],
              [summary.due < 0 ? 'অগ্রিম / ক্রেডিট' : 'বর্তমান বকেয়া', Math.abs(summary.due)]
            ].map(([label, amount]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-900">৳{toBnCurrency(amount)}</p>
              </div>
            ))}
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-black text-slate-900">আপনার বিক্রয় ও আদায় লেজার</h2>
              <p className="mt-1 text-xs text-slate-500">এই তালিকায় কেবল আপনার ডিলার অ্যাকাউন্টের রেকর্ড রয়েছে।</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600"><tr>
                  <th className="p-3">তারিখ</th><th className="p-3">বিবরণ</th><th className="p-3 text-right">ডেবিট</th><th className="p-3 text-right">ক্রেডিট / আদায়</th><th className="p-3 text-right">ব্যালেন্স</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="p-3">{transaction.date ? toBnDate(transaction.date) : '—'}</td>
                      <td className="p-3">{transaction.description} {transaction.reference ? `• ${transaction.reference}` : ''}</td>
                      <td className="p-3 text-right">৳{toBnCurrency(transaction.debit)}</td>
                      <td className="p-3 text-right">৳{toBnCurrency(transaction.credit)}</td>
                      <td className="p-3 text-right font-bold">৳{toBnCurrency(transaction.balance)}</td>
                    </tr>
                  ))}
                  {!summary.transactions.length && <tr><td colSpan="5" className="p-8 text-center text-slate-500">এখনো কোনো লেনদেন নেই।</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
