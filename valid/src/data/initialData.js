// Valid Agro Products Ltd. / Mahananda Agro Industries
// Initial dataset with exact client products, trade prices, carton packs, commission, and all 83+ authorized dealers.

export const INITIAL_OFFICERS = [
  {
    officerId: 'SO-05',
    code: '5',
    name: 'মো: মোন্তফা কামাল',
    designation: 'সেলস অফিসার (SO)',
    territory: 'পীরগঞ্জ',
    phone: '০১৭৩১-২৮১৫৩৬',
    joinDate: '2024-01-01'
  },
  {
    id: 'SO-09',
    code: '9',
    name: 'মো: সেলিম রেজা',
    designation: 'সেলস অফিসার (SO)',
    territory: 'রাণীশংকৈল',
    phone: '০১৭৭৩-০৮২৭২৯',
    joinDate: '2024-01-01'
  },
  {
    id: 'SO-04',
    code: '4',
    name: 'মো: বদিরুল ইসলাম',
    designation: 'সেলস অফিসার (SO)',
    territory: 'বীরগঞ্জ ও কাহারোল',
    phone: '০১৭৯৬৭৯১৩৯৮',
    joinDate: '2024-01-01'
  },
  {
    id: 'SO-07',
    code: '7',
    name: 'মো: মাসুদ রানা',
    designation: 'সেলস অফিসার (SO)',
    territory: 'দিনাজপুর সদর',
    phone: '০১৭৩০-৪৭৮৪৭৭',
    joinDate: '2024-01-01'
  }
];

