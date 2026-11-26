import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer, Save, Trash2 } from 'lucide-react';
import { getNextInvoiceNumber, useAgro } from '../../context/AgroContext';
import { INVOICE_SESSIONS } from '../../../shared/sessions';
import {
  formatDealerCode,
  formatInvoiceNumber,
  formatOfficerCode,
  normalizeOfficerCode
} from '../../../shared/codes';
import { normalizePaymentMethod, PAYMENT_METHODS } from '../../../shared/paymentMethods';
import { getInvoiceItemAmounts, roundCurrency } from '../../../shared/invoiceTotals';
import { getItemCartons } from '../../../shared/invoiceCartons';
import { getPackageQuantityUnit } from '../../../shared/quantityUnits';
import { compareInvoiceItemsByIdAndSize } from '../../../shared/invoiceSorting';
import { toBnCurrency } from '../../utils/bengali';
import InvoicePrintHeader from './InvoicePrintHeader';
import SearchableRecordSelect from './SearchableRecordSelect';
import { printInvoiceSheet } from '../../utils/printInvoice';
import { isAdminRole, LOGISTIC_OFFICER_ROLE } from '../../../shared/roles';

const today = () => new Date().toISOString().slice(0, 10);
const TRANSPORT_OPTIONS = ['কাভার্ড ভ্যান', 'অটো', 'ভ্যান'];
const emptyItem = () => ({
  productKey: '',
  productId: '',
  productName: '',
  sku: '',
  size: '',
  cartons: 0,
  packPerBox: 1,
  unit: 'পিস/বোতল',
  cartonPrice: 0,
  unitPrice: 0,
  commission: 0,
  stockCondition: 'good',
  retailPieces: 0,
  piecePrice: 0,
  unitType: 'carton'
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

const INVOICE_TYPES = [
  { value: 'regular', label: 'রেগুলার ইনভয়েস' },
  { value: 'dealer_return', label: 'ডিলার কর্তৃক ফেরত' },
  { value: 'depot_factory_return', label: 'ডিপো থেকে ফ্যাক্টরি/ওয়্যারহাউসে ফেরত' }
];

function getDealerOfficerId(dealer, officers) {
  if (!dealer) return '';
  const assignedId = String(dealer.assignedOfficerId || dealer.officerId || '');
  const officerById = officers.find((officer) => (
    String(officer.id || officer.officerId || '') === assignedId
  ));
  if (officerById) return officerById.id || officerById.officerId;

  const assignedCode = normalizeOfficerCode(
    dealer.officerCode || dealer.assignedOfficerCode
  );
  return officers.find((officer) => (
    assignedCode
    && normalizeOfficerCode(officer.code, officer.designation) === assignedCode
  ))?.id || '';
}

export default function InvoiceGenerator({
  onViewInvoices,
  onInvoiceCreated,
  editInvoiceData,
  onCancelEdit
}) {
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
  const canAdminister = isAdminRole(currentUser?.role)
    || currentUser?.role === LOGISTIC_OFFICER_ROLE;
  const canEditInvoice = isAdminRole(currentUser?.role)
    || currentUser?.role === LOGISTIC_OFFICER_ROLE;
  const [form, setForm] = useState(() => ({
    id: editInvoiceData?.id || '',
    challanNo: editInvoiceData?.challanNo || '',
    date: editInvoiceData?.date || today(),
    session: INVOICE_SESSIONS.includes(editInvoiceData?.session)
      ? editInvoiceData.session
      : INVOICE_SESSIONS[0],
    officerId: editInvoiceData
      ? editInvoiceData.officerId || ''
      : getDealerOfficerId(dealers[0], officers) || officers[0]?.id || '',
    dealerId: editInvoiceData ? editInvoiceData.dealerId || '' : dealers[0]?.id || '',
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
      ? editInvoiceData.items.flatMap((item) => {
          const cartons = Number(item.cartons ?? item.quantity) || 0;
          const retailPieces = Number(item.retailPieces) || 0;
          const baseItem = {
            ...emptyItem(),
            ...item,
            productKey: `${item.productId}::${item.sku}`,
            cartons: item.cartons ?? item.quantity ?? (retailPieces > 0 ? 0 : 1),
            cartonPrice: Number(item.cartonPrice ?? (
              retailPieces > 0 && cartons === 0
                ? 0
                : Number(item.unitPrice) * Number(item.packPerBox || 1)
            )),
            commission: Number(item.commission) || 0,
            retailPieces,
            piecePrice: Number(item.piecePrice ?? (retailPieces > 0 ? item.unitPrice : 0)) || 0
          };
          if (cartons > 0 && retailPieces > 0) {
            return [
              { ...baseItem, retailPieces: 0, piecePrice: 0, unitType: 'carton' },
              { ...baseItem, cartons: 0, cartonPrice: 0, unitType: 'piece' }
            ];
          }
          return [{
            ...baseItem,
            unitType: cartons === 0 && retailPieces > 0
              ? 'piece'
              : item.unitType || 'carton'
          }];
        })
      : [emptyItem()]
  }));
  const [invoiceType, setInvoiceType] = useState(editInvoiceData?.invoiceType || 'regular');
  const [pendingInvoiceIds, setPendingInvoiceIds] = useState([]);
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(
    !editInvoiceData && canAdminister
  );
  const [invoiceNumberError, setInvoiceNumberError] = useState('');
  const [savedInvoice, setSavedInvoice] = useState(editInvoiceData || null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  useEffect(() => {
    if (editInvoiceData || !canAdminister) {
      setInvoiceNumberLoading(false);
      return undefined;
    }

    let cancelled = false;
    setInvoiceNumberLoading(true);
    setInvoiceNumberError('');
    Promise.all([fetch('/api/invoices'), fetch('/api/orders')])
      .then(async ([invoiceResponse, orderResponse]) => {
        const [serverInvoices, orders] = await Promise.all([
          invoiceResponse.json(),
          orderResponse.json()
        ]);
        if (!invoiceResponse.ok) {
          throw new Error(serverInvoices.error || 'ইনভয়েস তালিকা থেকে নম্বর যাচাই করা যায়নি।');
        }
        if (!orderResponse.ok) {
          throw new Error(orders.error || 'অর্ডার তালিকা থেকে ইনভয়েস নম্বর যাচাই করা যায়নি।');
        }
        if (!Array.isArray(serverInvoices) || !Array.isArray(orders)) {
          throw new Error('ইনভয়েস বা অর্ডার তালিকার তথ্য সঠিক নয়।');
        }
        return [
          ...serverInvoices.map((invoice) => invoice.id).filter(Boolean),
          ...orders.map((order) => order.invoiceNo).filter(Boolean)
        ];
      })
      .then((reservedIds) => {
        if (!cancelled) setPendingInvoiceIds(reservedIds);
      })
      .catch((loadError) => {
        if (!cancelled) setInvoiceNumberError(loadError.message || 'ইনভয়েস নম্বর যাচাই করা যায়নি।');
      })
      .finally(() => {
        if (!cancelled) setInvoiceNumberLoading(false);
      });

    return () => { cancelled = true; };
  }, [canAdminister, editInvoiceData]);

  const selectedOfficer = officers.find((officer) => officer.id === form.officerId);
  const selectedDealer = dealers.find((dealer) => dealer.id === form.dealerId);
  const selectedDealerName = selectedDealer?.shopName || selectedDealer?.name || '';
  const selectedDealerProprietor = selectedDealer?.proprietor || '';
  const selectedDealerCode = selectedDealer ? formatDealerCode(selectedDealer.code || selectedDealer.id) : '';
  const selectedDealerAddress = selectedDealer?.address || selectedDealer?.businessAddress || '';
  const selectedDealerPhone = selectedDealer?.phone || selectedDealer?.mobile || selectedDealer?.phoneNumber || '';
  const dealerSummary = selectedDealer ? getDealerSummary(selectedDealer.id) : null;
  const items = useMemo(() => form.items.map((item) => {
    const amounts = getInvoiceItemAmounts(item);
    return { ...item, ...amounts, quantity: amounts.cartons };
  }), [form.items]);
  const sortedFormItems = useMemo(() => form.items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compareInvoiceItemsByIdAndSize(left.item, right.item)), [form.items]);

  const isRegularInvoice = invoiceType === 'regular';
  const isDealerReturn = invoiceType === 'dealer_return';
  const isDepotFactoryReturn = invoiceType === 'depot_factory_return';
  const totalPieces = items.reduce((sum, item) => sum + item.totalPieces, 0);
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.total, 0));
  const commissionAmount = roundCurrency(items.reduce((sum, item) => sum + item.commissionAmount, 0));
  const returnAdjustments = isRegularInvoice ? form.returnAdjustments.map((item) => ({
    ...item,
    quantity: Math.max(0, Math.round(Number(item.quantity) || 0)),
    price: roundCurrency(item.price),
    total: roundCurrency(Math.max(0, Math.round(Number(item.quantity) || 0)) * roundCurrency(item.price))
  })) : [];
  const returnAdjustmentTotal = roundCurrency(returnAdjustments.reduce((sum, item) => sum + item.total, 0));
  const transportCost = isRegularInvoice ? roundCurrency(form.transportCost) : 0;
  const totalAmount = roundCurrency(isRegularInvoice
    ? Math.max(0, subtotal - commissionAmount + transportCost - returnAdjustmentTotal)
    : Math.max(0, subtotal - commissionAmount));
  const previousDue = roundCurrency(isRegularInvoice && editInvoiceData
    ? Number(editInvoiceData.previousDue) || 0
    : isRegularInvoice ? Number(dealerSummary?.currentDue) || 0 : 0);
  const netPayable = isRegularInvoice ? roundCurrency(totalAmount + previousDue) : 0;
  const paymentMethod = isRegularInvoice ? normalizePaymentMethod(form.paymentMethod) : 'credit';
  const paidAmount = isRegularInvoice && paymentMethod !== 'credit'
    ? roundCurrency(Math.max(0, Number(form.paidAmount) || 0))
    : 0;
  const dueAmount = isRegularInvoice ? roundCurrency(Math.max(0, netPayable - paidAmount)) : 0;
  const invoiceNumbers = useMemo(() => [
    ...invoices,
    ...pendingInvoiceIds.map((id) => ({ id }))
  ], [invoices, pendingInvoiceIds]);
  const { candidateId } = getNextInvoiceNumber(invoiceNumbers);

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

  const selectDealer = (dealerId) => {
    const dealer = dealers.find((entry) => entry.id === dealerId);
    setForm((current) => ({
      ...current,
      dealerId,
      officerId: getDealerOfficerId(dealer, officers)
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
              commission: variant?.commission || 0,
              retailPieces: 0,
              piecePrice: variant?.tp || 0,
              unitType: item.unitType || 'carton'
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
  const updateItemUnitType = (index, unitType) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, unitType, cartons: 0, retailPieces: 0 }
          : item
      ))
    }));
    setSavedInvoice(null);
    setSuccess('');
  };
  const removeItem = (index) => setForm((current) => ({
    ...current,
    items: current.items.length === 1
      ? [emptyItem()]
      : current.items.filter((_, itemIndex) => itemIndex !== index)
  }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (invoiceNumberLoading || invoiceNumberError) {
      setError(invoiceNumberError || 'ইনভয়েস নম্বর যাচাই হচ্ছে, একটু অপেক্ষা করুন।');
      return;
    }
    const invalidItem = items.some((item) => (
      !item.productId
      || !Number.isSafeInteger(item.cartons)
      || item.cartons < 0
      || !Number.isSafeInteger(item.retailPieces)
      || item.retailPieces < 0
      || item.cartons + item.retailPieces <= 0
      || (item.unitType === 'carton' && item.retailPieces > 0)
      || (item.unitType === 'piece' && item.cartons > 0)
      || !['carton', 'piece'].includes(item.unitType)
      || (item.retailPieces > 0 && (!Number.isFinite(Number(item.piecePrice)) || Number(item.piecePrice) <= 0))
      || !Number.isFinite(item.total)
      || item.total <= 0
    ));
    const invalidReturn = returnAdjustments.some((item) => (
      !item.productId
      || !Number.isSafeInteger(item.quantity)
      || item.quantity <= 0
      || !Number.isFinite(item.total)
    ));
    const invalidParties = (isRegularInvoice && (!selectedOfficer || !selectedDealer))
      || (isDealerReturn && !selectedDealer);
    if (!form.session || invalidParties || invalidItem || invalidReturn) {
      setError('সেশন, প্রয়োজনীয় অফিসার/ডিলার এবং প্রতিটি পণ্যের সঠিক তথ্য পূরণ করুন।');
      return;
    }

    const nextInvoice = editInvoiceData
      ? { candidateId: editInvoiceData.id, seqNumber: editInvoiceData.seqNumber || 0 }
      : getNextInvoiceNumber(invoiceNumbers);
    if (!editInvoiceData && invoiceNumbers.some((entry) => entry.id === nextInvoice.candidateId)) {
      setError('এই ইনভয়েস নম্বরটি আগে থেকেই আছে। নতুন ইনভয়েস নম্বর তৈরি করুন।');
      return;
    }
    const invoice = {
      ...(editInvoiceData || {}),
      id: nextInvoice.candidateId,
      invoiceNo: nextInvoice.candidateId,
      challanNo: form.challanNo.trim(),
      seqNumber: editInvoiceData?.seqNumber || nextInvoice.seqNumber,
      invoiceType,
      session: form.session,
      date: form.date,
      officerId: selectedOfficer?.id || '',
      officerCode: selectedOfficer
        ? formatOfficerCode(selectedOfficer.code, selectedOfficer.designation)
        : '',
      officerName: selectedOfficer?.name || '',
      officerDesignation: selectedOfficer?.designation || '',
      dealerId: selectedDealer?.id || '',
      dealerCode: selectedDealer ? formatDealerCode(selectedDealer.code) : '',
      dealerName: selectedDealerName,
      dealerProprietor: selectedDealerProprietor,
      dealerAddress: selectedDealerAddress,
      dealerPhone: selectedDealerPhone,
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        size: item.size,
        unit: item.unit,
        packPerBox: Number(item.packPerBox) || 1,
        cartons: item.cartons,
        quantity: item.cartons,
        retailPieces: item.retailPieces,
        piecePrice: Number(item.piecePrice) || 0,
        isRetailOnly: item.unitType === 'piece',
        unitType: item.unitType,
        totalPieces: item.totalPieces,
        cartonPrice: Number(item.cartonPrice) || 0,
        unitPrice: item.unitType === 'piece'
          ? Number(item.piecePrice) || 0
          : Number(item.unitPrice) || 0,
        commission: Number(item.commission) || 0,
        stockCondition: !isRegularInvoice && item.stockCondition === 'damaged' ? 'damaged' : 'good',
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
      totalCartons: items.reduce((sum, item) => sum + getItemCartons(item), 0),
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
      transport: isRegularInvoice ? form.transport : '',
      note: form.note.trim(),
      ...(isDealerReturn ? { returnReason: 'ডিলার কর্তৃক পণ্য ফেরত' } : {}),
      ...(isDepotFactoryReturn ? { returnReason: 'ডিপো থেকে ফ্যাক্টরি/ওয়্যারহাউসে ফেরত' } : {})
    };

    setPreviewInvoice(invoice);
  };

  const handleFinalSave = async () => {
    if (!previewInvoice) return;
    setSaving(true);
    try {
      const saved = editInvoiceData
        ? await updateInvoice(previewInvoice)
        : await createInvoice(previewInvoice);
      if (saved?.pendingApproval) {
        setSavedInvoice(null);
        setSuccess('পরিবর্তনের অনুরোধ সুপার অ্যাডমিন অনুমোদনের জন্য জমা হয়েছে।');
        setPreviewInvoice(null);
        return;
      }
      setSavedInvoice(saved);
      setSuccess(editInvoiceData ? 'ইনভয়েস আপডেট হয়েছে।' : 'ইনভয়েস তৈরি হয়েছে।');
      setPreviewInvoice(null);
      if (!editInvoiceData) {
        window.alert('ইনভয়েস সফলভাবে সংরক্ষণ করা হয়েছে!');
        onInvoiceCreated?.();
      }
    } catch (saveError) {
      setError(saveError.message || 'ইনভয়েস সংরক্ষণ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  if (editInvoiceData && !canEditInvoice) {
    return (
      <p role="alert" className="mx-auto mt-8 max-w-2xl rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">
        ইনভয়েস সম্পাদনার অনুমতি নেই।
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{editInvoiceData ? 'ইনভয়েস সম্পাদনা' : 'নতুন ইনভয়েস'}</h1>
          <p className="mt-1 text-sm text-slate-500">ইনভয়েস নং: {formatInvoiceNumber(editInvoiceData?.id || candidateId)}</p>
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

      {!editInvoiceData && (
        <fieldset className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <legend className="px-2 text-sm font-bold text-slate-700">ইনভয়েসের ধরন নির্বাচন করুন</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {INVOICE_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm font-bold transition ${
                  invoiceType === type.value
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                    : 'border-slate-300 text-slate-700 hover:border-emerald-400'
                }`}
              >
                <input
                  type="radio"
                  name="invoiceType"
                  value={type.value}
                  checked={invoiceType === type.value}
                  onChange={() => {
                    setInvoiceType(type.value);
                    setForm((current) => ({
                      ...current,
                      dealerId: '',
                      officerId: '',
                      ...(type.value === 'regular' ? {
                        items: current.items.map((item) => ({
                          ...item,
                          unitType: 'carton',
                          retailPieces: 0
                        }))
                      } : {})
                    }));
                    setSavedInvoice(null);
                    setSuccess('');
                  }}
                  className="accent-emerald-700"
                />
                {type.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{success}</p>}
      {invoiceNumberError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{invoiceNumberError}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            ইনভয়েস নং
            <input value={formatInvoiceNumber(editInvoiceData?.id || candidateId)} readOnly className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2" />
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
            label={`সেলস অফিসার${isRegularInvoice ? ' *' : ' (ঐচ্ছিক)'}`}
            items={officers}
            value={form.officerId}
            onChange={(value) => updateForm('officerId', value)}
            placeholder="অফিসার নির্বাচন করুন"
            searchPlaceholder="কোড, নাম বা পদবী দিয়ে খুঁজুন"
            optionLabel={(officer) => `${formatOfficerCode(officer.code, officer.designation) || '—'} • ${officer.name} • ${officer.designation || '—'}`}
            searchText={(officer) => `${formatOfficerCode(officer.code, officer.designation)} ${officer.name || ''} ${officer.designation || ''}`}
            required={isRegularInvoice}
          />
          <SearchableRecordSelect
            label={`ডিলার${isRegularInvoice || isDealerReturn ? ' *' : ' (ঐচ্ছিক)'}`}
            items={dealers}
            value={form.dealerId}
            onChange={selectDealer}
            placeholder="ডিলার নির্বাচন করুন"
            searchPlaceholder="ডিলার কোড বা নাম দিয়ে খুঁজুন"
            optionLabel={(dealer) => `${formatDealerCode(dealer.code)} • ${dealer.shopName}`}
            searchText={(dealer) => `${formatDealerCode(dealer.code)} ${dealer.shopName || ''} ${dealer.proprietor || ''}`}
            required={isRegularInvoice || isDealerReturn}
            resultsPlacement="top"
          />
          {selectedDealer && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 sm:col-span-2 lg:col-span-4">
              <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <p><strong>ডিলার কোড:</strong> {selectedDealerCode || '—'}</p>
                <p><strong>প্রতিষ্ঠান:</strong> {selectedDealerName || '—'}</p>
                <p><strong>প্রোপাইটর:</strong> {selectedDealerProprietor || '—'}</p>
                <p className="sm:col-span-2 lg:col-span-2"><strong>ঠিকানা:</strong> {selectedDealerAddress || '—'}</p>
                <p><strong>মোবাইল:</strong> {selectedDealerPhone || '—'}</p>
              </div>
            </div>
          )}
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
              <h2 className="text-lg font-bold text-slate-800">{isRegularInvoice ? 'পণ্যের তালিকা' : 'ফেরত পণ্যের তালিকা'}</h2>
              <p className="text-xs text-slate-500">
                {isRegularInvoice
                  ? 'ইউনিট অনুযায়ী কার্টুন বা পিসের পরিমাণ, কমিশন ও নেট মূল্য গণনা হবে।'
                  : 'ইউনিট অনুযায়ী ফেরত পরিমাণ, কমিশন ও নেট মূল্য গণনা হবে; ভালো/ডেমেজ অবস্থা নির্বাচন করুন।'}
              </p>
            </div>
            <button type="button" onClick={addItem} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">+ পণ্য যোগ করুন</button>
          </div>
          <div className="space-y-4 p-5">
            {sortedFormItems.map(({ item, index }) => (
              <div key={`invoice-item-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(190px,2fr)_minmax(105px,1fr)_minmax(90px,.8fr)_minmax(110px,1fr)_minmax(105px,.9fr)_minmax(120px,1fr)_auto_auto] lg:items-end">
                <label className="text-sm font-semibold text-slate-700">
                  পণ্য <span className="text-rose-600">*</span>
                  <select required value={item.productKey} onChange={(event) => selectProduct(index, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="">পণ্য নির্বাচন করুন</option>
                    {allProductVariants.map((variant) => <option key={variant.key} value={variant.key}>{variant.displayText}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  ইউনিট টাইপ / একক
                  <select value={item.unitType} onChange={(event) => updateItemUnitType(index, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="carton">{getPackageQuantityUnit(item)} (Carton)</option>
                    <option value="piece">পিস ({item.unit || 'পিস/বোতল'})</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {item.unitType === 'piece' ? 'খুচরা পিসের সংখ্যা' : `${isRegularInvoice ? 'কার্টুনের' : 'ফেরত কার্টুনের'} সংখ্যা`}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.unitType === 'piece' ? item.retailPieces : item.cartons}
                    onChange={(event) => updateItem(index, item.unitType === 'piece' ? 'retailPieces' : 'cartons', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {item.unitType === 'piece' ? 'প্রতি পিসের দর (৳)' : `ট্রেড প্রাইজ (৳/${getPackageQuantityUnit(item)})`}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.unitType === 'piece' ? item.piecePrice : item.cartonPrice}
                    onChange={(event) => updateItem(index, item.unitType === 'piece' ? 'piecePrice' : 'cartonPrice', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <div className="text-sm font-semibold text-slate-700">
                  কমিশন
                  <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 font-bold text-slate-900">{toBnCurrency(item.commission)}%</p>
                  <span className="mt-1 block text-xs text-slate-500">− ৳{toBnCurrency(items[index]?.commissionAmount)}</span>
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  নেট মূল্য
                  <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 font-bold text-slate-900">৳{toBnCurrency(items[index]?.netTotal)}</p>
                  <span className="mt-1 block text-xs text-slate-500">
                    মোট পিস: {toBnCurrency(items[index]?.totalPieces)} {item.unit}
                  </span>
                </div>
                {!isRegularInvoice && (
                  <label className="text-sm font-semibold text-slate-700">
                    পণ্যের অবস্থা
                    <select
                      value={item.stockCondition || 'good'}
                      onChange={(event) => updateItem(index, 'stockCondition', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="good">ভালো পণ্য</option>
                      <option value="damaged">ডেমেজ / মেয়াদোত্তীর্ণ</option>
                    </select>
                  </label>
                )}
                <button type="button" aria-label="পণ্য সরান" onClick={() => removeItem(index)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {isRegularInvoice && editInvoiceData && <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
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
                {returnAdjustments
                  .map((item, index) => ({ item, index }))
                  .sort((left, right) => compareInvoiceItemsByIdAndSize(left.item, right.item))
                  .map(({ item, index }) => (
                  <div key={`invoice-return-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_auto] lg:items-end">
                    <label className="text-sm font-semibold text-slate-700">
                      ফেরত পণ্য ও সাইজ
                      <select required value={item.productKey} onChange={(event) => updateReturnProduct(index, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                        <option value="">পণ্য নির্বাচন করুন</option>
                        {allProductVariants.map((variant) => <option key={variant.key} value={variant.key}>{variant.displayText}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {getPackageQuantityUnit(item) === 'কার্টুন' ? 'সংখ্যা (পিস/বোতল)' : `সংখ্যা (${getPackageQuantityUnit(item)})`}
                      <input type="number" min="1" step="1" required value={item.quantity} onChange={(event) => updateReturnAdjustment(index, 'quantity', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                      <span className="mt-1 block text-xs font-medium text-slate-500">
                        {getPackageQuantityUnit(item) === 'কার্টুন'
                          ? <>{toBnCurrency(Math.floor(returnAdjustments[index].quantity / (Number(item.packPerBox) || 1)))} কার্টুন {toBnCurrency(returnAdjustments[index].quantity % (Number(item.packPerBox) || 1))} {item.unit}</>
                          : <>{toBnCurrency(returnAdjustments[index].quantity)} {getPackageQuantityUnit(item)}</>}
                      </span>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      দর (৳/{getPackageQuantityUnit(item) === 'কার্টুন' ? item.unit || 'পিস' : getPackageQuantityUnit(item)})
                      <input type="number" min="0" step="1" required value={item.price} onChange={(event) => updateReturnAdjustment(index, 'price', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
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
        </section>}

        {isRegularInvoice ? <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              পরিবহন খরচ (৳)
              <input type="number" min="0" step="1" value={form.transportCost} onChange={(event) => updateForm('transportCost', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              পরিশোধিত (৳)
              <input type="number" min="0" step="1" value={paymentMethod === 'credit' ? '0' : form.paidAmount} onChange={(event) => updateForm('paidAmount', event.target.value)} disabled={paymentMethod === 'credit'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold text-slate-700">পেমেন্ট পদ্ধতি</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method.value;
                  return (
                    <label
                      key={method.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.value}
                        checked={isSelected}
                        onChange={(event) => updateForm('paymentMethod', event.target.value)}
                        className="accent-emerald-700"
                      />
                      {method.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
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
            <div className="flex justify-between"><span>মোট পিস</span><strong>{toBnCurrency(totalPieces)}</strong></div>
            <div className="flex justify-between"><span>পণ্যের মোট</span><strong>৳{toBnCurrency(subtotal)}</strong></div>
            <div className="flex justify-between"><span>কমিশন</span><strong>− ৳{toBnCurrency(commissionAmount)}</strong></div>
            {returnAdjustments.length > 0 && <div className="flex justify-between"><span>ফেরত পণ্য কর্তন</span><strong>− ৳{toBnCurrency(returnAdjustmentTotal)}</strong></div>}
            <div className="flex justify-between"><span>পরিবহন</span><strong>৳{toBnCurrency(transportCost)}</strong></div>
            <div className="flex justify-between border-t border-slate-300 pt-3 text-base"><strong>মোট বিল</strong><strong>৳{toBnCurrency(totalAmount)}</strong></div>
            <div className="flex justify-between"><span>পূর্বের বকেয়া</span><span>৳{toBnCurrency(previousDue)}</span></div>
            <div className="flex justify-between"><span>পরিশোধিত</span><span>৳{toBnCurrency(paidAmount)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-3 text-base text-rose-700"><strong>বর্তমান বকেয়া</strong><strong>৳{toBnCurrency(dueAmount)}</strong></div>
          </div>
        </section> : (
            <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              <div className="flex justify-between"><span>মোট ফেরত পিস</span><strong>{toBnCurrency(totalPieces)}</strong></div>
              <div className="flex justify-between"><span>পণ্যের মোট</span><strong>৳{toBnCurrency(subtotal)}</strong></div>
              <div className="flex justify-between"><span>কমিশন</span><strong>− ৳{toBnCurrency(commissionAmount)}</strong></div>
              <div className="flex justify-between gap-4 border-t border-amber-300 pt-3 text-base">
                <strong>{isDealerReturn ? 'ডিলার লেজারে জমা হবে (নেট)' : 'ফ্যাক্টরি/ওয়্যারহাউসে ফেরত নেট মূল্য'}</strong>
                <strong>৳{toBnCurrency(totalAmount)}</strong>
              </div>
              <p>
                {isDealerReturn
                  ? 'এই নেট পরিমাণটি নির্বাচিত ডিলারের বকেয়া থেকে কমবে।'
                  : 'ডিলার লেজারে কোনো পরিবর্তন হবে না; নির্বাচিত অবস্থান অনুযায়ী ডিপোর ভালো বা ডেমেজ স্টক কমবে।'}
              </p>
            </section>
        )}

        <div className="flex justify-end gap-3">
          <button type="submit" disabled={saving || invoiceNumberLoading || Boolean(invoiceNumberError)} className="rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
            <Printer className="mr-2 inline h-4 w-4" /> প্রিভিউ দেখুন
          </button>
        </div>
      </form>

      {previewInvoice && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-preview-title"
            className="my-auto w-full max-w-5xl rounded-2xl bg-slate-100 p-3 shadow-2xl sm:p-6"
          >
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="invoice-preview-title" className="text-xl font-black text-slate-900">সংরক্ষণের আগে ইনভয়েস প্রিভিউ</h2>
                <p className="text-sm text-slate-600">তথ্য যাচাই করে চূড়ান্তভাবে সংরক্ষণ করুন, অথবা সম্পাদনায় ফিরে যান।</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setPreviewInvoice(null);
                    setError('');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                >
                  সম্পাদনায় ফিরে যান
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleFinalSave}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="mr-2 inline h-4 w-4" />
                  {saving ? 'সংরক্ষণ হচ্ছে…' : editInvoiceData ? 'চূড়ান্তভাবে আপডেট করুন' : 'চূড়ান্তভাবে সংরক্ষণ করুন'}
                </button>
              </div>
            </div>
            {error && <p role="alert" className="no-print mb-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
            <InvoicePrintHeader invoice={previewInvoice} />
          </section>
        </div>
      )}

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
