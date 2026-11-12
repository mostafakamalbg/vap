import React, { useMemo, useState } from 'react';
import { ArrowLeft, Printer, Save, Trash2 } from 'lucide-react';
import { getNextInvoiceNumber, useAgro } from '../../context/AgroContext';
import { INVOICE_SESSIONS } from '../../../shared/sessions';
import { formatDealerCode, formatInvoiceNumber, formatOfficerCode } from '../../../shared/codes';
import { normalizePaymentMethod, PAYMENT_METHODS } from '../../../shared/paymentMethods';
import { getPackageQuantityUnit } from '../../../shared/quantityUnits';
import { toBnCurrency } from '../../utils/bengali';
import InvoicePrintHeader from './InvoicePrintHeader';
import SearchableRecordSelect from './SearchableRecordSelect';
import { printInvoiceSheet } from '../../utils/printInvoice';

const today = () => new Date().toISOString().slice(0, 10);
const TRANSPORT_OPTIONS = ['কাভার্ড ভ্যান', 'অটো', 'ভ্যান'];
const emptyItem = () => ({
  productKey: '',
  productId: '',
  productName: '',
  sku: '',
  size: '',
  cartons: 1,
  packPerBox: 1,
  unit: 'পিস/বোতল',
  cartonPrice: 0,
  unitPrice: 0,
  commission: 0
});

const emptyReturnAdjustment = () => ({
  productKey: '',
  productId: '',
  productName: '',
  sku: '',
  size: '',
  quantity: 1,
  unit: 'পিস/বোতল',
  packPerBox: 1,
  price: 0,
  total: 0,
  reason: 'মেয়াদ উত্তীর্ণ / ফেরত পণ্য'
});

