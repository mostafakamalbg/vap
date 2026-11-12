import React, { useState } from 'react';
import {
  Package,
  PlusCircle,
  ArrowDownLeft,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Building2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';

export default function StockManagement() {
  const { products, stockInLogs, addStockIn, addNewProduct, addProductVariant } = useAgro();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'stock-in', 'new-product'

  const [stockInItems, setStockInItems] = useState(() => {
    const firstProduct = products[0];
    return [{
      productId: firstProduct?.id || '',
      sku: firstProduct?.variants?.[0]?.sku || '',
      cartons: 10,
      loosePieces: 0,
      unitType: 'box'
    }];
  });

  // Stock In Form State
  const [stockInForm, setStockInForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    source: 'কারখানা হতে প্রাপ্ত (বগুড়া কেন্দ্রীয় প্ল্যান্ট)',
    batchNo: `BAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    mfgDate: new Date().toISOString().slice(0, 10),
    expDate: '',
    receivedBy: 'গোডাউন ইনচার্জ, নিশিন্দারা বগুড়া',
    note: ''
  });

  // Brand New Product Form State
  const [newProdForm, setNewProdForm] = useState({
    name: '',
    generic: '',
    category: 'কীটনাশক',
    description: '',
    size: '১০০মিলি',
    packPerBox: 30,
    unit: 'বোতল',
    tp: 200,
    mrp: 240,
    initialStock: 100
  });

  const [statusMsg, setStatusMsg] = useState('');
  const [formError, setFormError] = useState('');

  // Categories list
  const categories = ['ALL', 'কীটনাশক', 'ছত্রাকনাশক', 'সার ও অনুখাদ্য', 'গ্রোথ প্রমোটার'];

  // Filter products
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'ALL' || prod.category === selectedCategory;
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.generic.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate total stock value & pieces
  let totalStockCartons = 0;
  let totalStockValue = 0;
  let lowStockCount = 0;

  products.forEach((prod) => {
    prod.variants.forEach((v) => {
      const stockPieces = Number(v.stock) || 0;
      totalStockCartons += Number(v.stockCartons ?? Math.floor(stockPieces / (Number(v.packPerBox) || 1))) || 0;
      totalStockValue += stockPieces * (Number(v.tp) || 0);
      if (v.stock < 50) lowStockCount += 1;
    });
  });

  // Handle Product change in Stock-In form
  const handleStockInProductChange = (rowIndex, prodId) => {
    const p = products.find((prod) => prod.id === prodId);
    setStockInItems((previous) => previous.map((item, index) => (
      index === rowIndex ? { ...item, productId: prodId, sku: p?.variants[0]?.sku || '' } : item
    )));
  };

  // Submit Stock In
  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const entries = stockInItems.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      const variant = product?.variants.find((entry) => entry.sku === item.sku);
      const packPerBox = Number(variant?.packPerBox) || 1;
      const count = item.unitType === 'box'
        ? Number(item.cartons || 0)
        : Number(item.loosePieces || 0);
      const quantity = item.unitType === 'box' ? count * packPerBox : count;
      return { item, product, variant, quantity, count };
    });
    if (entries.some(({ product, variant, quantity, count }) => (
      !product || !variant || !Number.isSafeInteger(count) || !Number.isSafeInteger(quantity) || quantity <= 0
    ))) {
      setFormError('প্রতিটি পণ্যের প্যাক সাইজ ও সঠিক পরিমাণ দিন।');
      return;
    }

    try {
      await addStockIn(entries.map(({ item, product, variant, quantity }) => ({
        date: stockInForm.date,
        source: stockInForm.source,
        productId: item.productId,
        productName: product.name,
        sku: item.sku,
        size: variant.size || '',
        cartons: item.unitType === 'box' ? Number(item.cartons) : 0,
        quantityPieces: quantity,
        batchNo: stockInForm.batchNo,
        mfgDate: stockInForm.mfgDate,
        expDate: stockInForm.expDate,
        receivedBy: stockInForm.receivedBy,
        note: stockInForm.note || 'ডিস্ট্রিবিউশন অফিসে স্টক ইন করা হলো।'
      })));
    } catch (error) {
      setFormError(error.message || 'স্টক-ইন সংরক্ষণ করা যায়নি।');
      return;
    }

    const totalPieces = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    setStatusMsg(`${entries.length}টি পণ্যের স্টক ইন সংরক্ষণ হয়েছে; মোট ${totalPieces.toLocaleString('bn-BD')} পিস যোগ হয়েছে।`);
    setTimeout(() => setStatusMsg(''), 4000);
    setStockInItems([{
      productId: products[0]?.id || '',
      sku: products[0]?.variants?.[0]?.sku || '',
      cartons: 10,
      loosePieces: 0,
      unitType: 'box'
    }]);
    setActiveTab('inventory');
  };

  // Submit Brand New Product
  const handleNewProductSubmit = (e) => {
    e.preventDefault();
    if (!newProdForm.name) {
      alert('পণ্যের নাম লিখুন');
      return;
    }

    const sku = `SKU-${Date.now().toString().slice(-4)}`;
    const packPerBox = Math.max(1, Number(newProdForm.packPerBox) || 1);
    const initialStock = Math.max(0, Number(newProdForm.initialStock) || 0);
    const newProduct = {
      name: newProdForm.name,
      generic: newProdForm.generic || 'উন্নত কৃষি প্রযুক্তি',
      category: newProdForm.category,
      description: newProdForm.description || 'ভ্যালিড এগ্রো ও মহানন্দা এগ্রো অনুমোদিত ফসল রক্ষাকারী পণ্য।',
      variants: [
        {
          sku,
          size: newProdForm.size,
          packPerBox,
          unit: newProdForm.unit,
          tp: Number(newProdForm.tp) || 0,
          mrp: Number(newProdForm.mrp) || 0,
          stockCartons: Math.floor(initialStock / packPerBox),
          stock: initialStock
        }
      ]
    };

    addNewProduct(newProduct);
    setStatusMsg(`নতুন পণ্য "${newProdForm.name}" সফলভাবে ক্যাটালগ ও স্টকে যুক্ত হয়েছে!`);
    setTimeout(() => setStatusMsg(''), 4000);

    setNewProdForm({
      name: '',
      generic: '',
      category: 'কীটনাশক',
      description: '',
      size: '১০০মিলি',
      packPerBox: 30,
      unit: 'বোতল',
      tp: 200,
      mrp: 240,
      initialStock: 100
    });
    setActiveTab('inventory');
  };

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </span>
            ইনভেন্টরি ও ডিস্ট্রিবিউশন স্টক ম্যানেজমেন্ট
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            নিশিন্দারা বগুড়া ডিস্ট্রিবিউশন অফিস • অনুমোদিত সকল {products.length}টি পণ্য ও প্যাক সাইজ স্টক
          </p>
        </div>

        {/* Action Buttons to Switch Mode */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'inventory'
                ? 'bg-emerald-700 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            বর্তমান স্টক তালিকা
          </button>

          <button
            onClick={() => setActiveTab('stock-in')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'stock-in'
                ? 'bg-emerald-700 text-white shadow'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>ডিস্ট্রিবিউশন অফিসে স্টক ইন</span>
          </button>

          <button
            onClick={() => setActiveTab('new-product')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'new-product'
                ? 'bg-emerald-700 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>নতুন পণ্য এড অপশন</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-sm">{statusMsg}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট পণ্য লাইন</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{products.length} টি</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট মজুদ (কার্টুন)</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{totalStockCartons.toLocaleString()} কার্টুন</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট স্টক মূল্য (টিপি)</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">৳{totalStockValue.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <span className="text-base font-bold">৳</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">স্বল্প স্টক সতর্কতা (&lt;৫০)</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{lowStockCount} টি আইটেম</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* TAB 1: Inventory Table */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="পণ্যের নাম বা জেনেরিক দিয়ে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'সকল ক্যাটাগরি' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product & Variant Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[50px]" />
                <col className="w-[180px]" />
                <col className="w-[190px]" />
                <col className="w-[135px]" />
                <col className="w-[115px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="bg-slate-100 text-slate-700 text-xs font-bold uppercase">
                <tr>
                  <th className="py-3 px-3">নং</th>
                  <th className="py-3 px-3">পণ্যের নাম</th>
                  <th className="py-3 px-3">ক্যাটাগরি ও জেনেরিক উপাদান</th>
                  <th className="py-3 px-3">প্যাক সাইজ</th>
                  <th className="py-3 px-3 text-center">কার্টুন অনুপাত</th>
                  <th className="py-3 px-3 text-right">টিপি রেট (৳)</th>
                  <th className="py-3 px-3 text-right">এমআরপি (৳)</th>
                  <th className="py-3 px-3 text-center">বর্তমান স্টক (পিস)</th>
                  <th className="py-3 px-3 text-center">কার্টুন স্টক</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProducts.map((prod, pIdx) => {
                  return prod.variants.map((v, vIdx) => {
                    const packPerBox = v.packPerBox || 1;
                    const stockPcs = Number(v.stock) || 0;
                    const cartonEquivalent = Math.floor(stockPcs / packPerBox);
                    const remainderPcs = stockPcs % packPerBox;
                    const isLowStock = stockPcs < 50;

                    return (
                      <tr key={`${prod.id}-${v.sku}`} className="hover:bg-slate-50 transition">
                        {vIdx === 0 && (
                          <>
                            <td
                              rowSpan={prod.variants.length}
                              className="py-3 px-3 font-mono text-xs text-slate-400 align-top border-r border-slate-100"
                            >
                              {pIdx + 1}
                            </td>
                            <td
                              rowSpan={prod.variants.length}
                              className="py-3 px-3 font-bold text-slate-800 align-top border-r border-slate-100 break-words"
                            >
                              <div>{prod.name}</div>
                              <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {prod.category}
                              </span>
                            </td>
                            <td
                              rowSpan={prod.variants.length}
                              className="py-3 px-3 text-xs text-slate-500 align-top border-r border-slate-100 break-words"
                            >
                              <div className="font-medium text-slate-700">{prod.generic}</div>
                              <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{prod.description}</div>
                            </td>
                          </>
                        )}

                        <td className="py-2.5 px-3 font-semibold text-slate-800 text-xs whitespace-normal break-words">
                          {v.size}
                        </td>

                        <td className="py-2.5 px-2 text-center text-xs text-slate-600 whitespace-normal">
                          {v.packPerBox} {v.unit} / বক্স
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-slate-700">
                          ৳{(Number(v.tp) || 0).toLocaleString()}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-500">
                          ৳{(Number(v.mrp) || 0).toLocaleString()}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold font-mono ${
                              stockPcs < 0
                                ? 'bg-rose-200 text-rose-900'
                                : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {stockPcs < 0 ? `${stockPcs} (ঘাটতি)` : stockPcs} {v.unit}
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-center text-xs text-slate-600 whitespace-nowrap">
                          <span className={`font-semibold ${Number(v.stockCartons ?? cartonEquivalent) < 0 ? 'text-rose-800' : 'text-slate-800'}`}>
                            {Number(v.stockCartons ?? cartonEquivalent) || 0}
                          </span> কার্টুন
                          {remainderPcs > 0 && <span className="text-slate-400 text-[11px]"> + {remainderPcs} পিস</span>}
                        </td>
                      </tr>
                    );
                  });
                })}
                {!filteredProducts.length && (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-sm text-slate-500">
                      নির্বাচিত ফিল্টারে কোনো পণ্য পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Distribution Office Stock-In Form */}
      {activeTab === 'stock-in' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
              ডিস্ট্রিবিউশন অফিসে স্টক ইন (কারখানা হতে মালামাল চালান রিসিভ)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              বগুড়া গোডাউনে মাল আসার পর স্টক এন্ট্রি দিলে স্বয়ংক্রিয়ভাবে ইনভেন্টরিতে যুক্ত হবে
            </p>
          </div>

          <form onSubmit={handleStockInSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">তারিখ</label>
                <input
                  type="date"
                  value={stockInForm.date}
                  onChange={(e) => setStockInForm({ ...stockInForm, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">প্রাপ্তির উৎস (Source)</label>
                <input
                  type="text"
                  value={stockInForm.source}
                  onChange={(e) => setStockInForm({ ...stockInForm, source: e.target.value })}
                  placeholder="যেমন: বগুড়া কেন্দ্রীয় প্ল্যান্ট / লট নং"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">রিসিভ করেছেন (গোডাউন ইনচার্জ)</label>
                <input
                  type="text"
                  value={stockInForm.receivedBy}
                  onChange={(e) => setStockInForm({ ...stockInForm, receivedBy: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <section className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">একটি চালানে একাধিক পণ্য</h3>
                <button
                  type="button"
                  onClick={() => {
                    const product = products[0];
                    setStockInItems((previous) => [...previous, {
                      productId: product?.id || '',
                      sku: product?.variants?.[0]?.sku || '',
                      cartons: 1,
                      loosePieces: 0,
                      unitType: 'box'
                    }]);
                  }}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200"
                >
                  + পণ্য যোগ করুন
                </button>
              </div>
              {stockInItems.map((item, index) => {
                const product = products.find((entry) => entry.id === item.productId);
                return (
                  <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-emerald-100 bg-white p-3 md:grid-cols-[1.25fr_1fr_0.85fr_0.7fr_auto]">
                    <label className="text-xs font-semibold text-slate-700">
                      পণ্য
                      <select
                        value={item.productId}
                        onChange={(event) => handleStockInProductChange(index, event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      >
                        {products.map((entry) => (
                          <option key={entry.id} value={entry.id}>{entry.name} ({entry.category})</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      প্যাক সাইজ
                      <select
                        value={item.sku}
                        onChange={(event) => setStockInItems((previous) => previous.map((row, rowIndex) => (
                          rowIndex === index ? { ...row, sku: event.target.value } : row
                        )))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        required
                      >
                        {(product?.variants || []).map((variant) => (
                          <option key={variant.sku} value={variant.sku}>{variant.size} (বক্সে {variant.packPerBox} টি)</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      হিসাবের ধরন
                      <select
                        value={item.unitType}
                        onChange={(event) => setStockInItems((previous) => previous.map((row, rowIndex) => (
                          rowIndex === index ? { ...row, unitType: event.target.value } : row
                        )))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="box">কার্টুন</option>
                        <option value="piece">পিস</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      পরিমাণ ({item.unitType === 'box' ? 'কার্টুন' : 'পিস'})
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.unitType === 'box' ? item.cartons : item.loosePieces}
                        onChange={(event) => setStockInItems((previous) => previous.map((row, rowIndex) => (
                          rowIndex === index
                            ? item.unitType === 'box'
                              ? { ...row, cartons: event.target.value }
                              : { ...row, loosePieces: event.target.value }
                            : row
                        )))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold text-emerald-800"
                        required
                      />
                    </label>
                    <button
                      type="button"
                      disabled={stockInItems.length === 1}
                      onClick={() => setStockInItems((previous) => previous.filter((_, rowIndex) => rowIndex !== index))}
                      className="rounded p-2 text-rose-700 disabled:opacity-30"
                      aria-label="এই পণ্যটি সরান"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </section>
            {formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">লট / ব্যাচ নং (Batch No)</label>
                <input
                  type="text"
                  value={stockInForm.batchNo}
                  onChange={(e) => setStockInForm({ ...stockInForm, batchNo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">উৎপাদন তারিখ (Mfg Date)</label>
                <input
                  type="date"
                  value={stockInForm.mfgDate}
                  onChange={(e) => setStockInForm({ ...stockInForm, mfgDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">মন্তব্য / চালান রেফারেন্স</label>
                <input
                  type="text"
                  placeholder="যেমন: ফ্যাক্টরি চালান নং-৮৮৯"
                  value={stockInForm.note}
                  onChange={(e) => setStockInForm({ ...stockInForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2 rounded-lg text-sm font-bold shadow transition"
              >
                স্টক ইন কনফার্ম করুন
              </button>
            </div>
          </form>

          {/* Recent Stock-In Log List */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-3">সাম্প্রতিক স্টক ইন হিস্ট্রি (Recent Arrivals)</h3>
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3">পণ্য</th>
                    <th className="py-2.5 px-3">প্যাক সাইজ</th>
                    <th className="py-2.5 px-3 text-center">কার্টুন</th>
                    <th className="py-2.5 px-3 text-center">মোট পিস</th>
                    <th className="py-2.5 px-3">ব্যাচ নং</th>
                    <th className="py-2.5 px-3">উৎস</th>
                    <th className="py-2.5 px-3">রিসিভার</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stockInLogs.slice(0, 8).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono">{log.date}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{log.productName}</td>
                      <td className="py-2 px-3">{log.size}</td>
                      <td className="py-2 px-3 text-center font-semibold">{log.cartons > 0 ? log.cartons : '-'}</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-700 font-mono">
                        +{log.quantityPieces}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">{log.batchNo || '-'}</td>
                      <td className="py-2 px-3 text-slate-600">{log.source}</td>
                      <td className="py-2 px-3 text-slate-500">{log.receivedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Add Brand New Product to Catalog */}
      {activeTab === 'new-product' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-700" />
              ক্যাটালগে সম্পূর্ণ নতুন কৃষি পণ্য যুক্ত করুন
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ভবিষ্যতে কোম্পানি কোনো নতুন ব্র্যান্ডের কীটনাশক বা সার বাজারে আনলে এখান থেকে যুক্ত করতে পারবেন
            </p>
          </div>

          <form onSubmit={handleNewProductSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পণ্যের নাম (Brand Name) *</label>
                <input
                  type="text"
                  placeholder="যেমন: সুপার গোল্ড ৬০ ডব্লিউপি"
                  value={newProdForm.name}
                  onChange={(e) => setNewProdForm({ ...newProdForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">জেনেরিক উপাদান (Active Ingredient)</label>
                <input
                  type="text"
                  placeholder="যেমন: থায়ামেথোক্সাম + ক্লোরানট্রানিলিপ্রোল"
                  value={newProdForm.generic}
                  onChange={(e) => setNewProdForm({ ...newProdForm, generic: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ক্যাটাগরি</label>
                <select
                  value={newProdForm.category}
                  onChange={(e) => setNewProdForm({ ...newProdForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  <option value="কীটনাশক">কীটনাশক</option>
                  <option value="ছত্রাকনাশক">ছত্রাকনাশক</option>
                  <option value="সার ও অনুখাদ্য">সার ও অনুখাদ্য</option>
                  <option value="গ্রোথ প্রমোটার">গ্রোথ প্রমোটার</option>
                  <option value="আগাছানাশক">আগাছানাশক</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">পণ্যের কার্যকারিতা ও বিবরণ</label>
              <textarea
                rows={2}
                placeholder="যেমন: ধানের মাজরা ও ডগা পোকা নিয়ন্ত্রণে উচ্চ ক্ষমতাসম্পন্ন..."
                value={newProdForm.description}
                onChange={(e) => setNewProdForm({ ...newProdForm, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">প্যাক সাইজ</label>
                <input
                  type="text"
                  placeholder="১০০মিলি / ১কেজি"
                  value={newProdForm.size}
                  onChange={(e) => setNewProdForm({ ...newProdForm, size: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">বক্স প্রতি পিস</label>
                <input
                  type="number"
                  min="1"
                  value={newProdForm.packPerBox}
                  onChange={(e) => setNewProdForm({ ...newProdForm, packPerBox: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium text-center"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ইউনিট</label>
                <select
                  value={newProdForm.unit}
                  onChange={(e) => setNewProdForm({ ...newProdForm, unit: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs"
                >
                  <option value="বোতল">বোতল</option>
                  <option value="প্যাকেট">প্যাকেট</option>
                  <option value="জার">জার</option>
                  <option value="ব্যাগ">ব্যাগ</option>
                  <option value="বক্স">বক্স</option>
                  <option value="ট্যাবলেট">ট্যাবলেট</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">টিপি রেট (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={newProdForm.tp}
                  onChange={(e) => setNewProdForm({ ...newProdForm, tp: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium text-right"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">এমআরপি (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={newProdForm.mrp}
                  onChange={(e) => setNewProdForm({ ...newProdForm, mrp: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium text-right"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">প্রাথমিক স্টক (পিস)</label>
                <input
                  type="number"
                  min="0"
                  value={newProdForm.initialStock}
                  onChange={(e) => setNewProdForm({ ...newProdForm, initialStock: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-center text-emerald-800"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2 rounded-lg text-sm font-bold shadow transition"
              >
                নতুন পণ্য সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
