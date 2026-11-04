import React from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Award,
  Truck,
  Phone,
  MapPin,
  Package,
  ArrowRight,
  Sparkles,
  FileText,
  CheckCircle2,
  Leaf
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';

export default function Home({ onNavigate }) {
  const { products } = useAgro();

  // Top featured products from the user's list
  const featured = products.slice(0, 6);

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-900 text-white py-10 sm:py-20 px-3 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-12 items-center">
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            <div className="inline-flex flex-col gap-1.5 bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2.5 rounded-2xl shadow-xl border border-white/50 lg:hidden">
              <div className="flex items-center gap-2">
                <img
                  src="/logos/valid-logo.png"
                  alt=""
                  className="h-7 w-8 sm:h-9 sm:w-10 object-contain shrink-0"
                />
                <span className="whitespace-nowrap text-[11px] sm:text-sm font-black text-slate-800">
                  ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড
                </span>
              </div>
              <div className="flex items-center gap-2">
                <img
                  src="/logos/mahananda-logo.png"
                  alt=""
                  className="h-7 w-8 sm:h-9 sm:w-10 object-contain shrink-0"
                />
                <span className="whitespace-nowrap text-[11px] sm:text-sm font-bold text-emerald-800">
                  মহানন্দা এগ্রো ইন্ডাস্ট্রিজ
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 bg-emerald-800/80 border border-emerald-600/50 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>কৃষকের সমৃদ্ধি ও নিরাপদ ফসল সুরক্ষায় নির্ভরযোগ্য নাম</span>
            </div>

            <h1 className="text-[1.65rem] min-[380px]:text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড <br />
              <span className="text-emerald-300 text-2xl sm:text-4xl lg:text-5xl font-bold">
                এন্ড মহানন্দা এগ্রো ইন্ডাস্ট্রিজ
              </span>
            </h1>

            <p className="text-base sm:text-lg text-emerald-100/90 leading-relaxed max-w-2xl">
              উন্নত মানের কীটনাশক, ছত্রাকনাশক, সার ও ফলনবর্ধক বায়ো-স্টিমুল্যান্ট সরবরাহকারী।
              নিশিন্দারা, বগুড়া কেন্দ্র হতে সমগ্র দেশের ডিলার ও কৃষকদের সেবায় আমরা নিবেদিত।
            </p>

            {/* Quick Contact & Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => onNavigate('new-invoice')}
                className="flex items-center gap-2 bg-white text-emerald-900 hover:bg-emerald-50 px-6 py-3 rounded-xl font-black text-sm shadow-xl hover:shadow-2xl transition transform hover:-translate-y-0.5"
              >
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>বিক্রয় ইনভয়েস তৈরি করুন</span>
              </button>

              <button
                onClick={() => onNavigate('website-products')}
                className="flex items-center gap-2 bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition"
              >
                <Package className="w-4 h-4" />
                <span>অনুমোদিত {products.length}টি পণ্য ক্যাটালগ</span>
              </button>

              <a
                href="tel:01867912167"
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 px-5 py-3 rounded-xl font-extrabold text-sm shadow transition"
              >
                <Phone className="w-4 h-4" />
                <span>01867912167</span>
              </a>
            </div>

            {/* Quick Highlights */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-emerald-700/50 text-xs">
              <div>
                <p className="font-extrabold text-white text-lg sm:text-xl">{products.length}+</p>
                <p className="text-emerald-200">রেজিস্টার্ড পণ্য সম্ভার</p>
              </div>
              <div>
                <p className="font-extrabold text-white text-lg sm:text-xl">১০০%</p>
                <p className="text-emerald-200">মান নিয়ন্ত্রিত উৎপাদন</p>
              </div>
              <div>
                <p className="font-extrabold text-white text-lg sm:text-xl">২৪/৭</p>
                <p className="text-emerald-200">বগুড়া ডিস্ট্রিবিউশন ডিপো</p>
              </div>
            </div>
          </div>

          {/* Right Hero Card / Quick Specs */}
          <div className="lg:col-span-5">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 sm:p-8 rounded-2xl shadow-2xl text-white space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">ডিস্ট্রিবিউশন ও প্রধান কার্যালয়</h3>
                  <p className="text-xs text-emerald-200">নিশিন্দারা, বগুড়া।</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">কীটনাশক গ্রুপ:</strong> মহাথ্রিন ১০ ইসি, মেট্রোফস ৪৮ ইসি, রেনজিট ৫৫ ইসি, মহাপ্রিড ২০এস এল, রিবোটিন ১.৮ ইসি ইত্যাদি।
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">ছত্রাকনাশক গ্রুপ:</strong> রিফাজিম ৫০ ডব্লিউপি, নেটজেব ৮০ ডব্লিউপি, রেন্টাজল ২৫০ ইসি, স্টার টপ ৩২.৫ ইসি।
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">সার ও অনুখাদ্য:</strong> ফরমেট জিংক ৩৬%, ভলিয়াম বোরন ১৭%, মহাকা জিংক, মহা ম্যাগ, জামপা পটাশ।
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">ফলন বর্ধক পিজিআর:</strong> নিউ সুপার ফলন প্লাস, এম-রুট ও মহা বাড়ন্ত ট্যাবলেট।
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onNavigate('inventory')}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-lg text-xs transition text-center shadow"
                >
                  ডিপো স্টক ও ইনভেন্টরি দেখুন →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Feature Highlights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">গুণগত মানের নিশ্চয়তা</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              উন্নত ল্যাব টেস্ট ও আন্তর্জাতিক প্রযুক্তিতে প্রক্রিয়াজাত রাসায়নিক ফর্মুলেশন।
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">দ্রুত চালান সরবরাহ</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              বগুড়া ডিপো হতে দেশের যেকোনো প্রান্তে ডিলারদের নিকট দ্রুততম সময়ে মালামাল পৌঁছানো।
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">কৃষকের শতভাগ আস্থা</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              মাজরা, পোকা, ছত্রাক দমন এবং আলুর নাবি ধসা প্রতিরোধে সর্বোচ্চ কার্যকর ফলাফল।
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">ডিলার কমিশন ও সুযোগ</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              আকর্ষণীয় ডিলার কমিশন, অফার প্যাক এবং ডেমেজ পণ্যের সহজ ও ঝামেলামুক্ত সমন্বয়।
            </p>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-slate-200 pb-4">
          <div>
            <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider">
              ভ্যালিড ও মহানন্দা এগ্রো
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">
              প্রধান জনপ্রিয় পণ্যসমূহ
            </h2>
          </div>
          <button
            onClick={() => onNavigate('website-products')}
            className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-bold text-sm"
          >
            <span>সকল ২৩টি পণ্য দেখুন</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((prod) => (
            <div
              key={prod.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition flex flex-col justify-between p-5 group"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {prod.category}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {prod.variants.length} টি প্যাক সাইজ
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-700 transition">
                  {prod.name}
                </h3>
                <p className="text-xs font-medium text-emerald-800 mt-0.5">{prod.generic}</p>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {prod.description}
                </p>

                {/* Available Pack sizes */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {prod.variants.map((v) => (
                    <span
                      key={v.sku}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-[11px] px-2 py-0.5 rounded font-medium"
                    >
                      {v.size} × {v.packPerBox}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">টিপি প্রারম্ভিক</span>
                  <p className="text-sm font-black text-slate-800 font-mono">
                    ৳{prod.variants[0]?.tp} - ৳{prod.variants[prod.variants.length - 1]?.tp}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('new-invoice')}
                  className="bg-emerald-50 group-hover:bg-emerald-700 group-hover:text-white text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <span>ইনভয়েস করুন</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Production & Depot Information Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white p-8 sm:p-12 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
              নিশিন্দারা, বগুড়া কেন্দ্র
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">
              আধুনিক উৎপাদন ও স্বয়ংক্রিয় ডিস্ট্রিবিউশন হাব
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              উত্তরবঙ্গসহ সারা দেশের কৃষকদের নিকট মানসম্মত ফসল সুরক্ষা সামগ্রী দ্রুত সরবরাহের জন্য
              বগুড়ার নিশিন্দারায় আমাদের সেন্ট্রাল ডিপো ও অফিস নিরবচ্ছিন্ন সেবা প্রদান করছে।
            </p>
            <div className="space-y-2 text-xs text-slate-300 pt-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>নিশিন্দারা, বগুড়া (বগুড়া-রংপুর মহাসড়ক সংলগ্ন)</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>হটলাইন ও ডিলার যোগাযোগ: 01867912167</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 p-6 rounded-xl border border-white/10 space-y-4">
            <h3 className="font-bold text-base text-emerald-300">ডিলারশিপ ও ব্যবসায়িক সুবিধা</h3>
            <ul className="text-xs text-slate-200 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>সহজ শর্তে অনুমোদিত ডিলারশিপ প্রদান</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>অনলাইন ইনভয়েস, চালান ও বাকি-বকেয়ার স্বচ্ছ হিসাব</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ভাঙা বা নষ্ট ডেমেজ মালের সহজ ও দ্রুত সমন্বয় নীতি</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>দক্ষ ফিল্ড অফিসার ও এগ্রোনোমিস্টদের নিয়মিত মাঠ পরামর্শ</span>
              </li>
            </ul>

            <div className="pt-2">
              <a
                href="tel:01867912167"
                className="inline-flex items-center justify-center w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2.5 rounded-lg text-xs transition"
              >
                ডিলার হতে কল করুন: 01867912167
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