// Product catalog with Carton Trade Prices as provided by the client
export const INITIAL_PRODUCTS = [
  {
    id: 'prod-01',
    name: 'মহাথ্রিন ১০ ইসি',
    generic: 'সাইপারমেথ্রিন ১০% ইসি',
    category: 'কীটনাশক',
    description: 'ধান, সবজি, তুলা ও পাটের পাতা মোড়ানো পোকা ও মাজরা পোকা দমনে অত্যন্ত কার্যকর।',
    variants: [
      { sku: 'MAH-1L', size: '১লিঃ × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 8100, tp: 675, commission: 20, stockCartons: 50, stock: 600 },
      { sku: 'MAH-400ML', size: '৪০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 2850, tp: 285, commission: 20, stockCartons: 60, stock: 600 },
      { sku: 'MAH-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 2325, tp: 77.5, commission: 20, stockCartons: 80, stock: 2400 },
      { sku: 'MAH-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 1350, tp: 45, commission: 20, stockCartons: 80, stock: 2400 },
    ]
  },
  {
    id: 'prod-02',
    name: 'মেট্রোফস ৪৮ ইসি',
    generic: 'ক্লোরপাইরিফস ৪৮% ইসি',
    category: 'কীটনাশক',
    description: 'মাটির নিচের পোকা যেমন উইপোকা, কাটুই পোকা এবং ফসলের চুষে খাওয়া পোকা প্রতিরোধে পরীক্ষিত।',
    variants: [
      { sku: 'MET-1L', size: '১লিঃ × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 10800, tp: 900, commission: 20, stockCartons: 40, stock: 480 },
      { sku: 'MET-400ML', size: '৪০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 3700, tp: 370, commission: 20, stockCartons: 50, stock: 500 },
      { sku: 'MET-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 2925, tp: 97.5, commission: 20, stockCartons: 70, stock: 2100 },
      { sku: 'MET-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 1650, tp: 55, commission: 20, stockCartons: 70, stock: 2100 },
    ]
  },
  {
    id: 'prod-03',
    name: 'রেনজিট ৫৫ ইসি',
    generic: 'ক্লোরপাইরিফস ৫০% + সাইপারমেথ্রিন ৫% ইসি',
    category: 'কীটনাশক',
    description: 'দ্বৈত ক্ষমতার কম্বিনেশন কীটনাশক। বেগুন ও ফলের ডগা ও ফল ছিদ্রকারী পোকা ধ্বংস করে।',
    variants: [
      { sku: 'REN-1L', size: '১লিঃ × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 15375, tp: 1281.25, commission: 20, stockCartons: 35, stock: 420 },
      { sku: 'REN-500ML', size: '৫০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 6475, tp: 647.5, commission: 20, stockCartons: 45, stock: 450 },
      { sku: 'REN-400ML', size: '৪০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 5200, tp: 520, commission: 20, stockCartons: 40, stock: 400 },
      { sku: 'REN-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 4050, tp: 135, commission: 20, stockCartons: 60, stock: 1800 },
      { sku: 'REN-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 2175, tp: 72.5, commission: 20, stockCartons: 60, stock: 1800 },
    ]
  },
  {
    id: 'prod-04',
    name: 'মহাপ্রিড -২০এস এল',
    generic: 'ইমিডাক্লোপ্রিড ২০% এসএল',
    category: 'কীটনাশক',
    description: 'ধানের বাদামি গাছফড়িং (কারেন্ট পোকা), জাব পোকা ও সাদা মাছি দমনে দীর্ঘস্থায়ী অন্তর্বাহী কীটনাশক।',
    variants: [
      { sku: 'MPR-400ML', size: '৪০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 6750, tp: 675, commission: 20, stockCartons: 50, stock: 500 },
      { sku: 'MPR-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 5250, tp: 175, commission: 20, stockCartons: 70, stock: 2100 },
      { sku: 'MPR-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 2775, tp: 92.5, commission: 20, stockCartons: 80, stock: 2400 },
      { sku: 'MPR-25ML', size: '২৫মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 1575, tp: 52.5, commission: 20, stockCartons: 80, stock: 2400 },
    ]
  },
  {
    id: 'prod-05',
    name: 'মহাপ্রিড -(অফার)',
    generic: 'ইমিডাক্লোপ্রিড ২০% এসএল (স্পেশাল অফার)',
    category: 'কীটনাশক',
    description: 'ডিলারদের বিশেষ অফার প্যাক।',
    variants: [
      { sku: 'MPR-OFF-400ML', size: '৪০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 6200, tp: 620, commission: 20, stockCartons: 30, stock: 300 },
    ]
  },
  {
    id: 'prod-06',
    name: 'রিবোটিন ১.৮ ইসি',
    generic: 'অ্যাবামেকটিন ১.৮% ইসি',
    category: 'কীটনাশক',
    description: 'লাল মাকড়, হলুদ মাকড় ও লিফমাইনার দমনে আন্তর্জাতিক মানের জৈব উৎসজাত মাকড়নাশক।',
    variants: [
      { sku: 'RIB-5L', size: '৫লিটার × ০১', packPerBox: 1, unit: 'জার', cartonPrice: 4150, tp: 4150, commission: 20, stockCartons: 25, stock: 25 },
      { sku: 'RIB-1L', size: '১লিঃ × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 10350, tp: 862.5, commission: 20, stockCartons: 35, stock: 420 },
      { sku: 'RIB-400ML', size: '৪০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 3650, tp: 365, commission: 20, stockCartons: 40, stock: 400 },
      { sku: 'RIB-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 2925, tp: 97.5, commission: 20, stockCartons: 60, stock: 1800 },
      { sku: 'RIB-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 1575, tp: 52.5, commission: 20, stockCartons: 60, stock: 1800 },
    ]
  },
  {
    id: 'prod-07',
    name: 'মেইনটাপ ৯৫এস পি',
    generic: 'কারটাপ হাইড্রোক্লোরাইড ৯৫% এসপি',
    category: 'কীটনাশক',
    description: 'ধানের মাজরা পোকা ও পাতা মোড়ানো পোকা দমনে অত্যন্ত জনপ্রিয় দ্রবণীয় পাউডার।',
    variants: [
      { sku: 'MAIN-100G', size: '১০০গ্রাম × ২৪', packPerBox: 24, unit: 'প্যাকেট', cartonPrice: 5250, tp: 218.75, commission: 20, stockCartons: 50, stock: 1200 },
      { sku: 'MAIN-50G', size: '৫০গ্রাম × ৪৮', packPerBox: 48, unit: 'প্যাকেট', cartonPrice: 5460, tp: 113.75, commission: 20, stockCartons: 50, stock: 2400 },
      { sku: 'MAIN-10G', size: '১০গ্রাম × ৫০', packPerBox: 50, unit: 'প্যাকেট', cartonPrice: 1500, tp: 30, commission: 20, stockCartons: 80, stock: 4000 },
    ]
  },
  {
    id: 'prod-08',
    name: 'ডানলাপ-৫এসজি',
    generic: 'এমামেকটিন বেনজোয়েট ৫% এসজি',
    category: 'কীটনাশক',
    description: 'ফল ও ডগা ছিদ্রকারী পোকা ও ফল আর্মিওয়ার্ম দমনে কার্যকর।',
    variants: [
      { sku: 'DUN-10G', size: '১০গ্রাম × ৮০', packPerBox: 80, unit: 'প্যাকেট', cartonPrice: 1600, tp: 20, commission: 20, stockCartons: 90, stock: 7200 },
    ]
  },
  {
    id: 'prod-09',
    name: 'রিফাজিম ৫০ডব্লিউপি',
    generic: 'কার্বেনডাজিম ৫০% ডব্লিউপি',
    category: 'ছত্রাকনাশক',
    description: 'বীজ শোধন ও ব্লাস্ট, শীথ ব্লাইট ও পাতা পোড়া রোগ প্রতিরোধে শীর্ষ ছত্রাকনাশক।',
    variants: [
      { sku: 'RIF-500G', size: '৫০০গ্রাম × ১০', packPerBox: 10, unit: 'প্যাকেট', cartonPrice: 5500, tp: 550, commission: 20, stockCartons: 40, stock: 400 },
      { sku: 'RIF-100G', size: '১০০গ্রাম × ২৪', packPerBox: 24, unit: 'প্যাকেট', cartonPrice: 2750, tp: 114.58, commission: 20, stockCartons: 60, stock: 1440 },
      { sku: 'RIF-50G', size: '৫০গ্রাম × ৪৮', packPerBox: 48, unit: 'প্যাকেট', cartonPrice: 3000, tp: 62.5, commission: 20, stockCartons: 60, stock: 2880 },
      { sku: 'RIF-25G', size: '২৫গ্রাম × ৬০', packPerBox: 60, unit: 'প্যাকেট', cartonPrice: 2355, tp: 39.25, commission: 20, stockCartons: 70, stock: 4200 },
    ]
  },
  {
    id: 'prod-10',
    name: 'নেটজেব ৮০ ডব্লিউপি',
    generic: 'ম্যানকোজেব ৮০% ডব্লিউপি',
    category: 'ছত্রাকনাশক',
    description: 'আলুর নাবি ধসা, আগাম ধসা ও দাগ রোগ প্রতিরোধে স্পট ছত্রাকনাশক।',
    variants: [
      { sku: 'NET-1KG', size: '১কেজি × ১০', packPerBox: 10, unit: 'প্যাকেট', cartonPrice: 11875, tp: 1187.5, commission: 20, stockCartons: 35, stock: 350 },
      { sku: 'NET-500G', size: '৫০০গ্রাম × ২০', packPerBox: 20, unit: 'প্যাকেট', cartonPrice: 12150, tp: 607.5, commission: 20, stockCartons: 40, stock: 800 },
      { sku: 'NET-100G', size: '১০০গ্রাম × ৩০', packPerBox: 30, unit: 'প্যাকেট', cartonPrice: 3825, tp: 127.5, commission: 20, stockCartons: 60, stock: 1800 },
    ]
  },
  {
    id: 'prod-11',
    name: 'রেন্টাজল ২৫০ ইসি',
    generic: 'ডাইফেনোকোনাজল + প্রোপিকোনাজল ২৫০ ইসি',
    category: 'ছত্রাকনাশক',
    description: 'ধানের শীথ ব্লাইট ও খোলপচা নিরাময়কারী সিস্টেমিক ছত্রাকনাশক।',
    variants: [
      { sku: 'REN-ZOL-500ML', size: '৫০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 7300, tp: 730, commission: 20, stockCartons: 35, stock: 350 },
      { sku: 'REN-ZOL-400ML', size: '৪০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 6000, tp: 600, commission: 20, stockCartons: 35, stock: 350 },
      { sku: 'REN-ZOL-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 4500, tp: 150, commission: 20, stockCartons: 50, stock: 1500 },
      { sku: 'REN-ZOL-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 2400, tp: 80, commission: 20, stockCartons: 60, stock: 1800 },
    ]
  },
  {
    id: 'prod-12',
    name: 'স্টার টপ ৩২.৫ ইসি',
    generic: 'অ্যাজক্সিস্ট্রোবিন ২০% + ডাইফেনোকোনাজল ১২.৫% ইসি',
    category: 'ছত্রাকনাশক',
    description: 'ব্রড-স্পেকট্রাম প্রতিরোধক ও নিরাময়ক সিস্টেমিক ছত্রাকনাশক।',
    variants: [
      { sku: 'STAR-500ML', size: '৫০০মিলি × ১০', packPerBox: 10, unit: 'বোতল', cartonPrice: 0, tp: 0, commission: 20, stockCartons: 30, stock: 300 },
      { sku: 'STAR-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 0, tp: 0, commission: 20, stockCartons: 50, stock: 1500 },
      { sku: 'STAR-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 0, tp: 0, commission: 20, stockCartons: 50, stock: 1500 },
    ]
  },
  {
    id: 'prod-13',
    name: 'ফরমেট জিংক ৩৬%',
    generic: 'জিংক সালফেট মনোহাইড্রেট ৩৬%',
    category: 'সার ও অনুখাদ্য',
    description: 'ধানের খায়রা রোগ প্রতিরোধে এবং দ্রুত কুশি বৃদ্ধিতে অপরিহার্য।',
    variants: [
      { sku: 'FOR-ZN-1KG', size: '১কেজি × ১০', packPerBox: 10, unit: 'প্যাকেট', cartonPrice: 1500, tp: 150, commission: 20, stockCartons: 80, stock: 800 },
    ]
  },
  {
    id: 'prod-14',
    name: 'ভলিয়াম বোরন-১৭%',
    generic: 'বোরন ১৭% (Boron 17%)',
    category: 'সার ও অনুখাদ্য',
    description: 'ফুল-ফল ঝরা বন্ধ ও পরাগায়ন বৃদ্ধিতে উচ্চ ফলনশীল বোরন।',
    variants: [
      { sku: 'VOL-BOR-500G', size: '৫০০গ্রাম × ২০', packPerBox: 20, unit: 'প্যাকেট', cartonPrice: 1350, tp: 67.5, commission: 20, stockCartons: 70, stock: 1400 },
    ]
  },
  {
    id: 'prod-15',
    name: 'এম-রুট',
    generic: 'রুট গ্রোথ প্রোমোটার ও শিকড় উদ্দীপক',
    category: 'গ্রোথ প্রমোটার',
    description: 'চারা রোপণের পর দ্রুত শিকড় গজানো ও মাটির পুষ্টি টানার গতি বহুগুণ বাড়ায়।',
    variants: [
      { sku: 'MROOT-1KG', size: '১কেজি × ১০', packPerBox: 10, unit: 'প্যাকেট', cartonPrice: 650, tp: 65, commission: 20, stockCartons: 90, stock: 900 },
    ]
  },
  {
    id: 'prod-16',
    name: 'মহা গোল্ড প্লাস',
    generic: 'উন্নত দানাদার অনুখাদ্য সার ও জৈব উদ্দীপক',
    category: 'সার ও অনুখাদ্য',
    description: 'মাটির উর্বরতা বৃদ্ধি ও ফসলের রোগ প্রতিরোধ ক্ষমতা তৈরি করে।',
    variants: [
      { sku: 'MGP-1KG', size: '১কেজি × ১০', packPerBox: 10, unit: 'প্যাকেট', cartonPrice: 1400, tp: 140, commission: 20, stockCartons: 60, stock: 600 },
      { sku: 'MGP-500G', size: '৫০০গ্রাম × ২০', packPerBox: 20, unit: 'প্যাকেট', cartonPrice: 1450, tp: 72.5, commission: 20, stockCartons: 60, stock: 1200 },
    ]
  },
  {
    id: 'prod-17',
    name: 'এনএ প্লাস',
    generic: 'বিশেষ অনুখাদ্য সার ও পুষ্টি পরিপূরক',
    category: 'সার ও অনুখাদ্য',
    description: 'নাইট্রোজেন ও অনুখাদ্যের বিশেষ সমন্বয়।',
    variants: [
      { sku: 'NAP-1KG', size: '১কেজি × ১০', packPerBox: 10, unit: 'প্যাকেট', cartonPrice: 725, tp: 72.5, commission: 20, stockCartons: 70, stock: 700 },
    ]
  },
  {
    id: 'prod-18',
    name: 'মহাকা জিংক-১০%',
    generic: 'চিলেটেড জিংক ইডিটিএ ১০%',
    category: 'সার ও অনুখাদ্য',
    description: '১০০% পানিতে দ্রবণীয় স্প্রে উপযোগী চিলেটেড জিংক।',
    variants: [
      { sku: 'MAH-ZN-50G', size: '৫০গ্রাম × ৫০', packPerBox: 50, unit: 'প্যাকেট', cartonPrice: 2813, tp: 56.26, commission: 20, stockCartons: 60, stock: 3000 },
      { sku: 'MAH-ZN-20G', size: '২০গ্রাম × ৫০', packPerBox: 50, unit: 'প্যাকেট', cartonPrice: 1225, tp: 24.5, commission: 20, stockCartons: 80, stock: 4000 },
    ]
  },
  {
    id: 'prod-19',
    name: 'মহা ম্যাগ',
    generic: 'ম্যাগনেসিয়াম সালফেট সার',
    category: 'সার ও অনুখাদ্য',
    description: 'গাছের ক্লোরোফিল বৃদ্ধি করে পাতা গাঢ় সবুজ করে।',
    variants: [
      { sku: 'MAH-MAG-1KG', size: '১কেজি × ২০', packPerBox: 20, unit: 'প্যাকেট', cartonPrice: 1500, tp: 75, commission: 20, stockCartons: 70, stock: 1400 },
    ]
  },
  {
    id: 'prod-20',
    name: 'মহাশক্তি প্লাস জিপসাম',
    generic: 'উন্নত জিপসাম ক্যালসিয়াম ও সালফার সার',
    category: 'সার ও অনুখাদ্য',
    description: 'মাটির ক্ষারত্ব হ্রাস করে ও মাটিকে উর্বর করে তোলে।',
    variants: [
      { sku: 'MAH-GYP-5KG', size: '৫কেজি × ৬', packPerBox: 6, unit: 'ব্যাগ', cartonPrice: 820, tp: 136.67, commission: 20, stockCartons: 80, stock: 480 },
      { sku: 'MAH-GYP-10KG', size: '১০কেজি', packPerBox: 1, unit: 'ব্যাগ', cartonPrice: 260, tp: 260, commission: 20, stockCartons: 100, stock: 100 },
    ]
  },
  {
    id: 'prod-21',
    name: 'জামপা পটাশ',
    generic: 'উচ্চ ক্ষমতাসম্পন্ন দ্রবণীয় পটাশ অনুপুষ্টি',
    category: 'সার ও অনুখাদ্য',
    description: 'ফসলের দানা পুষ্ট ও রোগ প্রতিরোধ ক্ষমতা বৃদ্ধি করে।',
    variants: [
      { sku: 'JAM-POT-250G', size: '২৫০গ্রাম × ৩০', packPerBox: 30, unit: 'প্যাকেট', cartonPrice: 2475, tp: 82.5, commission: 20, stockCartons: 60, stock: 1800 },
    ]
  },
  {
    id: 'prod-22',
    name: 'মহা বাড়ন্ত (ট্যাবলেট)',
    generic: 'জিব্বেরেলিক এসিড ২০% ট্যাবলেট',
    category: 'গ্রোথ প্রমোটার',
    description: 'গাছের কাণ্ড ও ডগা দ্রুত লম্বা করে এবং ফলনের আকার চমৎকার বৃদ্ধি করে।',
    variants: [
      { sku: 'MAH-BAR-10G', size: '১০গ্রাম', packPerBox: 1, unit: 'ট্যাবলেট', cartonPrice: 105, tp: 105, commission: 20, stockCartons: 500, stock: 500 },
    ]
  },
  {
    id: 'prod-23',
    name: 'মহাবোরন বক্স ২০%',
    generic: 'সলোবর বোরন ২০%',
    category: 'সার ও অনুখাদ্য',
    description: 'প্রিমিয়াম বক্স প্যাকিং বোরন। ফুল ও ফল ঝরা বন্ধ করে।',
    variants: [
      { sku: 'MAH-BOR-500G', size: '৫০০গ্রাম × ১০', packPerBox: 10, unit: 'বক্স', cartonPrice: 2100, tp: 210, commission: 20, stockCartons: 60, stock: 600 },
      { sku: 'MAH-BOR-100G', size: '১০০গ্রাম × ৩০', packPerBox: 30, unit: 'বক্স', cartonPrice: 1390, tp: 46.33, commission: 20, stockCartons: 70, stock: 2100 },
    ]
  },
  {
    id: 'prod-24',
    name: 'নিউ সুপার ফলন প্লাস',
    generic: 'প্রাকৃতিক বায়ো স্টিমুল্যান্ট ও ফলন বর্ধক',
    category: 'গ্রোথ প্রমোটার',
    description: 'কুশি, ফুল ও ফলের প্রাচুর্য এনে কাঙ্ক্ষিত সর্বোচ্চ ফলন নিশ্চিত করে।',
    variants: [
      { sku: 'NSF-5L', size: '৫লিটার × ০১', packPerBox: 1, unit: 'জার', cartonPrice: 1750, tp: 1750, commission: 20, stockCartons: 40, stock: 40 },
      { sku: 'NSF-1L', size: '১লিঃ × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 4650, tp: 387.5, commission: 20, stockCartons: 50, stock: 600 },
      { sku: 'NSF-500ML', size: '৫০০মিলি × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 2550, tp: 212.5, commission: 20, stockCartons: 60, stock: 720 },
      { sku: 'NSF-100ML', size: '১০০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 1500, tp: 50, commission: 20, stockCartons: 70, stock: 2100 },
      { sku: 'NSF-50ML', size: '৫০মিলি × ৩০', packPerBox: 30, unit: 'বোতল', cartonPrice: 1050, tp: 35, commission: 20, stockCartons: 70, stock: 2100 },
    ]
  },
  {
    id: 'prod-25',
    name: 'রিয়েল হরমোন (প্যাকলোবিউট্রাজল ২৫% এসসি)',
    generic: 'প্যাকলোবিউট্রাজল ২৫% এসসি (Paclobutrazol 25% SC)',
    category: 'গ্রোথ প্রমোটার',
    description: 'আম, লিচু ও অন্যান্য ফল গাছে অসময়ে ও নিয়মিত ফুল-ফল আনা নিশ্চিত করে।',
    variants: [
      { sku: 'REAL-5L', size: '৫লিটার × ০১', packPerBox: 1, unit: 'জার', cartonPrice: 6500, tp: 6500, commission: 20, stockCartons: 30, stock: 30 },
      { sku: 'REAL-1L', size: '১লিঃ × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 16350, tp: 1362.5, commission: 20, stockCartons: 40, stock: 480 },
      { sku: 'REAL-500ML', size: '৫০০মিলি × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 8400, tp: 700, commission: 20, stockCartons: 50, stock: 600 },
    ]
  },
  {
    id: 'prod-26',
    name: 'মুকুল প্লাস',
    generic: 'ফুল ও মুকুল বর্ধক বিশেষ হরমোন দ্রবণ',
    category: 'গ্রোথ প্রমোটার',
    description: 'ফলের মুকুল ও কুশি অতিরিক্ত সংখ্যায় ফোটাতে এবং মুকুল ঝরা বন্ধে সহায়ক।',
    variants: [
      { sku: 'MUKUL-5L', size: '৫লিটার × ০১', packPerBox: 1, unit: 'জার', cartonPrice: 1800, tp: 1800, commission: 20, stockCartons: 40, stock: 40 },
      { sku: 'MUKUL-1L', size: '১লিঃ × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 4725, tp: 393.75, commission: 20, stockCartons: 50, stock: 600 },
      { sku: 'MUKUL-500ML', size: '৫০০মিলি × ১২', packPerBox: 12, unit: 'বোতল', cartonPrice: 2625, tp: 218.75, commission: 20, stockCartons: 60, stock: 720 },
      { sku: 'MUKUL-100ML', size: '১০০মিলি × ২৪', packPerBox: 24, unit: 'বোতল', cartonPrice: 1260, tp: 52.5, commission: 20, stockCartons: 70, stock: 1680 },
    ]
  }
];

INITIAL_PRODUCTS.forEach((product) => {
  product.variants.forEach((variant) => {
    variant.stockCartons = 1;
    variant.stock = variant.stockCartons * (Number(variant.packPerBox) || 1);
  });
});

// All 83 Authorized Dealers as provided by client across Pirganj, Ranisankail, Birganj, Dinajpur
export const INITIAL_DEALERS = [
  // --- পীরগঞ্জ জোন (অফিসার কোড: 5) ---
  {
    id: 'DLR-1',
    code: '1',
    shopName: 'মেসার্স আর্নিকা ট্রেডার্স',
    proprietor: 'মোঃ আনিসুর রহমান',
    address: 'পীরগঞ্জ কলেজ বাজার ,পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭৬২-৯১৯২৯৮',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    assignedOfficerId: 'OFF-05',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-2',
    code: '2',
    shopName: 'মেসার্স ভাই ভাই ট্রেডার্স সি',
    proprietor: 'মো: মেহেরাব হোসেন',
    address: 'সেনুয়া বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭৫৯ ০০৫৫০৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: 'কাভার্ড ভ্যান',
    openingDue: 0
  },
  {
    id: 'DLR-3',
    code: '3',
    shopName: 'মেসার্স আসাদুল ট্রেডার্স',
    proprietor: 'মোঃ আসাদুল হক',
    address: 'চৌরঙ্গী বাজার, পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭২৪ ৬৭৯৮২৯',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: 'ভ্যান',
    openingDue: 0
  },
  {
    id: 'DLR-4',
    code: '4',
    shopName: 'মেসার্স রকি রাফি ট্রেডার্স',
    proprietor: 'মোঃ আঃ কাফি সরকার',
    address: 'সাদা মহল বাজার,বোচাগঞ্জ, দিনাজপুর',
    phone: '০১৭২২ ৪৭৪৭৬০',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: 'অটো',
    openingDue: 0
  },
  {
    id: 'DLR-5',
    code: '5',
    shopName: 'মেসার্স সান ট্রেডার্স',
    proprietor: 'মোঃ মুছা আলী',
    address: 'ফুটকিবাড়ী বাজার,বোচাগঞ্জ,দিনাজপুর',
    phone: '০১৭২৭ ৯৬০৭৭০',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-6',
    code: '6',
    shopName: 'মেসার্স কৃষক বন্ধু ট্রেডার্স',
    proprietor: 'মো: ইমান আলী',
    address: 'গোগর বাজার, রাণীশংকৈল,ঠাকুরগাঁও।',
    phone: '০১৭৩৮ ৬৩৭১২৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-7',
    code: '7',
    shopName: 'মেসার্স সারজিনা ট্রেডার্স',
    proprietor: 'মো: জুয়েল রানা',
    address: 'চাপোড় বাজার,পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭৩৫ ০৭৩৮১১',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-8',
    code: '8',
    shopName: 'মেসার্স ভাই ভাই ট্রেডার্স বি',
    proprietor: 'মো:আবুল কালাম আজাদ',
    address: 'ভাবনাগঞ্জ বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭২৪ ৫৬৩২৫৩',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-9',
    code: '9',
    shopName: 'মেসার্স মাইশা ট্রেডার্স',
    proprietor: 'মোঃ মকবুল হোসেন',
    address: 'ধনঞ্জয়পুর, রণগাঁও,বোচাগঞ্জ, দিনাজপুর',
    phone: '০১৭৩৮-৪৩৩৪৪৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: 'ফেরত',
    openingDue: 0
  },
  {
    id: 'DLR-10',
    code: '10',
    shopName: 'মেসার্স জাহানারা ট্রেডার্স',
    proprietor: 'মোঃ আবু বকর সিদ্দিক (লাল)',
    address: 'সুলতানপুর শিমুলতলা, বোচাগঞ্জ, দিনাজপুর',
    phone: '০১৭২৫-০১১৪৬০',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-11',
    code: '11',
    shopName: 'মেসার্স হাসান ট্রেডার্স',
    proprietor: 'মোঃ আঃ মজিদ সরকার',
    address: 'বেগুনগাঁও নতুন হাট,পীরগঞ্জ',
    phone: '০১৭২৯ ৭০৩৭৮৬',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-12',
    code: '12',
    shopName: 'মেসার্স ভাই বোন ট্রেডার্স',
    proprietor: 'মো:মারুফ উজ জামান',
    address: 'ভেবড়া, বোর্ডহাট, পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭৫২ ০০২২৭৮',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-13',
    code: '13',
    shopName: 'মেসার্স কাব্য এন্টারপ্রাইজ',
    proprietor: 'হেম চন্দ্র রায়',
    address: 'জলগাঁও মনিপুর, বোচাগঞ্জ।',
    phone: '০১৭৮০৫৭৮৫৬৫',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-14',
    code: '14',
    shopName: 'মেসার্স নওসাদ ট্রেডার্স',
    proprietor: 'মোঃ নওসাদ আলম',
    address: 'ভবানীপুর বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭১৯ ৬১৩২৪২',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-15',
    code: '15',
    shopName: 'মেসার্স রুদ্র ট্রেডার্স',
    proprietor: 'মানিক রায়',
    address: 'ভুরভূষি কালি বাজার, পীরগঞ্জ',
    phone: '০১৭৪৪ ৭৮২৩৭০',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-16',
    code: '16',
    shopName: 'মেসার্স সাদিক ট্রেডার্স',
    proprietor: 'মো:রতন আলী',
    address: 'রঘুনাথপুর,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭৩৭ ০৫০৪৩০',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    session: 'জুলাই-ডিসেম্বর ২০২৫',
    openingDue: 0
  },
  {
    id: 'DLR-17',
    code: '17',
    shopName: 'মেসার্স সুরাইয়া ট্রেডার্স',
    proprietor: 'মো: আব্দুস সালাম',
    address: 'নাকাটি বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭৭৩-৫৯৫১৪৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    session: 'জানুয়ারি - জুন ২০২৬',
    openingDue: 0
  },
  {
    id: 'DLR-18',
    code: '18',
    shopName: 'মেসার্স রেদওয়ান ট্রেডার্স',
    proprietor: 'মোঃ মুকুল মোল্লা',
    address: 'টি এন টি রোড, পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '০১৭১৬-৩১১৪১২',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    session: 'জুলাই-ডিসেম্বর ২০২৬',
    openingDue: 0
  },
  {
    id: 'DLR-19',
    code: '19',
    shopName: 'মেসার্স জারা ট্রেডার্স',
    proprietor: 'মোঃ জাহিদ হোসেন চৌধুরী',
    address: 'পোড়াপুকুর বাজার, পীরগঞ্জ',
    phone: '০১৭৯৬ ১৪৮৫৫৫',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    session: 'জানুয়ারি - জুন ২০২৭',
    openingDue: 0
  },
  {
    id: 'DLR-20',
    code: '20',
    shopName: 'মেসার্স বশির আহমেদ',
    proprietor: 'এ,এস,এম.এম,এ,আই',
    address: 'পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭২৪ ৬৪৩২২৩',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-21',
    code: '21',
    shopName: 'মেসার্স এম, এইচ ট্রেডার্স',
    proprietor: 'মোঃ আনসারুল আলম সোনা',
    address: 'ফকিরগঞ্জ বাজার, পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '০১৭১৩-৭৬৩৬৪৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-22',
    code: '22',
    shopName: 'মেসার্স মাস্টার ট্রেডার্স',
    proprietor: 'মোঃ এহসান আলী',
    address: 'লোহাগাড়া বাজার, পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '০১৭০১-৯৭৯০০৫',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-23',
    code: '23',
    shopName: 'মেসার্স উপমা ট্রেডার্স',
    proprietor: 'সন্তোষ কুমার রায়',
    address: 'মাটিয়ানী বাজার,পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭২২-৮০৮২৮৪',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-24',
    code: '24',
    shopName: 'মেসার্স আবুল হোসেন ট্রেডার্স',
    proprietor: 'মোঃ সুলতান আলী',
    address: 'করনাই বাজার, পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭২৩ ৮৯১৩৬৮',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-25',
    code: '25',
    shopName: 'মেসার্স: নূরী ট্রেডার্স',
    proprietor: 'মোঃ মিলন সরকার',
    address: 'গোদাগারী বাজার, পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭৩৯ ৫৮১৪৬৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-26',
    code: '26',
    shopName: 'মেসার্স ওয়াফা ট্রেডার্স',
    proprietor: 'মো: আসাদুজ্জামান',
    address: 'রঘুনাথপুর,পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭১৩ ৭৩১৩৪৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-27',
    code: '27',
    shopName: 'মেসার্স জামাল ট্রেডার্স',
    proprietor: 'মো:শাহ্ জামাল',
    address: 'আজলাবাদ চৌরাস্তা,পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭০৪ ৮৩৮০৬০',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-28',
    code: '28',
    shopName: 'মেসার্স তোফাজজল ট্রেডার্স',
    proprietor: 'মো: তোফাজজল হোসেন',
    address: 'বাথপালিগাঁও,পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭৬৮ ৮০২৯০৬',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-29',
    code: '29',
    shopName: 'মেসার্স শুভ ট্রেডার্স',
    proprietor: 'নিরেন কিশোর রায়',
    address: 'বালুবাড়ী,পীরগঞ্জ,ঠাকুরগাঁও।',
    phone: '০১৭২৮ ০২৭০২৪',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-30',
    code: '30',
    shopName: 'মেসার্স মিলন স্টোর',
    proprietor: 'মো: মিলন হক',
    address: 'হাটমাধবপুর,বোচাগঞ্জ,দিনাজপুর',
    phone: '০১৭৭৩ ৩৪১৮০৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-31',
    code: '31',
    shopName: 'মেসার্স ওয়াজিব ট্রেডার্স',
    proprietor: 'মো: আনারুল ইসলাম',
    address: 'ফুটানি টাউন বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭৩৯ ১১২১৭৫',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-32',
    code: '32',
    shopName: 'মেসার্স সাকিন ট্রেডার্স',
    proprietor: 'মো: আকরাম হোসেন',
    address: 'দানাজপুর বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭৪১০৭৫৭৭৩',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-33',
    code: '33',
    shopName: 'মেসার্স এম আর ট্রেডার্স',
    proprietor: 'মো: মিস্টার আলী',
    address: 'আমতলী বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭২৯৪৪৯০০২',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-34',
    code: '34',
    shopName: 'মেসার্স মোন্তফা কামাল',
    proprietor: 'এস.ও/ মহানন্দা এগ্রো ইন্ডাস্ট্রিজ',
    address: 'পীরগঞ্জ কলেজ বাজার ,পীরগঞ্জ, ঠাকুরগাঁও।',
    phone: '০১৭৩১-২৮১৫৩৬',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-35',
    code: '35',
    shopName: 'মেসার্স মুক্তা ট্রেডার্স',
    proprietor: 'মো: মুক্তারুল ইসলাম',
    address: 'ভেবড়া, বোর্ডহাট, পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '০১৭৩৭-৬১৪৮৬৮',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-36',
    code: '36',
    shopName: 'মেসার্স খালিদ ট্রেডার্স',
    proprietor: 'মো: ওবায়দুর রহমান',
    address: 'শিবপুর, সৈয়দপুর , পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '০১৭১৯৫১৩২৬৭',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-37',
    code: '37',
    shopName: 'মেসার্স তুবা ট্রেডার্স',
    proprietor: 'মো: মামুনুর রশিদ',
    address: 'রিয়াজুলমোর,বড়সুলতানপুর,বোচাগঞ্জ,দিনাজপুর',
    phone: '০১৭৩৯৭৭১১৪১',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-38',
    code: '38',
    shopName: 'মেসার্স ভাই ভাই ট্রেডার্স- এ',
    proprietor: 'মো: জাহাঙ্গীর আলম',
    address: 'পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '০১৯১২৩৪৫৬৭৮',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-39',
    code: '39',
    shopName: 'মেসার্স সীমান্ত ট্রেডার্স',
    proprietor: 'মো: আমিনুল ইসলাম',
    address: 'পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '০২০১২৩৪৫৬৭৮',
    zone: 'পীরগঞ্জ',
    officerCode: '5',
    transport: '',
    openingDue: 0
  },

  // --- রাণীশংকৈল জোন (অফিসার কোড: 9) ---
  {
    id: 'DLR-40',
    code: '40',
    shopName: 'মেসার্স রায়হান ট্রেডার্স',
    proprietor: 'মো: সাইফুদ্দিন',
    address: 'কাশিডাঙ্গা বাজার,ঠাকুরগাঁও',
    phone: '০১৭১৩ ৯৫৫৫৭৩',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-41',
    code: '41',
    shopName: 'মেসার্স রফিক ট্রেডার্স',
    proprietor: 'মোঃ রফিকুল ইসলাম',
    address: 'বটতলী বাজার,হরিপুর,ঠাকুরগাঁও',
    phone: '০১৭২৩ ১৮৪১২৯',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-42',
    code: '42',
    shopName: 'মেসার্স তানহা ট্রেডার্স',
    proprietor: 'মোঃ তৈমুর ইসলাম',
    address: 'বনগাঁও বাজার, রাণীশংকৈল',
    phone: '০১৭২৮ ৭০৬০৯০',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-43',
    code: '43',
    shopName: 'মেসার্স ভাই ভাই কৃষি বিতান',
    proprietor: 'মোঃ মোজাফফর হোসেন',
    address: 'কিসমত বাজার,হরিপুর,ঠাকুরগাঁও',
    phone: '০১৭১৮ ৮৩৫২৬৩',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-44',
    code: '44',
    shopName: 'মেসার্স সাহেদা ট্রেডার্স',
    proprietor: 'মোঃ সবুর আলী',
    address: 'নেকমরদ বাজার, রাণীশংকৈল, ঠাকুরগাঁও।',
    phone: '০১৭২৩ ১৮৪১২৯',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-45',
    code: '45',
    shopName: 'মেসার্স এস এস ট্রেডার্স',
    proprietor: 'মো:সার্দুল হক',
    address: 'ফুটানি টাউন বাজার,রাণীশংকৈল',
    phone: '০১৭৪০ ৫৫৮০৭৪',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-46',
    code: '46',
    shopName: 'মেসার্স মাফিয়া ট্রেডার্স',
    proprietor: 'মোঃ আব্দুল মমিন',
    address: 'মহেশপুর,রাণীশংকৈল,ঠাকুরগাঁও',
    phone: '০১৭৩৮ ৭১০৩৫৬',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-47',
    code: '47',
    shopName: 'মেসার্স আখিঁ ট্রেডার্স',
    proprietor: 'মো:ফজলুল হক',
    address: 'বড়পুকুর,নেকমরদ,রানীশংকৈল',
    phone: '০১৭২৯ ৫২০৮৮২',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-48',
    code: '48',
    shopName: 'মেসার্স একা ট্রেডার্স',
    proprietor: 'মো:এজামুল ইসলাম',
    address: 'শিবগঞ্জ রেলস্টেশন সদর, ঠাকুরগাঁও',
    phone: '০১৭১০ ৬০৫৭০১',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-49',
    code: '49',
    shopName: 'মেসার্স লিয়ন ট্রেডার্স',
    proprietor: 'মো: মুজাহিদ হোসেন',
    address: 'বটতলী বাজার,রাণীশংকৈল',
    phone: '০১৭৩১ ১১৩৫২৩',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-50',
    code: '50',
    shopName: 'মেসার্স বাবা মা ট্রেডার্স',
    proprietor: 'মোঃ রেজাউল করিম',
    address: 'হলদিবাড়ী বাজার, বালিয়াডাঙ্গী, ঠাকুরগাঁও',
    phone: '০১৭২৬-৯৭৭২২১',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-51',
    code: '51',
    shopName: 'মেসার্স নবাব এন্ড ব্রাদার্স',
    proprietor: 'মোঃ তজির আলী',
    address: 'বলিদ্বারা বাজার,রাণীশংকৈল,ঠাকুরগাঁও।',
    phone: '০১৭২০ ৪৩৫৫৩২',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-52',
    code: '52',
    shopName: 'মেসার্স সমশের ট্রেডার্স',
    proprietor: 'মোঃ রুহুল আমিন',
    address: 'চোপরা বাজার, রানীশংকৈল, ঠাকুরগাঁও',
    phone: '০১৭৫১-২৬৬৭২৩',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-53',
    code: '53',
    shopName: 'মেসার্স সাকিব ট্রেডার্স',
    proprietor: 'নূর আলম সিদ্দিকী',
    address: 'নেকমরদ বাজার, রাণীশংকৈল, ঠাকুরগাঁও',
    phone: '০১৭৭৪-৮৮৮৫১০',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-54',
    code: '54',
    shopName: 'মেসার্স সানজিদা ট্রেডার্স',
    proprietor: 'মো:আবু সায়েদ',
    address: 'ভনিয়া,লক্ষ্মীর হাট বাজার,রাণীশংকৈল',
    phone: '০১৭৬১-৫৮৭৯২৮',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-55',
    code: '55',
    shopName: 'মেসার্স সাবের ট্রেডার্স',
    proprietor: 'মোঃ সাবের আলী',
    address: 'ধীরগঞ্জ হাট,হারপুর,ঠাকুরগাঁও',
    phone: '০১৭১৬ ২১৬১১১',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-56',
    code: '56',
    shopName: 'মেসার্স মোশারফ ট্রেডার্স',
    proprietor: 'মো: মোশারফ আলী',
    address: 'মন্ডল বাজার,ভাংবাড়ী ,রাণীশংকৈল',
    phone: '০১৭৬৭ ০৭৬৬৮৯',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-57',
    code: '57',
    shopName: 'মেসার্স সুমাইয়া ট্রেডার্স',
    proprietor: 'মোঃ উসমান গনি',
    address: 'সিদ্দিগী বাজার,রাণীশংকৈল,ঠাকুরগাঁও।',
    phone: '০১৭২২ ৪২০৪১৯',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-58',
    code: '58',
    shopName: 'মেসার্স মা বাবার আশির্বাদ ট্রেডার্স',
    proprietor: 'নবকান্ত রায়',
    address: 'বাচোর আলসিয়া টাউন ,রাণীশংকৈল',
    phone: '০১৭৩৭ ৭৫০৪৯১',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-59',
    code: '59',
    shopName: 'মেসার্স সেলিম রেজা',
    proprietor: 'এস.ও. এম. এ.আই',
    address: 'নেকমরদ বাজার, রাণীশংকৈল',
    phone: '০১৭৭৩-০৮২৭২৯',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-60',
    code: '60',
    shopName: 'মেসার্স বিসমিল্লাহ ট্রেডার্স',
    proprietor: 'মোঃ আনারুল ইসলাম (টিটো)',
    address: 'ঢোলপুকুর, কাশিপুর জগদল,রাণীশংকৈল',
    phone: '০১৭৮৮-৭৭৪৭৭৭',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-61',
    code: '61',
    shopName: 'মেসার্স সতীশ ট্রেডার্স',
    proprietor: 'সতীশ চন্দ্র রায়',
    address: 'কাতিহার বাজার,রাণীশংকৈল,ঠাকুরগাঁও',
    phone: '০১৭২২-১২৮৪২১',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-62',
    code: '62',
    shopName: 'মেসার্স বাবা মা ট্রেডার্স',
    proprietor: 'মিঠুন চন্দ্র রায়',
    address: 'জনগাঁও বাজার,পীরগঞ্জ,ঠাকুরগাঁও',
    phone: '০১৭৬১ ২৫৯১২৩',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-63',
    code: '63',
    shopName: 'মেসার্স ফারহান ট্রেডার্স',
    proprietor: 'আবু জাহিদ',
    address: 'জওগাঁও, নন্দুয়ার ইউনিয়ন, রাণীশংকৈল, ঠাকুরগাঁও।',
    phone: '০১৭৩৭-৪০৬৯৮০',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-64',
    code: '64',
    shopName: 'মেসার্স আফিয়া ট্রেডার্স',
    proprietor: 'মোঃ রুবেল',
    address: 'নেকমরদ বাজার, রাণীশংকৈল, ঠাকুরগাঁও।',
    phone: '০১৭৩৭-৩৪৮০৪৯',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-65',
    code: '65',
    shopName: 'মেসার্স আফরিন ট্রেডার্স',
    proprietor: 'মোঃ রেজাউল করিম',
    address: 'পারকুন্ডা বাজার (দিঘিয়া), রানীশংকৈল, ঠাকুরগাঁও',
    phone: '০১৭২২-২৫২৮৬৬',
    zone: 'রাণীশংকৈল',
    officerCode: '9',
    assignedOfficerId: 'OFF-09',
    transport: '',
    openingDue: 0
  },

  // --- বীরগঞ্জ জোন (অফিসার কোড: 4) ---
  {
    id: 'DLR-66',
    code: '66',
    shopName: 'মেসার্স জননী ট্রেডার্স',
    proprietor: 'মোঃ আব্দুল মান্নান',
    address: 'মহুগাও বাজার, বীরগঞ্জ,দিনাজপুর',
    phone: '০১৭১৭ ৯৪৮৯৫১',
    zone: 'বীরগঞ্জ',
    officerCode: '4',
    assignedOfficerId: 'OFF-04',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-67',
    code: '67',
    shopName: 'মেসার্স আলম ট্রেডার্স',
    proprietor: 'মোঃ মাহবুবুর আলম',
    address: 'বলেয়াহাট,কাহারোল,দিনাজপুর',
    phone: '০১৭১৭২৮৯২৮০',
    zone: 'বীরগঞ্জ',
    officerCode: '4',
    assignedOfficerId: 'OFF-04',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-68',
    code: '68',
    shopName: 'মেসার্স রাবেয়া ট্রেডার্স',
    proprietor: 'মোঃ রবিউল ইসলাম',
    address: 'ডহচী , ভাঙ্গামিল ,কাহারোল,দিনাজপুর',
    phone: '০১৭৩৮২২৯১১৩',
    zone: 'বীরগঞ্জ',
    officerCode: '4',
    assignedOfficerId: 'OFF-04',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-69',
    code: '69',
    shopName: 'মেসার্স মিমি ট্রেডার্স',
    proprietor: 'মোঃ আকতারুজ্জামান',
    address: 'জয়নন্দহাট,কাহারোল,দিনাজপুর',
    phone: '০১৭৭৪৩৭৭৬০৯',
    zone: 'বীরগঞ্জ',
    officerCode: '4',
    assignedOfficerId: 'OFF-04',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-70',
    code: '70',
    shopName: 'মেসার্স আগমনী ট্রেডার্স',
    proprietor: 'মোঃ আজিজুল ইসলাম',
    address: 'সনকা বাজার, বীরগঞ্জ, দিনাজপুর',
    phone: '০১৭৬৪৮০৭৪৪৫',
    zone: 'বীরগঞ্জ',
    officerCode: '4',
    assignedOfficerId: 'OFF-04',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-71',
    code: '71',
    shopName: 'মেসার্স বদিরুল ইসলাম',
    proprietor: 'এস.ও/ মহানন্দা এগ্রো ইন্ডাস্ট্রিজ',
    address: 'জয়নন্দ, কাহারোল, দিনাজপুর',
    phone: '০১৭৯৬৭৯১৩৯৮',
    zone: 'বীরগঞ্জ',
    officerCode: '4',
    assignedOfficerId: 'OFF-04',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-72',
    code: '72',
    shopName: 'মেসার্স রাশেদ এন্ড নয়ন ট্রেডার্স',
    proprietor: 'মোঃ নয়ন ইসলাম',
    address: 'বলেয়া বাজার, কাহারোল, দিনাজপুর',
    phone: '০১৩০০৮৯৬২৬৬',
    zone: 'বীরগঞ্জ',
    officerCode: '4',
    assignedOfficerId: 'OFF-04',
    transport: '',
    openingDue: 0
  },

  // --- দিনাজপুর জোন (অফিসার কোড: 7) ---
  {
    id: 'DLR-73',
    code: '73',
    shopName: 'মেসার্স মোস্তফা ট্রেডার্স',
    proprietor: 'মো:গোলাম মোস্তফা',
    address: 'দশমাইল মোড়, কাহারোল, দিনাজপুর',
    phone: '০১৭১৮-৭৮৩৪৬৬',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-74',
    code: '74',
    shopName: 'মেসার্স মৃত্তিকা ট্রেডার্স',
    proprietor: 'গীর্জনাথ রায়',
    address: 'নশিপুর, দিনাজপুর সদর, দিনাজপুর',
    phone: '০১৭৩৪-৪১১৬১০',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-75',
    code: '75',
    shopName: 'মেসার্স মাসুদ রানা',
    proprietor: 'এস.ও/ মহানন্দা এগ্রো ইন্ডাস্ট্রিজ',
    address: 'দিনাজপুর সদর, দিনাজপুর',
    phone: '০১৭৩০-৪৭৮৪৭৭',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-76',
    code: '76',
    shopName: 'মেসার্স আদিবা ট্রেডার্স',
    proprietor: 'মো: আব্দুল হাই',
    address: 'নয়াবাদ মোড়, কাহারোল, দিনাজপুর',
    phone: '০১৭৩৮-২৫৮২৮৯',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-77',
    code: '77',
    shopName: 'মেসার্স সুপর্না ট্রেডার্স',
    proprietor: 'স্বপন কুমার রায়',
    address: 'গড়নুরপুর, দশমাইল, কাহারোল, দিনাজপুর',
    phone: '০১৮৮৮-৬০২৩৩৯',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-78',
    code: '78',
    shopName: 'মেসার্স আবুল ট্রেডার্স',
    proprietor: 'মো: লিমন হোসেন',
    address: 'মুকুন্দপুর, কাহারোল, দিনাজপুর',
    phone: '০১৩১৮১৩৮৩০৮',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-79',
    code: '79',
    shopName: 'মেসার্স রজ ট্রেডার্স',
    proprietor: 'রঞ্জন রায়',
    address: 'ব্যাংককালী বাজার, দিনাজপুর সদর, দিনাজপুর',
    phone: '০১৭৮৪-৯৩৩৭২২',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-80',
    code: '80',
    shopName: 'মেসার্স মা ট্রেডার্স',
    proprietor: 'শাহিনুর রহমান',
    address: 'একবারপুর মোর, দিনাজপুর সদর, দিনাজপুর',
    phone: '০১৭৪৪-৩৩৭৯৯০',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-81',
    code: '81',
    shopName: 'মেসার্স সোনালী ট্রেডার্স',
    proprietor: 'রফিকুল ইসলাম',
    address: 'কর্ণাই, বাঁশের হাট, দিনাজপুর সদর, দিনাজপুর।',
    phone: '০১৭১৫-৬১৪৭৬১',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-82',
    code: '82',
    shopName: 'মেসার্স মা বাবা ট্রেডার্স',
    proprietor: 'মো: জিকরুল ইসলাম',
    address: 'নতুন বাজার, দিনাজপুর সদর, দিনাজপুর।',
    phone: '০১৭২৮-৩১৭৫৬৮',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  },
  {
    id: 'DLR-83',
    code: '83',
    shopName: 'মেসার্স সোহাগ ট্রেডার্স',
    proprietor: 'মোঃ সোহাগ হোসেন',
    address: 'রুনিয়া, কবিরাজ পাড়া, বিরল, দিনাজপুর।',
    phone: '০১৭৫১-২২৩৪১২',
    zone: 'দিনাজপুর',
    officerCode: '7',
    assignedOfficerId: 'OFF-07',
    transport: '',
    openingDue: 0
  }
];

export const INITIAL_INVOICES = [
  {
    id: 'VAP-2026-0001',
    invoiceNo: 'VAP-2026-0001',
    session: 'জানুয়ারি - জুন ২০২৭',
    seqNumber: 1,
    date: '2027-01-10',
    dealerId: 'DLR-1',
    dealerCode: '1',
    dealerName: 'মেসার্স আর্নিকা ট্রেডার্স',
    dealerProprietor: 'মোঃ আনিসুর রহমান',
    dealerAddress: 'পীরগঞ্জ কলেজ বাজার ,পীরগঞ্জ,ঠাকুরগাঁও।',
    dealerPhone: '০১৭৬২-৯১৯২৯৮',
    officerId: 'SO-05',
    officerCode: '5',
    officerName: 'মো: মোন্তফা কামাল',
    officerDesignation: 'সেলস অফিসার (SO)',
    items: [
      {
        productId: 'prod-01',
        productName: 'মহাথ্রিন ১০ ইসি',
        sku: 'MAH-1L',
        size: '১লিঃ × ১২',
        packPerBox: 12,
        cartons: 1,
        quantity: 1,
        totalPieces: 12,
        cartonPrice: 8100,
        unitPrice: 675,
        commission: 20,
        total: 8100
      }
    ],
    returnAdjustments: [],
    totalCartons: 1,
    subtotal: 8100,
    commissionAmount: 1620,
    returnAdjustmentTotal: 0,
    transportCost: 0,
    totalAmount: 6480,
    grandTotal: 6480,
    previousDue: 0,
    netPayable: 6480,
    paidAmount: 0,
    currentDue: 6480,
    dueAmount: 6480,
    paymentMethod: 'credit',
    transport: '',
    note: ''
  }
];

export const INITIAL_STOCK_IN = [];
export const INITIAL_DAMAGES = [];
export const INITIAL_PAYMENTS = [];
