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
  Target,
  Sparkles
} from 'lucide-react';

export default function AboutCompany() {
  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-12">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex flex-col gap-1.5 bg-white p-3 rounded-2xl shadow-sm border border-slate-200 w-fit mx-auto mb-2 text-left">
          <div className="flex items-center gap-2">
            <img src="/logos/valid-logo.png" alt="" className="h-8 w-9 object-contain shrink-0" />
            <span className="whitespace-nowrap text-xs sm:text-sm font-black text-slate-800">
              ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড
            </span>
          </div>
          <div className="flex items-center gap-2">
            <img src="/logos/mahananda-logo.png" alt="" className="h-8 w-9 object-contain shrink-0" />
            <span className="whitespace-nowrap text-xs sm:text-sm font-bold text-emerald-800">
              মহানন্দা এগ্রো ইন্ডাস্ট্রিজ
            </span>
          </div>
        </div>

        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          কোম্পানি প্রোফাইল ও যৌথ পরিচিতি
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-800">
          ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড <br />
          <span className="text-emerald-700">এন্ড মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</span>
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          বাংলাদেশের কৃষি বিপ্লবে উচ্চ ফলনশীল ও আধুনিক ফসল সুরক্ষা বালাইনাশক ও সার সরবরাহে আমরা এক বিশ্বস্ত নাম।
          বগুড়ার নিশিন্দারা হতে সমগ্র দেশের মাঠ পর্যায়ে কৃষকদের সর্বোচ্চ সেবা পৌঁছে দেওয়াই আমাদের ব্রত।
        </p>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-700" />
            আমাদের লক্ষ্য ও উদ্দেশ্য
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            কৃষকদের ফসলের পোকা-মাকড় ও রোগবালাই দ্রুত ও কার্যকরভাবে নিয়ন্ত্রণের জন্য উচ্চ কার্যক্ষমতাসম্পন্ন ফর্মুলেশন সরবরাহ করা।
            আমাদের পণ্যের প্রতিটি ব্যাচ কঠোর মান নিয়ন্ত্রণের মাধ্যমে মাঠ পর্যায়ে প্রেরিত হয়।
          </p>

          <div className="space-y-2.5 pt-2 text-xs text-slate-700">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>কৃষি সম্প্রসারণ অধিদপ্তর ও বালাইনাশক প্রশাসনের সকল নিয়ম মেনে নিবন্ধিত ২৬টি পণ্য সম্ভার</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>ডিলারদের জন্য আধুনিক ইনভয়েস, চালান ও সহজ শর্তে লেনদেন সুবিধা</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>অভিজ্ঞ ফিল্ড অফিসার ও সেলস প্রতিনিধির সার্বক্ষণিক মাঠ পরামর্শ</span>
            </div>
          </div>
        </div>

        {/* Contact & Infrastructure Card */}
        <div className="bg-gradient-to-br from-emerald-900 to-green-950 text-white p-6 sm:p-8 rounded-2xl shadow-xl space-y-5">
          <h3 className="text-lg font-bold text-emerald-200">হেড অফিস ও ডিস্ট্রিবিউশন হাব</h3>
          <div className="space-y-3 text-xs text-emerald-100">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ঠিকানাঃ নিশিন্দারা, বগুড়া। (বগুড়া সদর)</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>মোবাইল / হটলাইন: 01867912167</span>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>সিস্টার কনসার্ন: মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</span>
            </div>
          </div>

          <div className="pt-4 border-t border-emerald-800">
            <a
              href="tel:01867912167"
              className="inline-block bg-white text-emerald-900 font-bold px-5 py-2.5 rounded-lg text-xs hover:bg-emerald-50 transition"
            >
              সরাসরি যোগাযোগ করুন: 01867912167
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
