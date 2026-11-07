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
import { useUiPreferences } from '../../context/UiPreferencesContext';

export default function ProductCatalog({ onSelectProductForInvoice, actionLabel = 'চালানে যোগ করুন' }) {
  const { products } = useAgro();
  const { t, language } = useUiPreferences();
  const localizedActionLabel = language === 'en'
    ? actionLabel === 'অর্ডার করুন' ? 'Place Order' : 'Add to Invoice'
    : actionLabel;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeModalProduct, setActiveModalProduct] = useState(null);

  const categories = [
    { value: 'ALL', label: t('catalog.all') },
    { value: 'কীটনাশক', label: t('catalog.pesticide') },
    { value: 'ছত্রাকনাশক', label: t('catalog.fungicide') },
    { value: 'সার ও অনুখাদ্য', label: t('catalog.fertilizer') },
    { value: 'গ্রোথ প্রমোটার', label: t('catalog.growth') }
  ];

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchSearch =
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.generic || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider">
          {t('catalog.tagline')}
        </span>
        <h1 className="text-3xl font-black text-slate-800">
          {t('catalog.heading')} ({products.length})
        </h1>
        <p className="text-slate-500 text-sm">
          {t('catalog.details')}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('catalog.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat.value
                  ? 'bg-emerald-700 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
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
                  {categories.find((category) => category.value === prod.category)?.label || prod.category}
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
                <p className="text-[11px] font-bold text-slate-700 uppercase">{t('catalog.packRatio')}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {prod.variants.map((v) => (
                    <div
                      key={v.sku}
                      className="bg-slate-50 border border-slate-200/80 rounded p-1.5 text-[11px] flex justify-between items-center"
                    >
                      <span className="font-bold text-slate-800">{v.size}</span>
                      <span className="text-slate-500 font-mono">× {Number(v.packPerBox).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')} {t('catalog.units')}</span>
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
              {t('catalog.detailsButton')}
              </button>

              {onSelectProductForInvoice && (
                <button
                  onClick={() => onSelectProductForInvoice(prod.id)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{localizedActionLabel}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-8 space-y-2">
          <p className="text-slate-500 font-medium text-sm">{t('catalog.notFound')}</p>
          <button
            onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            {t('catalog.reset')}
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
                <h4 className="font-bold text-slate-900 mb-1">{t('catalog.usage')}</h4>
                <p className="leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {activeModalProduct.description}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1.5">{t('catalog.rates')}</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2">{t('catalog.size')}</th>
                        <th className="p-2 text-center">{t('catalog.packaging')}</th>
                        <th className="p-2 text-right">{t('catalog.tp')}</th>
                        <th className="p-2 text-right">{t('catalog.mrp')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeModalProduct.variants.map((v) => (
                        <tr key={v.sku}>
                          <td className="p-2 font-bold text-slate-800">{v.size}</td>
                          <td className="p-2 text-center">{Number(v.packPerBox).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')} {v.unit} / {t('catalog.box')}</td>
                          <td className="p-2 text-right font-mono font-semibold">৳{Number(v.tp || 0).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
                          <td className="p-2 text-right font-mono text-slate-500">৳{v.mrp ? Number(v.mrp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                <p className="font-bold mb-0.5">{t('catalog.dealerBenefit')}</p>
                <p>{t('catalog.dealerBenefitDetails')}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setActiveModalProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                {t('catalog.close')}
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
                  {t('catalog.createMemo')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
