import React, { useState } from 'react';
import {
  Package,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  X,
  FileText
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';

export default function ProductCatalog({ onSelectProductForInvoice }) {
  const { products } = useAgro();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeModalProduct, setActiveModalProduct] = useState(null);

  const categories = ['ALL', 'কীটনাশক', 'ছত্রাকনাশক', 'সার ও অনুখাদ্য', 'গ্রোথ প্রমোটার'];

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.generic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider">
          ভ্যালিড এগ্রো ও মহানন্দা এগ্রো ক্যাটালগ
        </span>
        <h1 className="text-3xl font-black text-slate-800">
          আমাদের সকল অনুমোদিত কৃষি পণ্য তালিকা ({products.length} টি)
        </h1>
        <p className="text-slate-500 text-sm">
          প্রতিটি পণ্যের প্যাক সাইজ, কার্টুন প্যাকেজিং অনুপাত, টিপি ও এমআরপি রেট বিস্তারিত দেখুন
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="পণ্য বা উপাদান দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-emerald-700 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'সকল পণ্য' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((prod, idx) => (
          <div
            key={prod.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <span className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {prod.category}
                </span>
                <span className="text-slate-400 font-mono text-xs">#{idx + 1}</span>
              </div>

              <h3 className="text-lg font-bold text-slate-800">{prod.name}</h3>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">{prod.generic}</p>
              <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                {prod.description}
              </p>

              {/* Pack Sizes & Cartoon Ratio List */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-700 uppercase">প্যাক সাইজ ও কার্টুন অনুপাত:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {prod.variants.map((v) => (
                    <div
                      key={v.sku}
                      className="bg-slate-50 border border-slate-200/80 rounded p-1.5 text-[11px] flex justify-between items-center"
                    >
                      <span className="font-bold text-slate-800">{v.size}</span>
                      <span className="text-slate-500 font-mono">× {v.packPerBox} টি</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setActiveModalProduct(prod)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                বিস্তারিত দেখুন
              </button>

              {onSelectProductForInvoice && (
                <button
                  onClick={() => onSelectProductForInvoice(prod.id)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>চালানে যোগ করুন</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-8 space-y-2">
          <p className="text-slate-500 font-medium text-sm">কোনো পণ্য খুঁজে পাওয়া যায়নি।</p>
          <button
            onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      )}

      {/* Product Detail Modal */}
      {activeModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase">{activeModalProduct.category}</span>
                <h3 className="text-xl font-black text-slate-900">{activeModalProduct.name}</h3>
                <p className="text-xs text-slate-600 font-medium">{activeModalProduct.generic}</p>
              </div>
              <button
                onClick={() => setActiveModalProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <h4 className="font-bold text-slate-900 mb-1">কার্যকারিতা ও প্রয়োগ ক্ষেত্র:</h4>
                <p className="leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {activeModalProduct.description}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">অনুমোদিত প্যাক সাইজ ও রেট তালিকা:</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2">সাইজ</th>
                        <th className="p-2 text-center">কার্টুন প্যাকেজিং</th>
                        <th className="p-2 text-right">টিপি (৳)</th>
                        <th className="p-2 text-right">এমআরপি (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeModalProduct.variants.map((v) => (
                        <tr key={v.sku}>
                          <td className="p-2 font-bold text-slate-800">{v.size}</td>
                          <td className="p-2 text-center">{v.packPerBox} {v.unit} / বক্স</td>
                          <td className="p-2 text-right font-mono font-semibold">৳{Number(v.tp || 0).toLocaleString()}</td>
                          <td className="p-2 text-right font-mono text-slate-500">৳{v.mrp ? Number(v.mrp).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                <p className="font-bold mb-0.5">ডিলারদের জন্য বিশেষ সুবিধা:</p>
                <p>বগুড়া ডিপো হতে তাৎক্ষণিক মালামাল ডেলিভারি ও ডেমেজ পণ্য ১০০% ফেরত গ্রহণের নিশ্চয়তা।</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setActiveModalProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                বন্ধ করুন
              </button>
              {onSelectProductForInvoice && (
                <button
                  onClick={() => {
                    const id = activeModalProduct.id;
                    setActiveModalProduct(null);
                    onSelectProductForInvoice(id);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-lg text-xs font-bold shadow"
                >
                  চালান মেমো তৈরি করুন
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
