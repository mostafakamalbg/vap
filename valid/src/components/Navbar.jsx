import React, { useState } from 'react';
import {
  FileText,
  Package,
  RotateCcw,
  Users,
  UserCheck,
  BarChart3,
  Home,
  Phone,
  MapPin,
  Menu,
  X,
  PlusCircle,
  Download,
  RotateCw,
  Building2,
  LogIn,
  LogOut
} from 'lucide-react';
import { useAgro } from '../context/AgroContext';
import { UI_THEMES, useUiPreferences } from '../context/UiPreferencesContext';
import { HOTLINE_NUMBER } from '../../shared/companyContact';

export default function Navbar({ activeTab, setActiveTab }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backupMenuOpen, setBackupMenuOpen] = useState(false);
  const { currentUser, logout, exportBackup, resetToFactoryData } = useAgro();
  const { theme, setTheme, language, setLanguage, t } = useUiPreferences();

  const publicItems = [
    // Public section
    { id: 'website-home', label: t('nav.home'), icon: Home, section: 'public' },
    { id: 'website-products', label: t('nav.products'), icon: Package, section: 'public' },
    { id: 'website-about', label: t('nav.about'), icon: Building2, section: 'public' },
  ];

  const adminItems = [
    { id: 'admin-access', label: t('nav.adminApproval'), icon: UserCheck },
    { id: 'new-invoice', label: t('nav.newInvoice'), icon: FileText },
    { id: 'invoice-list', label: t('nav.invoiceHistory'), icon: FileText },
    { id: 'inventory', label: t('nav.stock'), icon: Package },
    { id: 'damage-returns', label: t('nav.returns'), icon: RotateCcw },
    { id: 'dealer-ledger', label: t('nav.dealerLedger'), icon: Users },
    { id: 'sales-agreements', label: 'সেলস ও কালেকশন চুক্তি', icon: FileText },
    { id: 'officer-tracking', label: t('nav.officerTracking'), icon: UserCheck },
    { id: 'monthly-reports', label: t('nav.reports'), icon: BarChart3 },
    { id: 'data-management', label: 'ডেটা এক্সপোর্ট/ইমপোর্ট', icon: Download }
  ];
  const navItems = currentUser?.role === 'admin'
    ? [...publicItems, ...adminItems]
    : currentUser?.role === 'officer'
      ? [...publicItems, { id: 'officer-dashboard', label: t('nav.officerDashboard'), icon: UserCheck }]
      : publicItems;

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    setBackupMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await logout();
      handleNavClick('website-home');
    } catch (error) {
      window.alert(error.message);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm no-print">
      {/* Top Banner with Company Info & Contact */}
      <div className="bg-emerald-900 text-emerald-100 text-xs sm:text-sm py-1.5 px-4">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t('brand.address')}</span>
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <a
              href={`tel:${HOTLINE_NUMBER}`}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 px-2.5 py-0.5 rounded-full text-white font-medium transition"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{t('brand.hotline')}</span>
            </a>
            <span className="text-[10px] text-emerald-200">{t('brand.slogan')}</span>
            <label className="flex items-center gap-1">
              <span className="sr-only">{t('settings.theme')}</span>
              <select
                aria-label={t('settings.theme')}
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                className="max-w-28 rounded-md border border-emerald-700 bg-emerald-800 px-1.5 py-1 text-[10px] text-white sm:text-xs"
              >
                {UI_THEMES.map(({ value }) => (
                  <option key={value} value={value}>{t(`settings.${value}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="sr-only">{t('settings.language')}</span>
              <select
                aria-label={t('settings.language')}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-md border border-emerald-700 bg-emerald-800 px-1.5 py-1 text-[10px] text-white sm:text-xs"
              >
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
              </select>
            </label>

            {currentUser?.role === 'admin' && (
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setBackupMenuOpen((open) => !open)}
                  aria-expanded={backupMenuOpen}
                  title={t('nav.backupFormat')}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-emerald-200 transition hover:bg-emerald-800 hover:text-white"
                >
                  <Download className="h-3 w-3" /><span>{t('nav.backup')}</span>
                </button>
                {backupMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xl">
                    <p className="px-2 py-1 text-[10px] font-bold text-slate-400">{t('nav.downloadFormat')}</p>
                    <button onClick={() => { exportBackup('excel'); setBackupMenuOpen(false); }} className="w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-emerald-50">Excel (.xls)</button>
                    <button onClick={() => { exportBackup('google-docs'); setBackupMenuOpen(false); }} className="w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-emerald-50">Google Docs (.html)</button>
                    <button onClick={() => { exportBackup('word'); setBackupMenuOpen(false); }} className="w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-emerald-50">Microsoft Word (.doc)</button>
                  </div>
                )}
              </div>
            )}
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => resetToFactoryData().catch((error) => window.alert(error.message))}
                title={t('nav.resetData')}
                className="hidden items-center gap-1 rounded px-2 py-0.5 text-emerald-300 transition hover:bg-emerald-800 hover:text-white lg:flex"
              >
                <RotateCw className="h-3 w-3" /><span>{t('nav.reset')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="container mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => handleNavClick('website-home')}
          aria-label={`${t('brand.first')} ${t('brand.second')} ${t('nav.home')}`}
          className="min-w-0 flex flex-col items-start gap-0.5 text-left group"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <img
              src="/logos/valid-logo.png"
              alt=""
              className="h-7 w-8 sm:h-8 sm:w-9 shrink-0 object-contain"
            />
            <span className="whitespace-nowrap text-[10px] min-[360px]:text-[11px] sm:text-xs font-black text-slate-800 tracking-tight leading-tight">
              {t('brand.first')}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <img
              src="/logos/mahananda-logo-transparent.png"
              alt=""
              className="h-6 w-8 sm:h-7 sm:w-9 shrink-0 object-contain"
            />
            <span className="whitespace-nowrap text-[10px] min-[360px]:text-[11px] text-emerald-800 leading-tight">
              {t('brand.second')}
              <span className="hidden sm:inline"> • নিশিন্দারা, বগুড়া</span>
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {!currentUser && (
            <button
              onClick={() => handleNavClick('admin-login')}
              aria-label={t('nav.login')}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 sm:px-3"
            >
              <LogIn className="h-4 w-4" /><span>{t('nav.login')}</span>
            </button>
          )}
          {currentUser && (
            <button
              onClick={handleLogout}
              aria-label={t('nav.logout')}
              title={`${currentUser.name} • ${t('nav.logout')}`}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-2 text-[11px] font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 sm:px-3"
            >
              <LogOut className="h-4 w-4" /><span className="hidden min-[380px]:inline">{t('nav.logout')}</span>
            </button>
          )}
          {currentUser?.role === 'admin' && currentUser.isSuperAdmin && (
            <button
            onClick={() => handleNavClick('new-invoice')}
            aria-label={t('nav.newInvoice')}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 sm:px-3 sm:text-xs"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="hidden min-[360px]:inline">{t('nav.invoice')}</span>
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}
            className="shrink-0 p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Collapsible navigation for all screen sizes */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 shadow-lg">
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {currentUser ? t('nav.business') : t('nav.public')}
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-600" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          {!currentUser && (
            <div className="mt-2 grid grid-cols-1 gap-1 border-t border-slate-100 pt-2 sm:grid-cols-2">
              <button onClick={() => handleNavClick('admin-login')} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><LogIn className="mr-3 inline h-4 w-4 text-emerald-600" />{t('nav.adminLogin')}</button>
              <button onClick={() => handleNavClick('officer-login')} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><UserCheck className="mr-3 inline h-4 w-4 text-emerald-600" />{t('nav.officerLogin')}</button>
              <button onClick={() => handleNavClick('officer-register')} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Users className="mr-3 inline h-4 w-4 text-emerald-600" />{t('nav.officerRegister')}</button>
            </div>
          )}
          {currentUser?.role === 'admin' && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400">{t('nav.backupFormat')}</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                <button onClick={() => { exportBackup('excel'); setMobileMenuOpen(false); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"><Download className="h-4 w-4" />Excel (.xls)</button>
                <button onClick={() => { exportBackup('google-docs'); setMobileMenuOpen(false); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"><Download className="h-4 w-4" />Google Docs</button>
                <button onClick={() => { exportBackup('word'); setMobileMenuOpen(false); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"><Download className="h-4 w-4" />Microsoft Word</button>
              </div>
              <button onClick={() => resetToFactoryData().catch((error) => window.alert(error.message))} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50">
                <RotateCw className="h-4 w-4" />{t('nav.resetData')}
              </button>
            </div>
          )}
          {currentUser && (
            <div className="mt-2 border-t border-slate-100 px-2 pt-3 text-xs text-slate-500">
              {t('nav.loggedIn')} <strong className="text-slate-700">{currentUser.name}</strong> ({currentUser.role === 'admin' ? t('nav.adminLogin') : t('nav.officer')})
            </div>
          )}
        </div>
      )}
    </header>
  );
}
