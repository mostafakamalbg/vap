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
  Building2
} from 'lucide-react';
import { useAgro } from '../context/AgroContext';

export default function Navbar({ activeTab, setActiveTab }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { exportBackupExcel, resetToFactoryData } = useAgro();

  const navItems = [
    // Public section
    { id: 'website-home', label: 'হোম পেজ', icon: Home, section: 'public' },
    { id: 'website-products', label: 'সকল পণ্য', icon: Package, section: 'public' },
    { id: 'website-about', label: 'কোম্পানি পরিচিতি', icon: Building2, section: 'public' },
    // ERP / Business Modules
    { id: 'new-invoice', label: 'নতুন ইনভয়েস', icon: FileText, section: 'erp' },
    { id: 'invoice-list', label: 'ইনভয়েস হিস্ট্রি', icon: FileText, section: 'erp' },
    { id: 'inventory', label: 'স্টক ও মালামাল ইন', icon: Package, section: 'erp' },
    { id: 'damage-returns', label: 'ডেমেজ পণ্য ফেরত', icon: RotateCcw, section: 'erp' },
    { id: 'dealer-ledger', label: 'ডিলার হিসাব ও বাকি', icon: Users, section: 'erp' },
    { id: 'officer-tracking', label: 'অফিসার সেলস ট্র্যাকিং', icon: UserCheck, section: 'erp' },
    { id: 'monthly-reports', label: 'মাসিক ইন/আউট রিপোর্ট', icon: BarChart3, section: 'erp' },
  ];

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm no-print">
      {/* Top Banner with Company Info & Contact */}
      <div className="bg-emerald-900 text-emerald-100 text-xs sm:text-sm py-1.5 px-4">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-300" />
              <span>ঠিকানাঃ নিশিন্দারা, বগুড়া।</span>
            </span>
          </div>

          <div className="flex items-center space-x-3 ml-auto">
            <a
              href="tel:01867912167"
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 px-2.5 py-0.5 rounded-full text-white font-medium transition"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>হটলাইনঃ 01867912167</span>
            </a>

            {/* Quick backup & reset buttons */}
            <button
              onClick={exportBackupExcel}
              title="Excel ডাটা ব্যাকআপ ডাউনলোড করুন"
              className="hidden lg:flex items-center gap-1 text-emerald-200 hover:text-white transition px-2 py-0.5 rounded hover:bg-emerald-800"
            >
              <Download className="w-3 h-3" />
              <span>ব্যাকআপ</span>
            </button>
            <button
              onClick={resetToFactoryData}
              title="ডিফল্ট ডাটায় রিসেট করুন"
              className="hidden lg:flex items-center gap-1 text-emerald-300 hover:text-white transition px-2 py-0.5 rounded hover:bg-emerald-800"
            >
              <RotateCw className="w-3 h-3" />
              <span>রিসেট</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="container mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => handleNavClick('website-home')}
          aria-label="ভ্যালিড এগ্রো ও মহানন্দা এগ্রো হোম"
          className="min-w-0 flex flex-col lg:flex-row lg:items-center items-start gap-0.5 lg:gap-3 text-left group"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <img
              src="/logos/valid-logo.png"
              alt=""
              className="h-7 w-8 sm:h-8 sm:w-9 shrink-0 object-contain"
            />
            <span className="whitespace-nowrap text-[10px] min-[360px]:text-[11px] sm:text-sm font-black text-slate-800 tracking-tight leading-tight">
              ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <img
              src="/logos/mahananda-logo.png"
              alt=""
              className="h-6 w-8 sm:h-7 sm:w-9 shrink-0 object-contain"
            />
            <span className="whitespace-nowrap text-[10px] min-[360px]:text-[11px] sm:text-xs font-bold text-emerald-800 leading-tight">
              মহানন্দা এগ্রো ইন্ডাস্ট্রিজ
              <span className="hidden sm:inline"> • নিশিন্দারা, বগুড়া</span>
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavClick('new-invoice')}
            aria-label="নতুন ইনভয়েস তৈরি করুন"
            className="flex shrink-0 items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden min-[360px]:inline">ইনভয়েস</span>
          </button>

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
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
            ম্যানেজমেন্ট ও ইনভয়েস
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
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
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-2">
            <button onClick={exportBackupExcel} className="flex items-center gap-1 text-emerald-700 font-medium">
              <Download className="w-3.5 h-3.5" /> ব্যাকআপ ফাইল
            </button>
            <button onClick={resetToFactoryData} className="flex items-center gap-1 text-rose-600 font-medium">
              <RotateCw className="w-3.5 h-3.5" /> রিসেট ডাটা
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
