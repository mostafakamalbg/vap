import React from 'react';
import {
  Building2,
  ShieldCheck,
  Award,
  Users,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Target
} from 'lucide-react';
import { useUiPreferences } from '../../context/UiPreferencesContext';

export default function AboutCompany() {
  const { t } = useUiPreferences();

  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-12">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
          {t('about.profile')}
        </span>
        <h1 className="company-brand-heading flex flex-col items-center gap-2 font-black text-slate-800">
          <span className="company-brand-line">
            <img src="/logos/valid-logo.png" alt="" />
            <span>{t('brand.first')}</span>
          </span>
          <span className="company-brand-line text-emerald-700">
            <img src="/logos/mahananda-logo-transparent.png" alt="" />
            <span>{t('brand.second')}</span>
          </span>
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          {t('about.intro')}
        </p>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-700" />
            {t('about.mission')}
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            {t('about.missionText')}
          </p>

          <div className="space-y-2.5 pt-2 text-xs text-slate-700">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{t('about.point1')}</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{t('about.point2')}</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{t('about.point3')}</span>
            </div>
          </div>
        </div>

        {/* Contact & Infrastructure Card */}
        <div className="bg-gradient-to-br from-emerald-900 to-green-950 text-white p-6 sm:p-8 rounded-2xl shadow-xl space-y-5">
          <h3 className="text-lg font-bold text-emerald-200">{t('about.contact')}</h3>
          <div className="space-y-3 text-xs text-emerald-100">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('about.address')}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('about.phone')}</span>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('about.sister')}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-emerald-800">
            <a
              href="tel:01867912167"
              className="inline-block bg-white text-emerald-900 font-bold px-5 py-2.5 rounded-lg text-xs hover:bg-emerald-50 transition"
            >
              {t('about.call')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