export default function InvoiceGenerator({ onViewInvoices, editInvoiceData, onCancelEdit }) {
  const {
    allProductVariants,
    createInvoice,
    updateInvoice,
    invoices,
    currentUser,
    officers,
    dealers,
    getDealerSummary
  } = useAgro();
  const [form, setForm] = useState(() => ({
    id: editInvoiceData?.id || '',
    challanNo: editInvoiceData?.challanNo || '',
    date: editInvoiceData?.date || today(),
    session: INVOICE_SESSIONS.includes(editInvoiceData?.session)
      ? editInvoiceData.session
      : INVOICE_SESSIONS[0],
    officerId: editInvoiceData?.officerId || officers[0]?.id || '',
    dealerId: editInvoiceData?.dealerId || dealers[0]?.id || '',
    paidAmount: String(editInvoiceData?.paidAmount ?? ''),
    transportCost: String(editInvoiceData?.transportCost ?? ''),
    paymentMethod: editInvoiceData
      ? normalizePaymentMethod(editInvoiceData.paymentMethod)
      : 'credit',
    transport: editInvoiceData?.transport || '',
    note: editInvoiceData?.note || '',
    returnAdjustments: editInvoiceData?.returnAdjustments?.map((item) => ({
      ...emptyReturnAdjustment(),
      ...item,
      productKey: item.productId && item.sku ? `${item.productId}::${item.sku}` : '',
      quantity: item.quantity ?? item.quantityPieces ?? 1,
      price: item.price ?? item.unitPrice ?? 0
    })) || [],
    items: editInvoiceData?.items?.length
      ? editInvoiceData.items.map((item) => ({
          ...emptyItem(),
          ...item,
          productKey: `${item.productId}::${item.sku}`,
          cartons: item.cartons ?? item.quantity ?? 1,
          cartonPrice: Number(item.cartonPrice ?? (Number(item.unitPrice) * Number(item.packPerBox || 1))),
          commission: Number(item.commission) || 0
        }))
      : [emptyItem()]
  }));
  const [savedInvoice, setSavedInvoice] = useState(editInvoiceData || null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedOfficer = officers.find((officer) => officer.id === form.officerId);
  const selectedDealer = dealers.find((dealer) => dealer.id === form.dealerId);
  const dealerSummary = selectedDealer ? getDealerSummary(selectedDealer.id) : null;
  const items = useMemo(() => form.items.map((item) => {
    const quantity = Math.max(0, Number(item.cartons) || 0);
    const lineTotal = quantity * (Number(item.cartonPrice) || 0);
    return { ...item, cartons: quantity, quantity, total: lineTotal };
  }), [form.items]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const commissionAmount = items.reduce(
    (sum, item) => sum + item.total * (Number(item.commission) || 0) / 100,
    0
  );
  const returnAdjustments = form.returnAdjustments.map((item) => ({
    ...item,
    quantity: Math.max(0, Number(item.quantity) || 0),
    price: Math.max(0, Number(item.price) || 0),
    total: Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.price) || 0)
  }));
  const returnAdjustmentTotal = returnAdjustments.reduce((sum, item) => sum + item.total, 0);
  const transportCost = Math.max(0, Number(form.transportCost) || 0);
  const totalAmount = Math.max(0, subtotal - commissionAmount + transportCost - returnAdjustmentTotal);
  const previousDue = editInvoiceData
    ? Number(editInvoiceData.previousDue) || 0
    : Number(dealerSummary?.currentDue) || 0;
  const netPayable = totalAmount + previousDue;
  const paymentMethod = normalizePaymentMethod(form.paymentMethod);
  const paidAmount = paymentMethod === 'credit' ? 0 : Math.max(0, Number(form.paidAmount) || 0);
  const dueAmount = Math.max(0, netPayable - paidAmount);

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'paymentMethod' && normalizePaymentMethod(value) === 'credit'
        ? { paidAmount: '0' }
        : {})
    }));
    setSavedInvoice(null);
    setSuccess('');
  };

  const updateItem = (index, key, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      ))
    }));
    setSavedInvoice(null);
    setSuccess('');
  };

  const selectProduct = (index, productKey) => {
    const variant = allProductVariants.find((entry) => entry.key === productKey);
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index
          ? {
              ...item,
              productKey,
              productId: variant?.productId || '',
              productName: variant?.productName || '',
              sku: variant?.sku || '',
              size: variant?.size || '',
              packPerBox: variant?.packPerBox || 1,
              unit: variant?.unit || 'পিস/বোতল',
              cartonPrice: variant?.cartonPrice || 0,
              unitPrice: variant?.tp || 0,
              commission: variant?.commission || 0
            }
          : item
      ))
    }));
    setSavedInvoice(null);
    setSuccess('');
  };

  const updateReturnProduct = (index, productKey) => {
    const variant = allProductVariants.find((entry) => entry.key === productKey);
    setForm((current) => ({
      ...current,
      returnAdjustments: current.returnAdjustments.map((item, itemIndex) => (
        itemIndex === index
          ? {
              ...item,
              productKey,
              productId: variant?.productId || '',
              productName: variant?.productName || '',
              sku: variant?.sku || '',
              size: variant?.size || '',
              unit: variant?.unit || 'পিস/বোতল',
              packPerBox: variant?.packPerBox || 1,
              price: variant?.tp || 0
            }
          : item
      ))
    }));
    setSavedInvoice(null);
    setSuccess('');
  };
  const updateReturnAdjustment = (index, key, value) => {
    setForm((current) => ({
      ...current,
      returnAdjustments: current.returnAdjustments.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      ))
    }));
    setSavedInvoice(null);
    setSuccess('');
  };
  const addReturnAdjustment = () => setForm((current) => ({
    ...current,
    returnAdjustments: [...current.returnAdjustments, emptyReturnAdjustment()]
  }));
  const removeReturnAdjustment = (index) => setForm((current) => ({
    ...current,
    returnAdjustments: current.returnAdjustments.filter((_, itemIndex) => itemIndex !== index)
  }));

  const addItem = () => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  const removeItem = (index) => setForm((current) => ({
    ...current,
    items: current.items.length === 1
      ? [emptyItem()]
      : current.items.filter((_, itemIndex) => itemIndex !== index)
  }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const invalidItem = items.some((item) => (
      !item.productId
      || !Number.isSafeInteger(item.cartons)
      || item.cartons <= 0
      || !Number.isFinite(item.total)
      || item.total <= 0
    ));
    const invalidReturn = returnAdjustments.some((item) => (
      !item.productId
      || !Number.isSafeInteger(item.quantity)
      || item.quantity <= 0
      || !Number.isFinite(item.total)
    ));
    if (!form.session || !selectedOfficer || !selectedDealer || invalidItem || invalidReturn) {
      setError('সেশন, অফিসার, ডিলার এবং প্রতিটি পণ্যের সঠিক তথ্য পূরণ করুন।');
      return;
    }

    let numberedInvoices = invoices;
    if (!editInvoiceData && currentUser?.role === 'admin') {
      try {
        const response = await fetch('/api/orders');
        let pendingOrders;
        try {
          pendingOrders = await response.json();
        } catch {
          throw new Error('অর্ডার তালিকা থেকে ইনভয়েস নম্বর যাচাই করা যায়নি।');
        }
        if (!response.ok) throw new Error(pendingOrders.error || 'ইনভয়েস নম্বর যাচাই করা যায়নি।');
        numberedInvoices = [
          ...invoices,
          ...pendingOrders.map((order) => ({ id: order.invoiceNo }))
        ];
      } catch (numberError) {
        setError(numberError.message || 'ইনভয়েস নম্বর যাচাই করা যায়নি।');
        return;
      }
    }

    const { candidateId, seqNumber } = getNextInvoiceNumber(numberedInvoices);
    const invoice = {
      ...(editInvoiceData || {}),
      id: editInvoiceData?.id || candidateId,
      invoiceNo: editInvoiceData?.id || candidateId,
      challanNo: form.challanNo.trim(),
      seqNumber: editInvoiceData?.seqNumber || seqNumber,
      session: form.session,
      date: form.date,
      officerId: selectedOfficer.id,
      officerCode: formatOfficerCode(selectedOfficer.code, selectedOfficer.designation),
      officerName: selectedOfficer.name,
      officerDesignation: selectedOfficer.designation || '',
      dealerId: selectedDealer.id,
      dealerCode: formatDealerCode(selectedDealer.code),
      dealerName: selectedDealer.shopName,
      dealerProprietor: selectedDealer.proprietor || '',
      dealerAddress: selectedDealer.address || '',
      dealerPhone: selectedDealer.phone || '',
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        size: item.size,
        unit: item.unit,
        packPerBox: Number(item.packPerBox) || 1,
        cartons: item.cartons,
        quantity: item.cartons,
        totalPieces: item.cartons * (Number(item.packPerBox) || 1),
        cartonPrice: Number(item.cartonPrice) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        commission: Number(item.commission) || 0,
        total: item.total
      })),
      returnAdjustments: returnAdjustments.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        size: item.size,
        quantity: item.quantity,
        quantityPieces: item.quantity,
        unit: item.unit,
        packPerBox: item.packPerBox,
        price: item.price,
        unitPrice: item.price,
        total: item.total,
        reason: item.reason
      })),
      returnAdjustmentTotal,
      totalCartons: items.reduce((sum, item) => sum + item.cartons, 0),
      subtotal,
      commissionAmount,
      transportCost,
      totalAmount,
      grandTotal: totalAmount,
      previousDue,
      netPayable,
      paidAmount,
      currentDue: dueAmount,
      dueAmount,
      paymentMethod,
      transport: form.transport,
      note: form.note.trim()
    };

    try {
      const saved = editInvoiceData
        ? await updateInvoice(invoice)
        : await createInvoice(invoice);
      setSavedInvoice(saved);
      setSuccess(editInvoiceData ? 'ইনভয়েস আপডেট হয়েছে।' : 'ইনভয়েস তৈরি হয়েছে।');
    } catch (saveError) {
      setError(saveError.message || 'ইনভয়েস সংরক্ষণ করা যায়নি।');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{editInvoiceData ? 'ইনভয়েস সম্পাদনা' : 'নতুন ইনভয়েস'}</h1>
          <p className="mt-1 text-sm text-slate-500">ইনভয়েস নং: {formatInvoiceNumber(editInvoiceData?.id || getNextInvoiceNumber(invoices).candidateId)}</p>
        </div>
        <div className="flex gap-2">
          {onCancelEdit && (
            <button type="button" onClick={onCancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              <ArrowLeft className="mr-2 inline h-4 w-4" /> ফিরে যান
            </button>
          )}
          {onViewInvoices && (
            <button type="button" onClick={onViewInvoices} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              ইনভয়েস তালিকা
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            ইনভয়েস নং
            <input value={formatInvoiceNumber(editInvoiceData?.id || getNextInvoiceNumber(invoices).candidateId)} readOnly className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            চালান নং
            <input value={form.challanNo} onChange={(event) => updateForm('challanNo', event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            তারিখ <span className="text-rose-600">*</span>
            <input type="date" required value={form.date} onChange={(event) => updateForm('date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            পরিবহনের মাধ্যম
            <select value={form.transport} onChange={(event) => updateForm('transport', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="">পরিবহন মাধ্যম নির্বাচন করুন</option>
              {form.transport && !TRANSPORT_OPTIONS.includes(form.transport) && (
                <option value={form.transport}>{form.transport}</option>
              )}
              {TRANSPORT_OPTIONS.map((transport) => <option key={transport} value={transport}>{transport}</option>)}
            </select>
          </label>
          <SearchableRecordSelect
            label="সেলস অফিসার *"
            items={officers}
            value={form.officerId}
            onChange={(value) => updateForm('officerId', value)}
            placeholder="অফিসার নির্বাচন করুন"
            searchPlaceholder="কোড, নাম বা পদবী দিয়ে খুঁজুন"
            optionLabel={(officer) => `${formatOfficerCode(officer.code, officer.designation) || '—'} • ${officer.name} • ${officer.designation || '—'}`}
            searchText={(officer) => `${formatOfficerCode(officer.code, officer.designation)} ${officer.name || ''} ${officer.designation || ''}`}
          />
          <SearchableRecordSelect
            label="ডিলার *"
            items={dealers}
            value={form.dealerId}
            onChange={(value) => updateForm('dealerId', value)}
            placeholder="ডিলার নির্বাচন করুন"
            searchPlaceholder="ডিলার কোড বা নাম দিয়ে খুঁজুন"
            optionLabel={(dealer) => `${formatDealerCode(dealer.code)} • ${dealer.shopName}`}
            searchText={(dealer) => `${formatDealerCode(dealer.code)} ${dealer.shopName || ''} ${dealer.proprietor || ''}`}
          />
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-4">
            সেশন <span className="text-rose-600">*</span>
            <select required value={form.session} onChange={(event) => updateForm('session', event.target.value)} className="mt-1 w-full rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-3 text-base font-bold text-emerald-900">
              <option value="">সেশন নির্বাচন করুন</option>
              {INVOICE_SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
            </select>
          </label>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">পণ্যের তালিকা</h2>
              <p className="text-xs text-slate-500">প্যাক সাইজ অনুযায়ী পরিমাণ ও মূল্য গণনা হবে।</p>
            </div>
            <button type="button" onClick={addItem} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">+ পণ্য যোগ করুন</button>
          </div>
          <div className="space-y-4 p-5">
            {form.items.map((item, index) => (
              <div key={`invoice-item-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto] lg:items-end">
                <label className="text-sm font-semibold text-slate-700">
                  পণ্য <span className="text-rose-600">*</span>
                  <select required value={item.productKey} onChange={(event) => selectProduct(index, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="">পণ্য নির্বাচন করুন</option>
                    {allProductVariants.map((variant) => <option key={variant.key} value={variant.key}>{variant.displayText}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  পরিমাণ ({getPackageQuantityUnit(item)}) <span className="text-rose-600">*</span>
                  <input type="number" min="1" step="1" required value={item.cartons} onChange={(event) => updateItem(index, 'cartons', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  একক মূল্য (৳/{getPackageQuantityUnit(item)})
                  <input type="number" min="0" step="0.01" required value={item.cartonPrice} onChange={(event) => updateItem(index, 'cartonPrice', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <div className="text-sm font-semibold text-slate-700">
                  মোট
                  <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 font-bold text-slate-900">৳{toBnCurrency(items[index]?.total)}</p>
                </div>
                <button type="button" aria-label="পণ্য সরান" onClick={() => removeItem(index)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
          {returnAdjustments.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 p-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">মেয়াদ উত্তীর্ণ / ফেরত পণ্য সমন্বয় (বিল কর্তন)</h2>
                  <p className="text-xs text-slate-500">প্রতি পিসের দর অনুযায়ী বিল থেকে কর্তন হবে।</p>
                </div>
                <button type="button" onClick={addReturnAdjustment} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">+ ফেরত পণ্য যোগ করুন</button>
              </div>
              <div className="space-y-3 p-5">
                {returnAdjustments.map((item, index) => (
                  <div key={`invoice-return-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_auto] lg:items-end">
                    <label className="text-sm font-semibold text-slate-700">
                      ফেরত পণ্য ও সাইজ
                      <select required value={item.productKey} onChange={(event) => updateReturnProduct(index, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                        <option value="">পণ্য নির্বাচন করুন</option>
                        {allProductVariants.map((variant) => <option key={variant.key} value={variant.key}>{variant.displayText}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      সংখ্যা (পিস/বোতল)
                      <input type="number" min="1" step="1" required value={item.quantity} onChange={(event) => updateReturnAdjustment(index, 'quantity', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                      <span className="mt-1 block text-xs font-medium text-slate-500">
                        {toBnCurrency(Math.floor(returnAdjustments[index].quantity / (Number(item.packPerBox) || 1)))} কার্টুন {toBnCurrency(returnAdjustments[index].quantity % (Number(item.packPerBox) || 1))} {item.unit}
                      </span>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      দর (৳/পিস)
                      <input type="number" min="0" step="0.01" required value={item.price} onChange={(event) => updateReturnAdjustment(index, 'price', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <button type="button" aria-label="ফেরত পণ্য সরান" onClick={() => removeReturnAdjustment(index)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <p className="text-xs font-bold text-amber-800 sm:col-span-2 lg:col-span-4">
                      কর্তন: ৳{toBnCurrency(returnAdjustments[index]?.total)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-5">
              <button type="button" onClick={addReturnAdjustment} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">+ মেয়াদ উত্তীর্ণ / ফেরত পণ্য যোগ করুন</button>
            </div>
          )}
        </section>

        <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              পরিবহন খরচ (৳)
              <input type="number" min="0" step="0.01" value={form.transportCost} onChange={(event) => updateForm('transportCost', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              পরিশোধিত (৳)
              <input type="number" min="0" step="0.01" value={paymentMethod === 'credit' ? '0' : form.paidAmount} onChange={(event) => updateForm('paidAmount', event.target.value)} disabled={paymentMethod === 'credit'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              পেমেন্ট পদ্ধতি
              <select value={form.paymentMethod} onChange={(event) => updateForm('paymentMethod', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </label>
            {paymentMethod === 'credit' && (
              <p className="text-xs font-medium text-amber-800 sm:col-span-2">
                ক্রেডিট ইনভয়েসে কোনো তাৎক্ষণিক পরিশোধ হবে না; সম্পূর্ণ ইনভয়েস বকেয়ায় যুক্ত হবে। ডিলারের পরবর্তী পেমেন্ট আলাদা লেজার এন্ট্রি হিসেবে যোগ করুন।
              </p>
            )}
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              নোট
              <textarea rows="2" value={form.note} onChange={(event) => updateForm('note', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="space-y-3 rounded-lg bg-slate-50 p-5 text-sm">
            <div className="flex justify-between"><span>পণ্যের মোট</span><strong>৳{toBnCurrency(subtotal)}</strong></div>
            <div className="flex justify-between"><span>কমিশন</span><strong>− ৳{toBnCurrency(commissionAmount)}</strong></div>
            {returnAdjustments.length > 0 && <div className="flex justify-between"><span>ফেরত পণ্য কর্তন</span><strong>− ৳{toBnCurrency(returnAdjustmentTotal)}</strong></div>}
            <div className="flex justify-between"><span>পরিবহন</span><strong>৳{toBnCurrency(transportCost)}</strong></div>
            <div className="flex justify-between border-t border-slate-300 pt-3 text-base"><strong>মোট বিল</strong><strong>৳{toBnCurrency(totalAmount)}</strong></div>
            <div className="flex justify-between"><span>পূর্বের বকেয়া</span><span>৳{toBnCurrency(previousDue)}</span></div>
            <div className="flex justify-between"><span>পরিশোধিত</span><span>৳{toBnCurrency(paidAmount)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-3 text-base text-rose-700"><strong>বর্তমান বকেয়া</strong><strong>৳{toBnCurrency(dueAmount)}</strong></div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button type="submit" className="rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">
            <Save className="mr-2 inline h-4 w-4" /> {editInvoiceData ? 'আপডেট করুন' : 'ইনভয়েস সংরক্ষণ করুন'}
          </button>
        </div>
      </form>

      {savedInvoice && (
        <section className="space-y-4">
          <div className="no-print flex justify-end">
            <button type="button" onClick={() => printInvoiceSheet(document.querySelector('.invoice-print-sheet'))} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">
              <Printer className="mr-2 inline h-4 w-4" /> ইনভয়েস প্রিন্ট করুন
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 sm:p-6">
            <InvoicePrintHeader invoice={savedInvoice} />
          </div>
        </section>
      )}
    </div>
  );
}
