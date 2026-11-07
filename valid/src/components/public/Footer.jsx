import React from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Package,
  FileText,
  ShieldCheck,
  Heart
} from 'lucide-react';
import { useUiPreferences } from '../../context/UiPreferencesContext';

export default function Footer({ onNavigate }) {
  const { t } = useUiPreferences();
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        {/* Brand */}
        <div className="space-y-3 md:col-span-1">
          <div className="inline-flex flex-col gap-1 bg-white/95 p-2 rounded-xl">
            <div className="flex items-center gap-2">
              <img src="/logos/valid-logo.png" alt="" className="h-7 w-8 object-contain shrink-0" />
              <span className="whitespace-nowrap font-bold text-slate-900 text-[10px] sm:text-xs">{t('brand.first')}</span>
            </div>
            <div className="flex items-center gap-2">
              <img src="/logos/mahananda-logo-transparent.png" alt="" className="h-7 w-8 object-contain shrink-0" />
              <span className="whitespace-nowrap text-[10px] font-semibold text-emerald-800 sm:text-xs">{t('brand.second')}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('footer.summary')}
          </p>
          <p className="text-xs text-emerald-400 font-semibold">
            {t('brand.address')}
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">{t('footer.quickLinks')}</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => onNavigate('website-home')} className="hover:text-emerald-400 transition">
                {t('nav.home')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('website-products')} className="hover:text-emerald-400 transition">
                {t('footer.approvedProducts')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('website-about')} className="hover:text-emerald-400 transition">
                {t('nav.about')}
              </button>
            </li>
          </ul>
        </div>

        {/* ERP & Business modules */}
        <div>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">{t('footer.inventorySales')}</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => onNavigate('new-invoice')} className="hover:text-emerald-400 transition">
                {t('footer.createInvoice')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('inventory')} className="hover:text-emerald-400 transition">
                {t('footer.warehouse')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('damage-returns')} className="hover:text-emerald-400 transition">
                {t('footer.returns')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('dealer-ledger')} className="hover:text-emerald-400 transition">
                {t('footer.dealerLedger')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('officer-tracking')} className="hover:text-emerald-400 transition">
                {t('footer.officerTracking')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('monthly-reports')} className="hover:text-emerald-400 transition">
                {t('footer.monthlyStatement')}
              </button>
            </li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">{t('footer.contact')}</h4>
          <div className="space-y-2.5 text-xs text-slate-400">
            <p className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>নিশিন্দারা, বগুড়া। (বগুড়া সদর)</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <a href="tel:01867912167" className="hover:text-white font-mono text-emerald-300 font-bold">
                01867912167
              </a>
            </p>
            <p className="text-[11px] text-slate-500 pt-2">
              {t('footer.dealerInquiry')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© {new Date().getFullYear()} {t('brand.first')} • {t('brand.second')}. {t('footer.rights')}</p>
        <p className="flex items-center gap-1 text-[11px]">
          <span>{t('footer.system')}</span>
        </p>
      </div>
    </footer>
  );
}
