import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, PackageCheck, Plus, Send, ShoppingCart, TrendingUp } from 'lucide-react';
import { useAgro } from '../context/AgroContext';
import { useUiPreferences } from '../context/UiPreferencesContext';
import { formatDealerCode, formatOfficerCode, normalizeOfficerCode } from '../../shared/codes';

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'অনুরোধ সম্পন্ন করা যায়নি।');
  return result;
}

export default function OfficerDashboard() {
  const { currentUser, invoices, allProductVariants, dealers } = useAgro();
  const { t, language } = useUiPreferences();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([{ productId: '', sku: '', cartons: 1 }]);
  const [dealerId, setDealerId] = useState(dealers[0]?.id || '');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    requestJson('/api/orders')
      .then((data) => { if (!cancelled) setOrders(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, []);

  const salesInvoices = useMemo(
    () => invoices.filter((invoice) => (
      !['dealer_return', 'factory_damage'].includes(invoice.invoiceType)
      && (
        (currentUser?.officerId && invoice.officerId === currentUser.officerId)
        || (currentUser?.officerCode
          && normalizeOfficerCode(invoice.officerCode) === normalizeOfficerCode(currentUser.officerCode))
      )
    )),
    [currentUser?.officerCode, currentUser?.officerId, invoices]
  );
  const availableDealers = useMemo(() => dealers.filter((dealer) => (
    (dealer.assignedOfficerId && dealer.assignedOfficerId === currentUser?.officerId)
    || normalizeOfficerCode(dealer.assignedOfficerCode || dealer.officerCode)
      === normalizeOfficerCode(currentUser?.officerCode)
  )), [currentUser?.officerCode, currentUser?.officerId, dealers]);
  const sessions = useMemo(
    () => [...new Set(salesInvoices.map((invoice) => invoice.session).filter(Boolean))].sort().reverse(),
    [salesInvoices]
  );
  const months = useMemo(
    () => [...new Set(salesInvoices.map((invoice) => String(invoice.date || '').slice(0, 7)).filter((month) => /^\d{4}-\d{2}$/.test(month)))].sort().reverse(),
    [salesInvoices]
  );
  const filteredSalesInvoices = useMemo(() => salesInvoices.filter((invoice) => (
    (sessionFilter === 'ALL' || invoice.session === sessionFilter)
    && (monthFilter === 'ALL' || String(invoice.date || '').startsWith(monthFilter))
  )), [monthFilter, salesInvoices, sessionFilter]);
  const totalSales = filteredSalesInvoices.reduce((sum, invoice) => sum + (Number(invoice.totalAmount ?? invoice.grandTotal) || 0), 0);
  const totalDue = filteredSalesInvoices.reduce((sum, invoice) => sum + (Number(invoice.dueAmount ?? invoice.currentDue) || 0), 0);
  const officerProductSales = useMemo(() => {
    const sales = new Map();
    filteredSalesInvoices.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        const key = `${item.productId}::${item.sku}`;
        const sale = sales.get(key) || {
          key,
          productName: item.productName || 'পণ্য',
          size: item.size || '',
          cartons: 0,
          amount: 0
        };
        const cartons = Number(item.cartons ?? item.quantity) || 0;
        const tradePrice = Number(item.total) || cartons * (Number(item.cartonPrice) || 0);
        sale.cartons += cartons;
        sale.amount += tradePrice * (1 - (Number(item.commission) || 0) / 100);
        sales.set(key, sale);
      });
    });
    return [...sales.values()];
  }, [filteredSalesInvoices]);
  const totalCartonsSold = officerProductSales.reduce((sum, item) => sum + item.cartons, 0);
  const officerOrders = orders.filter((order) => order.officerId === currentUser?.officerId);
  const getVariantShortage = (variant) => {
    const orderedCartons = items
      .filter((item) => item.productId === variant.productId && item.sku === variant.sku)
      .reduce((sum, item) => sum + (Number(item.cartons) || 0), 0);
    return Math.max(0, orderedCartons - (Number(variant.stockCartons) || 0));
  };

  const updateItem = (index, field, value) => {
    setItems((previous) => previous.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const savedOrder = await requestJson('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, note, dealerId })
      });
      setOrders((previous) => [savedOrder, ...previous]);
      setItems([{ productId: '', sku: '', cartons: 1 }]);
      setDealerId(availableDealers[0]?.id || '');
      setNote('');
      setMessage(`${t('officer.orderSubmitted')} • ইনভয়েস নং ${savedOrder.invoiceNo}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-700 p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">{t('officer.dashboard')}</p>
        <h1 className="mt-1 text-2xl font-black">{t('officer.welcome')} {currentUser?.name}</h1>
        <p className="mt-1 text-sm text-emerald-100">{t('officer.code')} {formatOfficerCode(currentUser?.officerCode) || '—'} • {t('officer.onlineSales')}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('officer.invoiceCount'), value: filteredSalesInvoices.length.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US'), Icon: ClipboardList },
          { label: t('officer.salesAmount'), value: `৳${totalSales.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}`, Icon: TrendingUp },
          { label: 'মোট বকেয়া', value: `৳${totalDue.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}`, Icon: TrendingUp },
          { label: t('officer.cartonsSold'), value: totalCartonsSold.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US'), Icon: PackageCheck }
        ].map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
            <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-xl font-black text-slate-900">{value}</p></div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-black text-slate-900">{t('officer.salesSummary')}</h2>
              <p className="text-xs text-slate-500">{t('officer.approvedInvoices')}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  সেশন
                  <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="ALL">সকল সেশন</option>
                    {sessions.map((session) => <option key={session} value={session}>{session}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  মাস
                  <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="ALL">সকল মাস</option>
                    {months.map((month) => <option key={month} value={month}>{new Date(`${month}-01T00:00:00`).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3">{t('officer.invoice')}</th><th className="px-4 py-3">{t('officer.date')} / সেশন</th><th className="px-4 py-3">{t('officer.dealer')}</th><th className="px-4 py-3 text-right">কার্টুন</th><th className="px-4 py-3 text-right">{t('officer.sales')}</th><th className="px-4 py-3 text-right">বকেয়া</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalesInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3 font-bold text-emerald-800">{invoice.id}</td>
                      <td className="px-4 py-3">{invoice.date}<p className="text-[10px] text-slate-500">{invoice.session}</p></td>
                      <td className="px-4 py-3">{invoice.dealerName || '—'}</td>
                      <td className="px-4 py-3 text-right">{(invoice.items || []).reduce((sum, item) => sum + (Number(item.cartons ?? item.quantity) || 0), 0).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      <td className="px-4 py-3 text-right font-bold">৳{(Number(invoice.totalAmount ?? invoice.grandTotal) || 0).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-700">৳{(Number(invoice.dueAmount ?? invoice.currentDue) || 0).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    </tr>
                  ))}
                  {!filteredSalesInvoices.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">{t('officer.noInvoices')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-black text-slate-900">{t('officer.productsSold')}</h2>
              <p className="text-xs text-slate-500">{t('officer.productCartonSummary')}</p>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3">{t('officer.product')}</th><th className="px-4 py-3">{t('officer.packSize')}</th><th className="px-4 py-3 text-right">{t('officer.cartonsSoldLabel')}</th><th className="px-4 py-3 text-right">বিক্রয় মূল্য</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {officerProductSales.map((item) => (
                    <tr key={item.key}>
                      <td className="px-4 py-2.5 font-semibold">{item.productName}</td>
                      <td className="px-4 py-2.5">{item.size}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{item.cartons.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">৳{item.amount.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                    </tr>
                  ))}
                  {!officerProductSales.length && <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">{t('officer.noProductSales')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={submitOrder} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="flex items-center gap-2 font-black text-slate-900"><ShoppingCart className="h-5 w-5 text-emerald-700" /> {t('officer.newOrder')}</h2>
              <p className="mt-1 text-xs text-slate-500">{t('officer.orderApproval')}</p>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              ডিলার (আপনার অফিসার কোড অনুযায়ী) *
              <select required value={dealerId} onChange={(event) => setDealerId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">ডিলার নির্বাচন করুন</option>
                {availableDealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>
                    {formatDealerCode(dealer.code)} • {dealer.shopName} • {dealer.proprietor || ''}
                  </option>
                ))}
              </select>
              {!availableDealers.length && <span className="mt-1 block text-rose-700">আপনার কোডে কোনো ডিলার বরাদ্দ নেই।</span>}
            </label>
            {items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <select
                  required
                  value={item.productId && item.sku ? `${item.productId}::${item.sku}` : ''}
                  onChange={(event) => {
                    const selected = allProductVariants.find((variant) => variant.key === event.target.value);
                    updateItem(index, 'productId', selected?.productId || '');
                    updateItem(index, 'sku', selected?.sku || '');
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">{t('officer.selectProduct')}</option>
                  {allProductVariants.map((variant) => (
                    <option key={variant.key} value={variant.key}>
                      {variant.productName} — {variant.size} ({t('officer.stock')} {Number(variant.stockCartons || 0).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')} {t('officer.cartons')}{getVariantShortage(variant) > 0 ? ` • ঘাটতি ${getVariantShortage(variant)}` : ''})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <label className="flex-1 text-[11px] font-semibold text-slate-600">
                    {t('officer.cartonQuantity')}
                    <input required min="1" step="1" type="number" value={item.cartons} onChange={(event) => updateItem(index, 'cartons', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </label>
                  {(() => {
                    const selectedVariant = allProductVariants.find((variant) => variant.productId === item.productId && variant.sku === item.sku);
                    if (!selectedVariant) return null;
                    const shortage = getVariantShortage(selectedVariant);
                    return (
                      <p className={`mt-4 text-[11px] font-bold ${shortage ? 'text-rose-700' : 'text-emerald-700'}`}>
                        ডিপোতে {Number(selectedVariant.stockCartons) || 0} কার্টুন • {shortage ? `ঘাটতি ${shortage} কার্টুন` : 'অর্ডারের জন্য যথেষ্ট'}
                      </p>
                    );
                  })()}
                  {items.length > 1 && <button type="button" onClick={() => setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} className="mt-4 rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">{t('officer.remove')}</button>}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setItems((previous) => [...previous, { productId: '', sku: '', cartons: 1 }])} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Plus className="h-4 w-4" /> {t('officer.addProduct')}</button>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows="2" maxLength="500" placeholder={t('officer.orderNote')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">{message}</p>}
            <button disabled={busy || !allProductVariants.length || !dealerId} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              <Send className="h-4 w-4" /> {busy ? t('officer.submitting') : t('officer.submitOrder')}
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-black text-slate-900">ডিপোতে পণ্যের মজুদ ও অর্ডার ঘাটতি</h2>
              <p className="text-xs text-slate-500">প্রতিটি প্যাক সাইজের বর্তমান কার্টুন এবং আপনার অর্ডারে যত কার্টুন কম আছে</p>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[460px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3">পণ্য ও প্যাক সাইজ</th><th className="px-4 py-3 text-right">ডিপো স্টক</th><th className="px-4 py-3 text-right">ঘাটতি</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {allProductVariants.map((variant) => {
                    const shortage = getVariantShortage(variant);
                    return (
                      <tr key={variant.key}>
                        <td className="px-4 py-2.5 font-semibold">{variant.productName} • {variant.size}</td>
                        <td className="px-4 py-2.5 text-right">{Number(variant.stockCartons) || 0} কার্টুন</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${shortage ? 'text-rose-700' : 'text-emerald-700'}`}>{shortage ? `${shortage} কার্টুন` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-black text-slate-900">{t('officer.orderStatus')}</h2>
            <div className="space-y-2">
              {officerOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{order.invoiceNo || order.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${order.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : order.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {order.status === 'approved' ? t('officer.approved') : order.status === 'rejected' ? t('officer.rejected') : t('officer.pending')}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{order.dealerName ? `ডিলার: ${formatDealerCode(order.dealerCode)} • ${order.dealerName} • ` : ''}{(order.items || []).map((orderItem) => `${orderItem.productName} × ${orderItem.cartons}`).join(' • ')}</p>
                  {order.decisionNote && <p className="mt-1 text-[11px] text-slate-600">{t('officer.adminNote')} {order.decisionNote}</p>}
                </div>
              ))}
              {!officerOrders.length && <p className="text-xs text-slate-500">{t('officer.noOrders')}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
