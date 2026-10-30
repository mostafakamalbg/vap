import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  CheckCircle,
  AlertCircle,
  Building2,
  Phone,
  Calendar,
  User,
  ShoppingBag,
  ArrowRight,
  RefreshCw,
  Lock,
  RotateCcw,
  Truck,
  AlertTriangle,
  FileEdit,
  X
} from 'lucide-react';
import { useAgro, getNextInvoiceNumber } from '../../context/AgroContext';
import { toBn, toBnCurrency, toBnDate } from '../../utils/bengali';

export default function InvoiceGenerator({ onViewInvoices, editInvoiceData, onCancelEdit }) {
  const {
    products,
    dealers,
    officers,
    invoices,
    allProductVariants,
    createInvoice,
    updateInvoice,
    getDealerSummary
  } = useAgro();

  // Invoice Mode: 'regular' (রেগুলার বিক্রয়) | 'dealer_return' (ডিলার ফেরত) | 'factory_damage' (ফ্যাক্টরি ড্যামেজ)
  const [invoiceType, setInvoiceType] = useState('regular');

  // Unique Invoice ID & Date
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));

  // Dealer selection & auto-populated fields
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [dealerDetails, setDealerDetails] = useState({
    code: '',
    shopName: '',
    proprietor: '',
    address: '',
    phone: '',
    zone: '',
    officerCode: '',
    officerId: '',
    transport: ''
  });

  // Regular / Return Carton Items (Single select for product + pack size)
  const [items, setItems] = useState([]);

  // Loose / Retail pieces adjustment (খুচরা বোতল / প্যাক)
  const [looseItems, setLooseItems] = useState([]);

  // Adjustments & Final Settlement
  const [transportCost, setTransportCost] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('নগদ জমা');
  const [note, setNote] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewInvoice, setPreviewInvoice] = useState(null);

  // Initialize or populate from editInvoiceData
  useEffect(() => {
    if (editInvoiceData) {
      setInvoiceId(editInvoiceData.id);
      setInvoiceDate(editInvoiceData.date || new Date().toISOString().slice(0, 10));
      setInvoiceType(editInvoiceData.invoiceType || 'regular');
      setSelectedDealerId(editInvoiceData.dealerId || '');
      setDealerDetails({
        code: editInvoiceData.dealerCode || '',
        shopName: editInvoiceData.dealerName || '',
        proprietor: editInvoiceData.dealerProprietor || '',
        address: editInvoiceData.dealerAddress || '',
        phone: editInvoiceData.dealerPhone || '',
        zone: editInvoiceData.zone || '',
        officerCode: editInvoiceData.officerCode || '5',
        officerId: editInvoiceData.officerId || 'OFF-05',
        transport: editInvoiceData.transport || ''
      });
      setItems(editInvoiceData.items || []);
      setLooseItems(editInvoiceData.returnAdjustments || []);
      setTransportCost(Number(editInvoiceData.transportCost) || 0);
      setPaidAmount(Number(editInvoiceData.paidAmount) || 0);
      setPaymentMethod(editInvoiceData.paymentMethod || 'নগদ জমা');
      setNote(editInvoiceData.note || '');
    } else {
      // Auto-assign guaranteed unique invoice ID
      const { candidateId } = getNextInvoiceNumber(invoices);
      setInvoiceId(candidateId);
      // Initialize with first product variant
      if (allProductVariants.length > 0 && items.length === 0) {
        const first = allProductVariants[0];
        setItems([
          {
            variantKey: first.key,
            productId: first.productId,
            productName: first.productName,
            sku: first.sku,
            size: first.size,
            packPerBox: first.packPerBox,
            unit: first.unit,
            cartonPrice: first.cartonPrice,
            cartons: 1, // Minimum 1 carton by default
            commissionPercent: 20
          }
        ]);
      }
    }
  }, [editInvoiceData, invoices, allProductVariants]);

  // When a dealer is selected, auto-fill all fields instantly
  const handleDealerSelect = (dlrId) => {
    setSelectedDealerId(dlrId);
    if (!dlrId) {
      setDealerDetails({
        code: '',
        shopName: '',
        proprietor: '',
        address: '',
        phone: '',
        zone: '',
        officerCode: '',
        officerId: '',
        transport: ''
      });
      return;
    }

    const d = dealers.find((item) => item.id === dlrId || item.code === dlrId);
    if (d) {
      setDealerDetails({
        code: d.code || '',
        shopName: d.shopName || '',
        proprietor: d.proprietor || '',
        address: d.address || '',
        phone: d.phone || '',
        zone: d.zone || '',
        officerCode: d.officerCode || '5',
        officerId: d.assignedOfficerId || 'OFF-05',
        transport: d.transport || ''
      });
    }
  };

  // Selected dealer previous due balance
  const currentDealerSummary = selectedDealerId ? getDealerSummary(selectedDealerId) : null;
  const previousDue = currentDealerSummary ? currentDealerSummary.currentDue : 0;

  // Single-step Product Variant Selection handler
  const handleSelectProductVariant = (index, variantKey) => {
    const selectedVar = allProductVariants.find((v) => v.key === variantKey);
    if (!selectedVar) return;

    const updated = [...items];
    updated[index] = {
      ...updated[index],
      variantKey,
      productId: selectedVar.productId,
      productName: selectedVar.productName,
      sku: selectedVar.sku,
      size: selectedVar.size,
      packPerBox: selectedVar.packPerBox,
      unit: selectedVar.unit,
      cartonPrice: selectedVar.cartonPrice,
      commissionPercent: updated[index]?.commissionPercent || 20,
      cartons: Math.max(1, Number(updated[index]?.cartons) || 1)
    };
    setItems(updated);
  };

  // Add Item Line
  const handleAddItem = () => {
    const first = allProductVariants[0];
    if (!first) return;

    setItems([
      ...items,
      {
        variantKey: first.key,
        productId: first.productId,
        productName: first.productName,
        sku: first.sku,
        size: first.size,
        packPerBox: first.packPerBox,
        unit: first.unit,
        cartonPrice: first.cartonPrice,
        cartons: 1, // Minimum 1 carton
        commissionPercent: 20
      }
    ]);
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Update item field (cartons, or editable fields if Return / Factory Damage)
  const handleItemFieldChange = (index, field, value) => {
    const updated = [...items];
    const current = { ...updated[index] };

    if (field === 'cartons') {
      current.cartons = Math.max(1, Number(value) || 1);
    } else if (field === 'cartonPrice') {
      current.cartonPrice = Number(value) || 0;
    } else if (field === 'commissionPercent') {
      current.commissionPercent = Number(value) || 0;
    } else if (field === 'size') {
      current.size = value;
    }

    updated[index] = current;
    setItems(updated);
  };

  // Add loose / retail damaged piece
  const handleAddLooseItem = () => {
    const first = allProductVariants[0];
    setLooseItems([
      ...looseItems,
      {
        id: `loose-${Date.now()}`,
        productId: first?.productId || '',
        sku: first?.sku || '',
        productName: first?.productName || '',
        size: first?.size || '',
        quantity: 1,
        price: first?.tp || 0,
        commissionPercent: 0,
        reason: invoiceType === 'regular' ? 'মেয়াদোত্তীর্ণ ১ বোতল ফেরত' : 'ড্যামেজ / নষ্ট প্যাক'
      }
    ]);
  };

  const handleRemoveLooseItem = (index) => {
    setLooseItems(looseItems.filter((_, i) => i !== index));
  };

  const handleLooseFieldChange = (index, field, value) => {
    const updated = [...looseItems];
    const current = { ...updated[index], [field]: value };

    if (field === 'variantKey') {
      const selected = allProductVariants.find((v) => v.key === value);
      if (selected) {
        current.variantKey = value;
        current.productId = selected.productId;
        current.productName = selected.productName;
        current.sku = selected.sku;
        current.size = selected.size;
        current.price = selected.tp;
      }
    }

    updated[index] = current;
    setLooseItems(updated);
  };

  // Compute Totals
  const isReturnOrDamage = invoiceType === 'dealer_return' || invoiceType === 'factory_damage';

  const preparedItems = items.map((item) => {
    const cartons = Number(item.cartons) || 1;
    const packPerBox = Number(item.packPerBox) || 1;
    const totalPieces = cartons * packPerBox;
    const cartonPrice = Number(item.cartonPrice) || 0;
    const subtotal = cartons * cartonPrice;
    const commissionPercent = Number(item.commissionPercent) ?? 20;
    const commissionAmount = Math.round((subtotal * commissionPercent) / 100);
    const lineNetTotal = Math.max(0, subtotal - commissionAmount);

    return {
      ...item,
      cartons,
      totalPieces,
      cartonPrice,
      subtotal,
      commissionPercent,
      commissionAmount,
      total: lineNetTotal
    };
  });

  const preparedLoose = looseItems.map((it) => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.price) || 0;
    const subtotal = qty * price;
    const commPct = Number(it.commissionPercent) || 0;
    const commAmt = Math.round((subtotal * commPct) / 100);
    const total = subtotal - commAmt;
    return {
      ...it,
      quantity: qty,
      price,
      total,
      commissionPercent: commPct,
      commissionAmount: commAmt
    };
  });

  const totalCartons = preparedItems.reduce((acc, curr) => acc + curr.cartons, 0);
  const totalSubtotal = preparedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  const totalCommission = preparedItems.reduce((acc, curr) => acc + curr.commissionAmount, 0);
  const netGoodsValue = totalSubtotal - totalCommission;

  const totalLooseValue = preparedLoose.reduce((acc, curr) => acc + curr.total, 0);

  // If Regular Invoice: loose items are deducted as returns
  // If Return / Damage Invoice: all items constitute the return credit
  let invoiceNetBill = 0;
  if (invoiceType === 'regular') {
    invoiceNetBill = Math.max(0, netGoodsValue - totalLooseValue + (Number(transportCost) || 0));
  } else {
    invoiceNetBill = netGoodsValue + totalLooseValue;
  }

  const grandTotalPayable = invoiceType === 'regular' ? (invoiceNetBill + previousDue) : invoiceNetBill;
  const currentRemainingDue = Math.max(0, grandTotalPayable - (Number(paidAmount) || 0));

  // Save / Update Invoice
  const handleSaveInvoice = (shouldPrint = true) => {
    if (!selectedDealerId) {
      alert('অনুগ্রহ করে একজন ডিলার নির্বাচন করুন');
      return;
    }

    const assignedOfficer = officers.find(
      (o) => String(o.code) === String(dealerDetails.officerCode) || o.id === dealerDetails.officerId
    );

    const invoicePayload = {
      id: invoiceId,
      date: invoiceDate,
      invoiceType,
      dealerId: selectedDealerId,
      dealerCode: dealerDetails.code,
      dealerName: dealerDetails.shopName,
      dealerProprietor: dealerDetails.proprietor,
      dealerAddress: dealerDetails.address,
      dealerPhone: dealerDetails.phone,
      officerId: assignedOfficer?.id || 'OFF-05',
      officerCode: dealerDetails.officerCode || assignedOfficer?.code || '5',
      officerName: assignedOfficer?.name || '',
      items: preparedItems,
      returnAdjustments: preparedLoose,
      totalCartons,
      subtotal: totalSubtotal,
      commissionAmount: totalCommission,
      returnAdjustmentTotal: totalLooseValue,
      transportCost: Number(transportCost) || 0,
      grandTotal: invoiceNetBill,
      previousDue: invoiceType === 'regular' ? previousDue : 0,
      netPayable: grandTotalPayable,
      paidAmount: Number(paidAmount) || 0,
      currentDue: currentRemainingDue,
      paymentMethod,
      transport: dealerDetails.transport,
      note: note || (
        invoiceType === 'regular'
          ? 'চালানের মালামাল সঠিক কার্টুন সংখ্যায় বুঝে দেওয়া হলো।'
          : invoiceType === 'dealer_return'
          ? 'ডিলার ফেরত পণ্য গ্রহণ ও লেজারে ক্রেডিট সমন্বয়।'
          : 'ফ্যাক্টরি ড্যামেজ / এক্সপায়ার পণ্য অবলোপন সমন্বয়।'
      )
    };

    let saved;
    if (editInvoiceData) {
      saved = updateInvoice(invoicePayload);
      setSuccessMessage(`ইনভয়েস #${saved.id} সফলভাবে আপডেট ও সংরক্ষিত হয়েছে!`);
    } else {
      saved = createInvoice(invoicePayload);
      setSuccessMessage(`নতুন ইনভয়েস #${saved.id} সফলভাবে তৈরি হয়েছে!`);
      // Auto assign next unique ID immediately
      const { candidateId } = getNextInvoiceNumber([...invoices, saved]);
      setInvoiceId(candidateId);
    }

    setPreviewInvoice(saved);

    if (shouldPrint) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };

  // Reset form
  const handleResetForm = () => {
    if (onCancelEdit) onCancelEdit();
    const { candidateId } = getNextInvoiceNumber(invoices);
    setInvoiceId(candidateId);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setInvoiceType('regular');
    setSelectedDealerId('');
    setDealerDetails({
      code: '',
      shopName: '',
      proprietor: '',
      address: '',
      phone: '',
      zone: '',
      officerCode: '',
      officerId: '',
      transport: ''
    });
    setLooseItems([]);
    setTransportCost(0);
    setPaidAmount(0);
    setNote('');
    setSuccessMessage('');
    if (allProductVariants.length > 0) {
      const first = allProductVariants[0];
      setItems([
        {
          variantKey: first.key,
          productId: first.productId,
          productName: first.productName,
          sku: first.sku,
          size: first.size,
          packPerBox: first.packPerBox,
          unit: first.unit,
          cartonPrice: first.cartonPrice,
          cartons: 1,
          commissionPercent: 20
        }
      ]);
    }
  };

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Mode */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              {editInvoiceData ? `ইনভয়েস এডিট ও আপডেট: #${invoiceId}` : 'বিক্রয় চালান ও ইনভয়েস তৈরি'}
            </h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            ১-ক্লিক পণ্য ও প্যাক সাইজ নির্বাচন • ৩ ধরনের ইনভয়েস টাইপ • প্রিন্টে শুধু অফিসার কোড
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onViewInvoices && (
            <button
              onClick={onViewInvoices}
              className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
            >
              ইনভয়েস হিস্ট্রি
            </button>
          )}
          <button
            onClick={handleResetForm}
            className="px-3 py-2 text-xs font-bold rounded-lg text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{editInvoiceData ? 'এডিট বাতিল' : 'নতুন ফর্ম'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-sm">{successMessage}</span>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow"
          >
            <Printer className="w-4 h-4" />
            চালান প্রিন্ট
          </button>
        </div>
      )}

      {/* Main Invoice Builder */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 no-print">
        {/* Requirement 3: Three Invoice Types Selector */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            ইনভয়েস টাইপ নির্বাচন করুন (Select Invoice Type):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setInvoiceType('regular')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-bold transition ${
                invoiceType === 'regular'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>১. রেগুলার বিক্রয় চালান</span>
            </button>

            <button
              type="button"
              onClick={() => setInvoiceType('dealer_return')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-bold transition ${
                invoiceType === 'dealer_return'
                  ? 'bg-amber-600 text-white border-amber-600 shadow'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>২. ডিলার ফেরত চালান (রিটার্ন)</span>
            </button>

            <button
              type="button"
              onClick={() => setInvoiceType('factory_damage')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-bold transition ${
                invoiceType === 'factory_damage'
                  ? 'bg-rose-700 text-white border-rose-700 shadow'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>৩. ফ্যাক্টরি ড্যামেজ / এক্সপায়ার</span>
            </button>
          </div>
        </div>

        {/* Invoice Meta Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ইনভয়েস নং (অটোমেটিক ও ডুপ্লিকেট-মুক্ত)
            </label>
            <input
              type="text"
              value={invoiceId}
              readOnly
              className="w-full bg-white border border-emerald-400 rounded-lg px-3 py-2 text-sm font-mono font-black text-emerald-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">তারিখ (Date)</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ডিলার নির্বাচন করুন ({dealers.length} জন ডিলার) *
            </label>
            <select
              value={selectedDealerId}
              onChange={(e) => handleDealerSelect(e.target.value)}
              className="w-full bg-white border-2 border-emerald-600 rounded-lg px-3 py-2 text-sm text-slate-900 font-bold"
            >
              <option value="">-- ডিলার নির্বাচন করুন --</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  [কোড: {d.code}] {d.shopName} - {d.proprietor} ({d.zone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto-populated Dealer Information Banner */}
        {selectedDealerId && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <span className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-700" />
                ডিলার স্বয়ংক্রিয় তথ্য (Auto-Populated)
              </span>
              <span className="bg-emerald-700 text-white font-mono font-black px-2.5 py-0.5 rounded text-xs">
                ডিলার কোড: {dealerDetails.code}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-500 font-semibold">প্রতিষ্ঠানের নাম:</span>
                <p className="font-bold text-slate-800 text-sm">{dealerDetails.shopName}</p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">প্রোপাইটর / মালিকের নাম:</span>
                <p className="font-bold text-slate-800 text-sm">{dealerDetails.proprietor}</p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">মোবাইল নাম্বার:</span>
                <p className="font-bold text-emerald-700 font-mono text-sm">{dealerDetails.phone}</p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">ঠিকানা ও এলাকা:</span>
                <p className="font-medium text-slate-800">{dealerDetails.address}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-emerald-200 text-[11px]">
              <div>
                <span className="text-slate-500 font-semibold">অফিসার কোড:</span>
                <p className="font-bold text-slate-800 font-mono text-xs">
                  কোড: {dealerDetails.officerCode}
                </p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">পরিবহনের মাধ্যম:</span>
                <p className="font-semibold text-slate-700 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  {dealerDetails.transport || 'সাধারণ পরিবহন / গোডাউন ডেলিভারি'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-semibold">পূর্বের অবশিষ্ট বাকি:</span>
                <p className="font-black text-rose-700 text-sm font-mono">৳{previousDue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Requirement 2: Combined 1-Click Product + Pack Size Selection Table */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
                {invoiceType === 'regular'
                  ? 'চালান পণ্য তালিকা (এক ক্লিকে পণ্য ও প্যাক সাইজ নির্বাচন)'
                  : invoiceType === 'dealer_return'
                  ? 'ডিলার ফেরত পণ্য তালিকা (রিটার্ন কার্টুন ও প্যাক)'
                  : 'ফ্যাক্টরি ড্যামেজ পণ্য তালিকা'}
              </h3>
              <p className="text-[11px] text-slate-500">
                একবার সিলেক্ট করলেই প্যাক সাইজ ও রেট বসে যাবে। আপনি শুধু কার্টুন সংখ্যা লিখবেন।
              </p>
            </div>

            <div className="flex items-center gap-2">
              {invoiceType === 'regular' && (
                <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>ফিক্সড রেট</span>
                </span>
              )}
              {isReturnOrDamage && (
                <span className="text-xs text-amber-800 flex items-center gap-1 bg-amber-100 px-2.5 py-1 rounded font-bold">
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>দর ও কমিশন এডিটেবল</span>
                </span>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                <tr>
                  <th className="py-3 px-3 w-8">#</th>
                  <th className="py-3 px-3 min-w-[240px]">পণ্যের নাম ও প্যাক সাইজ</th>
                  <th className="py-3 px-3 text-center w-24">কাটুন সংখ্যা</th>
                  <th className="py-3 px-3 text-right w-28">ট্রেড প্রইজ (৳)</th>
                  <th className="py-3 px-3 text-right w-28">মোট ট্রেড প্রাইজ (৳)</th>
                  <th className="py-3 px-3 text-center w-20">কমিশন (%)</th>
                  <th className="py-3 px-3 text-right w-28">কমিশন এ্যামাউন্ট (৳)</th>
                  <th className="py-3 px-3 text-right w-28">নীট মূল্য (৳)</th>
                  <th className="py-3 px-2 text-center w-10">মুছুন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, index) => {
                  const currentVarKey = item.variantKey || `${item.productId}::${item.sku}`;
                  const cartons = Number(item.cartons) || 1;
                  const cartonPrice = Number(item.cartonPrice) || 0;
                  const subtotal = cartons * cartonPrice;
                  const commPct = Number(item.commissionPercent) ?? 20;
                  const commAmt = Math.round((subtotal * commPct) / 100);
                  const lineNetTotal = Math.max(0, subtotal - commAmt);

                  return (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono text-slate-400">{index + 1}</td>

                      {/* Single dropdown for product + pack size */}
                      <td className="py-3 px-3">
                        <select
                          value={currentVarKey}
                          onChange={(e) => handleSelectProductVariant(index, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
                        >
                          {allProductVariants.map((v) => (
                            <option key={v.key} value={v.key}>
                              {v.displayText}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          বক্সে থাকে: {item.packPerBox} {item.unit || 'বোতল'} | মোট {cartons * (Number(item.packPerBox) || 1)} পিস
                        </div>
                      </td>

                      {/* Carton count input */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.cartons}
                          onChange={(e) => handleItemFieldChange(index, 'cartons', e.target.value)}
                          className="w-20 bg-white border-2 border-emerald-500 rounded px-2 py-1 text-center font-bold text-emerald-800 text-sm mx-auto block"
                        />
                      </td>

                      {/* Carton Price (Read-only for regular, Editable for return/damage) */}
                      <td className="py-3 px-3 text-right">
                        {isReturnOrDamage ? (
                          <input
                            type="number"
                            min="0"
                            value={item.cartonPrice}
                            onChange={(e) => handleItemFieldChange(index, 'cartonPrice', e.target.value)}
                            className="w-24 bg-amber-50 border border-amber-300 rounded px-2 py-1 font-mono font-bold text-amber-900 text-right ml-auto block"
                          />
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              value={`৳${cartonPrice.toLocaleString()}`}
                              disabled
                              readOnly
                              title="কোম্পানি নির্ধারিত ফিক্সড রেট"
                              className="w-full bg-slate-100 border border-slate-200 text-slate-600 rounded px-2 py-1 font-mono font-bold text-right cursor-not-allowed text-xs"
                            />
                            <Lock className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          </div>
                        )}
                      </td>

                      {/* Mot Trade Price */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 text-xs">
                        ৳{subtotal.toLocaleString()}
                      </td>

                      {/* Commission % (Editable for return/damage) */}
                      <td className="py-3 px-3 text-center">
                        {isReturnOrDamage ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.commissionPercent}
                            onChange={(e) => handleItemFieldChange(index, 'commissionPercent', e.target.value)}
                            className="w-16 bg-amber-50 border border-amber-300 rounded px-1.5 py-1 text-center font-bold text-amber-900 ml-auto block"
                          />
                        ) : (
                          <span className="font-semibold text-emerald-700 font-mono">
                            {commPct}%
                          </span>
                        )}
                      </td>

                      {/* Commission Amount */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-rose-700 text-xs">
                        ৳{commAmt.toLocaleString()}
                      </td>

                      {/* Net line total */}
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-800 text-sm">
                        ৳{lineNetTotal.toLocaleString()}
                      </td>

                      {/* Remove item */}
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                          className={`p-1.5 rounded ${
                            items.length === 1 ? 'text-slate-300' : 'text-rose-500 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-3.5 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ অন্য পণ্য ও প্যাক সাইজ যোগ করুন</span>
            </button>

            {/* Requirement 4: Button to add loose/retail damaged piece with editable price */}
            <button
              onClick={handleAddLooseItem}
              className="flex items-center gap-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 px-3.5 py-1.5 rounded-lg text-xs font-bold border border-amber-300 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>+ খুচরা পণ্য / এক্সপায়ার বোতল ফেরত এড করুন</span>
            </button>
          </div>
        </div>

        {/* Loose / Retail Damaged Items Adjustment Table */}
        {looseItems.length > 0 && (
          <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  খুচরা বোতল / মেয়াদোত্তীর্ণ পণ্য ফেরত সমন্বয় তালিকা (সম্পূর্ণ এডিটেবল দর ও সংখ্যা)
                </h4>
                <p className="text-[11px] text-amber-800">
                  ডিলার হতে ১-২ বোতল খোলা ফেরত আসলে বা ক্ষতিপূরণ সমন্বয় করতে এখানে রেট ও পিস নিজের মতো এডিট করুন।
                </p>
              </div>
            </div>

            <div className="border border-amber-200 rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-amber-100 text-amber-900 font-bold uppercase">
                  <tr>
                    <th className="p-2 min-w-[200px]">পণ্য ও প্যাক সাইজ</th>
                    <th className="p-2 text-center w-28">সংখ্যা (বোতল/পিস)</th>
                    <th className="p-2 text-right w-32">সমন্বয় দর (Editable ৳)</th>
                    <th className="p-2 text-center w-24">কমিশন (%)</th>
                    <th className="p-2 text-right w-32">মোট সমন্বয় (৳)</th>
                    <th className="p-2">ক্ষতির কারণ / মন্তব্য</th>
                    <th className="p-2 text-center w-10">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {looseItems.map((loose, lIdx) => {
                    const lSubtotal = (Number(loose.quantity) || 1) * (Number(loose.price) || 0);
                    const lCommAmt = Math.round((lSubtotal * (Number(loose.commissionPercent) || 0)) / 100);
                    const lNet = lSubtotal - lCommAmt;

                    return (
                      <tr key={loose.id || lIdx} className="hover:bg-amber-50/50">
                        <td className="p-2">
                          <select
                            value={loose.variantKey || `${loose.productId}::${loose.sku}`}
                            onChange={(e) => handleLooseFieldChange(lIdx, 'variantKey', e.target.value)}
                            className="w-full border border-amber-300 rounded p-1 font-semibold text-xs"
                          >
                            {allProductVariants.map((v) => (
                              <option key={v.key} value={v.key}>
                                {v.productName} — {v.size}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={loose.quantity}
                            onChange={(e) => handleLooseFieldChange(lIdx, 'quantity', e.target.value)}
                            className="w-20 border border-amber-300 rounded p-1 text-center font-bold text-amber-900 text-xs mx-auto block"
                          />
                        </td>

                        {/* EDITABLE PRICE */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={loose.price}
                            onChange={(e) => handleLooseFieldChange(lIdx, 'price', e.target.value)}
                            className="w-28 border border-amber-400 bg-amber-50 rounded p-1 text-right font-mono font-bold text-amber-900 text-xs ml-auto block"
                          />
                        </td>

                        {/* EDITABLE COMMISSION % */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={loose.commissionPercent}
                            onChange={(e) => handleLooseFieldChange(lIdx, 'commissionPercent', e.target.value)}
                            className="w-16 border border-amber-300 rounded p-1 text-center font-mono font-bold text-xs mx-auto block"
                          />
                        </td>

                        <td className="p-2 text-right font-mono font-black text-rose-700">
                          - ৳{lNet.toLocaleString()}
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={loose.reason}
                            placeholder="যেমন: মেয়াদোত্তীর্ণ ১ বোতল"
                            onChange={(e) => handleLooseFieldChange(lIdx, 'reason', e.target.value)}
                            className="w-full border border-slate-200 rounded p-1 text-xs"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveLooseItem(lIdx)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Financial Summary & Settlement Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">চালান মন্তব্য ও শর্তাবলী</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="যেমন: পীরগঞ্জ ডিপো হতে কাভার্ড ভ্যান মারফত মাল পাঠানো হলো..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পেমেন্ট মাধ্যম</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                >
                  <option value="নগদ জমা">নগদ জমা (Cash)</option>
                  <option value="ব্যাংক চেক">ব্যাংক চেক (Cheque)</option>
                  <option value="ব্যাংক ডিপোজিট">ব্যাংক ডিপোজিট</option>
                  <option value="বিকাশ / নগদ">বিকাশ / নগদ</option>
                  <option value="বাকি চালান">সম্পূর্ণ বাকি চালান (Credit)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">তাৎক্ষণিক জমা / ক্যাশ আদায় (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full bg-emerald-50 border border-emerald-400 rounded-lg px-2.5 py-1.5 text-sm font-black text-emerald-800"
                />
              </div>
            </div>
          </div>

          {/* Right Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2.5 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-800 text-sm">
                হিসাব বিবরণী ({invoiceType === 'regular' ? 'নিয়মিত চালান' : invoiceType === 'dealer_return' ? 'রিটার্ন ক্রেডিট' : 'ফ্যাক্টরি ড্যামেজ'})
              </h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                invoiceType === 'regular' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {invoiceType === 'regular' ? 'সেলস চালান' : 'রিটার্ন / সমন্বয়'}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>মোট কার্টুন সংখ্যা:</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{totalCartons} কার্টুন</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>মোট ট্রেড প্রাইজ (কার্টুন মূল্য):</span>
              <span className="font-semibold text-slate-800 font-mono">৳{totalSubtotal.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>ট্রেড কমিশন:</span>
              <span className="font-mono">- ৳{totalCommission.toLocaleString()}</span>
            </div>

            {totalLooseValue > 0 && invoiceType === 'regular' && (
              <div className="flex justify-between text-rose-600 font-bold bg-amber-50 p-1.5 rounded border border-amber-200">
                <span>মেয়াদোত্তীর্ণ / ফেরত মাল সমন্বয়:</span>
                <span className="font-mono">- ৳{totalLooseValue.toLocaleString()}</span>
              </div>
            )}

            {invoiceType === 'regular' && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span>লেবার / পরিবহন খরচ (৳):</span>
                  <input
                    type="number"
                    min="0"
                    value={transportCost}
                    onChange={(e) => setTransportCost(e.target.value)}
                    className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                  />
                </span>
                <span className="font-semibold text-slate-800 font-mono">+ ৳{Number(transportCost || 0).toLocaleString()}</span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
              <span>চালানের নিট বিল / ক্রেডিট:</span>
              <span className="font-mono text-emerald-800 font-black">৳{invoiceNetBill.toLocaleString()}</span>
            </div>

            {previousDue > 0 && invoiceType === 'regular' && (
              <div className="flex justify-between text-rose-600">
                <span>পূর্বের অবশিষ্ট বাকি:</span>
                <span className="font-mono font-semibold">+ ৳{previousDue.toLocaleString()}</span>
              </div>
            )}

            {invoiceType === 'regular' && (
              <div className="flex justify-between bg-slate-200/70 p-2 rounded font-bold text-slate-800">
                <span>সর্বমোট নিট দেয়:</span>
                <span className="font-mono">৳{grandTotalPayable.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-emerald-700 font-bold">
              <span>নগদ / চেক আদায়:</span>
              <span className="font-mono">- ৳{Number(paidAmount || 0).toLocaleString()}</span>
            </div>

            <div className="border-t-2 border-slate-300 pt-2 flex justify-between text-base font-black">
              <span className={currentRemainingDue > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                অবশিষ্ট বকেয়া (Current Due):
              </span>
              <span className={`font-mono ${currentRemainingDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                ৳{currentRemainingDue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={() => handleSaveInvoice(false)}
            className="px-5 py-2.5 rounded-lg border border-emerald-700 text-emerald-800 hover:bg-emerald-50 font-bold text-xs transition"
          >
            {editInvoiceData ? 'পরিবর্তন সংরক্ষণ করুন' : 'শুধু ইনভয়েস সংরক্ষণ করুন'}
          </button>
          <button
            onClick={() => handleSaveInvoice(true)}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 rounded-lg font-black text-xs shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>{editInvoiceData ? 'আপডেট ও চালান প্রিন্ট' : 'সংরক্ষণ ও চালান প্রিন্ট করুন'}</span>
          </button>
        </div>
      </div>

      {/* Requirement 11 & Requirement 1: Official Printable Invoice */}
      <div className={`print-container bg-white p-8 max-w-4xl mx-auto rounded-lg border border-slate-200 ${previewInvoice ? 'block' : 'hidden print:block'}`}>
        {/* Header with BOTH Logos Side by Side */}
        <div className="border-b-2 border-emerald-800 pb-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo 1: Valid Agro Products */}
            <img
              src="/logos/valid-logo.png"
              alt="Valid Agro Products"
              className="h-16 w-auto object-contain max-w-[80px]"
            />

            {/* Central Company Information */}
            <div className="text-center flex-1">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড
              </h2>
              <h3 className="text-base font-bold text-emerald-800">
                এন্ড মহানন্দা এগ্রো ইন্ডাস্ট্রিজ
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                হেড অফিস ও ডিস্ট্রিবিউশন হাব: নিশিন্দারা, বগুড়া।
              </p>
              <p className="text-xs font-semibold text-slate-700">
                হটলাইন: 01867912167 • উন্নত ফসল সুরক্ষা ও বালাইনাশক
              </p>
            </div>

            {/* Logo 2: Mahananda Agro Industries */}
            <img
              src="/logos/mahananda-logo.png"
              alt="Mahananda Agro Industries"
              className="h-16 w-auto object-contain max-w-[80px]"
            />
          </div>

          <div className="text-center mt-2">
            <span className="inline-block bg-emerald-800 text-white px-4 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
              {previewInvoice?.invoiceType === 'dealer_return'
                ? 'ডিলার ফেরত চালান ও ক্রেডিট মেমো'
                : previewInvoice?.invoiceType === 'factory_damage'
                ? 'ফ্যাক্টরি ড্যামেজ / এক্সপায়ার সমন্বয় চালান'
                : 'ডিলার বিক্রয় চালান ও মেমো কপি'}
            </span>
          </div>
        </div>

        {/* Invoice Meta Grid: Requirement 1 - ONLY officerCode displayed, NO officer name, Bengali numerals */}
        <div className="grid grid-cols-2 gap-4 py-3 text-xs border-b border-slate-200">
          <div className="space-y-1">
            <p><span className="font-bold">ডিলার কোড:</span> <span className="font-bold text-emerald-800">{toBn(previewInvoice?.dealerCode || dealerDetails.code)}</span></p>
            <p><span className="font-bold">প্রতিষ্ঠানের নাম:</span> {previewInvoice?.dealerName || dealerDetails.shopName}</p>
            <p><span className="font-bold">প্রোপাইটর:</span> {previewInvoice?.dealerProprietor || dealerDetails.proprietor}</p>
            <p><span className="font-bold">ঠিকানা:</span> {previewInvoice?.dealerAddress || dealerDetails.address}</p>
            <p><span className="font-bold">মোবাইল:</span> {toBn(previewInvoice?.dealerPhone || dealerDetails.phone)}</p>
          </div>
          <div className="space-y-1 text-right">
            <p><span className="font-bold">চালান নং:</span> <span className="font-black text-emerald-800 text-sm">{toBn(previewInvoice?.id || invoiceId)}</span></p>
            <p><span className="font-bold">তারিখ:</span> {toBnDate(previewInvoice?.date || invoiceDate)}</p>
            {/* REQUIREMENT 1: ONLY OFFICER CODE SHOWS, NOT OFFICER NAME */}
            <p className="bg-slate-100 inline-block px-2.5 py-0.5 rounded border border-slate-200">
              <span className="font-bold text-slate-700">অফিসার কোড:</span> <span className="font-black text-emerald-800">{toBn(previewInvoice?.officerCode || dealerDetails.officerCode)}</span>
            </p>
            <p><span className="font-bold">পরিবহন মাধ্যম:</span> {previewInvoice?.transport || dealerDetails.transport || 'সাধারণ পরিবহন'}</p>
          </div>
        </div>

        {/* Items Table: Exactly 8 columns requested by client in Bengali numerals */}
        <div className="mt-3">
          <p className="text-[11px] font-bold text-slate-800 uppercase mb-1">সরবরাহকৃত পণ্য ও কার্টুন বিবরণী:</p>
          <table className="w-full text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                <th className="py-2 px-2 text-left w-7 border-r border-slate-200">নং</th>
                <th className="py-2 px-2 text-left border-r border-slate-200">পণ্যের নাম</th>
                <th className="py-2 px-2 text-left border-r border-slate-200">প্যাক সাইজ</th>
                <th className="py-2 px-2 text-center border-r border-slate-200">কাটুন সংখ্যা</th>
                <th className="py-2 px-2 text-right border-r border-slate-200">ট্রেড প্রইজ</th>
                <th className="py-2 px-2 text-right border-r border-slate-200">মোট ট্রেড প্রাইজ</th>
                <th className="py-2 px-2 text-center border-r border-slate-200">কমিশন(%)</th>
                <th className="py-2 px-2 text-right border-r border-slate-200">কমিশন এ্যামাউন্ট</th>
                <th className="py-2 px-2 text-right">নীট মূল্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(previewInvoice?.items || preparedItems).map((it, idx) => {
                const cartons = Number(it.cartons) || 1;
                const cartonPrice = Number(it.cartonPrice) || 0;
                const subtotal = it.subtotal ?? (cartons * cartonPrice);
                const commPct = Number(it.commissionPercent) ?? 20;
                const commAmt = it.commissionAmount ?? Math.round((subtotal * commPct) / 100);
                const lineNetTotal = it.total ?? (subtotal - commAmt);

                return (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="py-1.5 px-2 text-slate-600 border-r border-slate-200">{toBn(idx + 1)}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-900 border-r border-slate-200">{it.productName}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200">{it.size}</td>
                    <td className="py-1.5 px-2 text-center font-bold text-slate-900 border-r border-slate-200">{toBn(cartons)}</td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-200">৳{toBnCurrency(cartonPrice)}</td>
                    <td className="py-1.5 px-2 text-right font-medium border-r border-slate-200">৳{toBnCurrency(subtotal)}</td>
                    <td className="py-1.5 px-2 text-center border-r border-slate-200">{toBn(commPct)}%</td>
                    <td className="py-1.5 px-2 text-right text-rose-700 border-r border-slate-200">৳{toBnCurrency(commAmt)}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-emerald-900">৳{toBnCurrency(lineNetTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Loose / Return Table in Print */}
        {(previewInvoice?.returnAdjustments?.length > 0 || preparedLoose.length > 0) && (
          <div className="mt-3">
            <p className="text-[11px] font-bold text-amber-900 uppercase mb-1">মেয়াদ উত্তীর্ণ / ফেরত পণ্য সমন্বয় (বিল কর্তন):</p>
            <table className="w-full text-xs border border-amber-200 bg-amber-50/30">
              <thead>
                <tr className="bg-amber-100 text-amber-900 font-bold">
                  <th className="p-1.5 text-left">ফেরত পণ্য ও সাইজ</th>
                  <th className="p-1.5 text-center">সংখ্যা</th>
                  <th className="p-1.5 text-right">দর (৳)</th>
                  <th className="p-1.5 text-right">সমন্বয় কর্তন (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {(previewInvoice?.returnAdjustments || preparedLoose).map((loose, rIdx) => (
                  <tr key={rIdx}>
                    <td className="p-1.5">{loose.productName} — {loose.size}</td>
                    <td className="p-1.5 text-center font-bold">{toBn(loose.quantity)} বোতল/পিস</td>
                    <td className="p-1.5 text-right">৳{toBnCurrency(loose.price)}</td>
                    <td className="p-1.5 text-right font-bold text-rose-700">- ৳{toBnCurrency(loose.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-300 text-xs">
          <div>
            <p className="font-bold text-slate-700">চালান মন্তব্য:</p>
            <p className="text-slate-600 italic">{previewInvoice?.note || note || 'মালামাল সঠিক কার্টুন সংখ্যায় বুঝিয়া পাইলাম।'}</p>
            <p className="font-bold text-slate-700 mt-2">পেমেন্ট মেথড: <span className="font-normal">{previewInvoice?.paymentMethod || paymentMethod}</span></p>
            <p className="text-[11px] text-slate-400 mt-4 leading-tight">
              * বিক্রিত পণ্য ডিলার কর্তৃক সঠিকভাবে বুঝে নেওয়া হলো।
            </p>
          </div>

          <div className="space-y-1 text-right font-medium">
            <div className="flex justify-between">
              <span>মোট কাটুন:</span>
              <span className="font-bold text-slate-900">{toBn(previewInvoice?.totalCartons || totalCartons)} কাটুন</span>
            </div>
            <div className="flex justify-between">
              <span>মোট ট্রেড প্রাইজ:</span>
              <span>৳{toBnCurrency(previewInvoice?.subtotal || totalSubtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>ট্রেড কমিশন:</span>
              <span>- ৳{toBnCurrency(previewInvoice?.commissionAmount || totalCommission)}</span>
            </div>
            {(Number(previewInvoice?.returnAdjustmentTotal || totalLooseValue)) > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>ফেরত মাল সমন্বয় কর্তন:</span>
                <span>- ৳{toBnCurrency(previewInvoice?.returnAdjustmentTotal || totalLooseValue)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
              <span>চালানের নিট বিল:</span>
              <span className="font-bold text-emerald-800">৳{toBnCurrency(previewInvoice?.grandTotal || invoiceNetBill)}</span>
            </div>
            {(Number(previewInvoice?.previousDue || previousDue)) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>পূর্বের বকেয়া:</span>
                <span>+ ৳{toBnCurrency(previewInvoice?.previousDue || previousDue)}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>নগদ / চেক জমা:</span>
              <span>- ৳{toBnCurrency(previewInvoice?.paidAmount || paidAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-rose-700 border-t-2 border-slate-300 pt-1">
              <span>বর্তমান অবশিষ্ট বকেয়া:</span>
              <span>৳{toBnCurrency(previewInvoice?.currentDue ?? currentRemainingDue)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Signatures: Exactly as requested by user */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
          <div className="border-t border-slate-500 pt-1.5 font-bold text-slate-800">
            পরিবেশক/পক্ষের স্বাক্ষর ও তাং
          </div>
          <div className="border-t border-slate-500 pt-1.5 font-bold text-slate-800">
            সেলস অফিসারের স্বাক্ষর ও তাং
          </div>
          <div className="border-t border-slate-500 pt-1.5 font-bold text-slate-800">
            কোম্পানীর পক্ষে লজিস্টিক অফিসারের স্বাক্ষর ও তাং
          </div>
        </div>
      </div>
    </div>
  );
}
