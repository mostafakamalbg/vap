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

export default function Footer({ onNavigate }) {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        {/* Brand */}
        <div className="space-y-3 md:col-span-1">
          <div className="flex items-center gap-2 bg-white/95 p-2 rounded-xl w-fit">
            <img
              src="/logos/valid-logo.png"
              alt="Valid Agro"
              className="h-9 w-auto object-contain"
            />
            <div className="h-6 w-px bg-slate-300"></div>
            <img
              src="/logos/mahananda-logo.png"
              alt="Mahananda Agro"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div>
            <span className="font-bold text-white text-base block">ভ্যালিড এগ্রো প্রোডাক্ট লিঃ</span>
            <span className="text-xs font-semibold text-emerald-400">এন্ড মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            আধুনিক ও পরীক্ষিত ফসল সুরক্ষা বালাইনাশক ও সার প্রস্তুতকারক ও পরিবেশক।
          </p>
          <p className="text-xs text-emerald-400 font-semibold">
            ঠিকানাঃ নিশিন্দারা, বগুড়া।
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">দ্রুত নেভিগেশন</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => onNavigate('website-home')} className="hover:text-emerald-400 transition">
                হোম পেজ
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('website-products')} className="hover:text-emerald-400 transition">
                অনুমোদিত ২৬টি পণ্য ক্যাটালগ
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('website-about')} className="hover:text-emerald-400 transition">
                কোম্পানি পরিচিতি
              </button>
            </li>
          </ul>
        </div>

        {/* ERP & Business modules */}
        <div>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">ইনভেন্টরি ও সেলস</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button onClick={() => onNavigate('new-invoice')} className="hover:text-emerald-400 transition">
                নতুন চালান ও ইনভয়েস তৈরি
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('inventory')} className="hover:text-emerald-400 transition">
                গোডাউন স্টক ও স্টক ইন
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('damage-returns')} className="hover:text-emerald-400 transition">
                ডেমেজ পণ্য ফেরত অপশন
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('dealer-ledger')} className="hover:text-emerald-400 transition">
                ডিলার হিসাব ও বাকি লেজার
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('officer-tracking')} className="hover:text-emerald-400 transition">
                অফিসার সেলস ট্র্যাকিং
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('monthly-reports')} className="hover:text-emerald-400 transition">
                মাসিক ইন/আউট স্টেটমেন্ট
              </button>
            </li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">যোগাযোগ ও ডিপো</h4>
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
              ডিলার ইনকোয়ারি ও মালামাল বুকিংয়ের জন্য সরাসরি ফোনে যোগাযোগ করুন।
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© {new Date().getFullYear()} ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড ও মহানন্দা এগ্রো ইন্ডাস্ট্রিজ। সর্বস্বত্ব সংরক্ষিত।</p>
        <p className="flex items-center gap-1 text-[11px]">
          <span>নিশিন্দারা, বগুড়া কেন্দ্রিক ইনভেন্টরি ম্যানেজমেন্ট সিস্টেম</span>
        </p>
      </div>
    </footer>
  );
}
