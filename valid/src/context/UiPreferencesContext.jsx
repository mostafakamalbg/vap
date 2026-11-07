import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const UiPreferencesContext = createContext(null);

export const UI_THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'agro', label: 'Agro Green' }
];

const translations = {
  'nav.home': ['হোম পেজ', 'Home'],
  'nav.products': ['সকল পণ্য', 'All Products'],
  'nav.about': ['কোম্পানি পরিচিতি', 'About Us'],
  'nav.adminApproval': ['অফিসার ও অর্ডার অনুমোদন', 'Officer & Order Approval'],
  'nav.newInvoice': ['নতুন ইনভয়েস', 'New Invoice'],
  'nav.invoiceHistory': ['ইনভয়েস হিস্ট্রি', 'Invoice History'],
  'nav.stock': ['স্টক ও মালামাল ইন', 'Stock & Stock In'],
  'nav.returns': ['ডেমেজ পণ্য ফেরত', 'Damaged Product Returns'],
  'nav.dealerLedger': ['ডিলার হিসাব ও বাকি', 'Dealer Ledger & Due'],
  'nav.officerTracking': ['অফিসার সেলস ট্র্যাকিং', 'Officer Sales Tracking'],
  'nav.reports': ['মাসিক ইন/আউট রিপোর্ট', 'Monthly In/Out Report'],
  'nav.officerDashboard': ['অফিসার ড্যাশবোর্ড ও অর্ডার', 'Officer Dashboard & Orders'],
  'nav.login': ['লগইন', 'Log in'],
  'nav.logout': ['লগআউট', 'Log out'],
  'nav.invoice': ['ইনভয়েস', 'Invoice'],
  'nav.business': ['ব্যবসা ও হিসাব', 'Business & Accounts'],
  'nav.public': ['পাবলিক তথ্য ও লগইন', 'Public Info & Login'],
  'nav.adminLogin': ['অ্যাডমিন লগইন', 'Admin Login'],
  'nav.officerLogin': ['অফিসার লগইন', 'Officer Login'],
  'nav.officer': ['অফিসার', 'Officer'],
  'nav.officerRegister': ['অফিসার রেজিস্ট্রেশন', 'Officer Registration'],
  'nav.backup': ['ব্যাকআপ', 'Backup'],
  'nav.backupFormat': ['ব্যাকআপ ফরম্যাট', 'Backup Format'],
  'nav.downloadFormat': ['ডাউনলোড ফরম্যাট', 'Download Format'],
  'nav.reset': ['রিসেট', 'Reset'],
  'nav.resetData': ['রিসেট ডাটা', 'Reset Data'],
  'nav.loggedIn': ['লগইন:', 'Signed in:'],
  'settings.theme': ['থিম', 'Theme'],
  'settings.language': ['ভাষা', 'Language'],
  'settings.light': ['লাইট', 'Light'],
  'settings.dark': ['ডার্ক', 'Dark'],
  'settings.agro': ['এগ্রো গ্রিন', 'Agro Green'],
  'brand.address': ['হেড অফিস ও ডিস্ট্রিবিউশন হাব: নিশিন্দারা, বগুড়া।', 'Head Office & Distribution Hub: Nishindara, Bogura.'],
  'brand.hotline': ['হটলাইন: 01867912167', 'Hotline: 01867912167'],
  'brand.slogan': ['উন্নত ফসল সুরক্ষা ও বালাইনাশক', 'Advanced Crop Protection & Pesticides'],
  'brand.first': ['ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড', 'Valid Agro Products Limited'],
  'brand.second': ['মহানন্দা এগ্রো ইন্ডাস্ট্রিজ', 'Mahananda Agro Industries'],
  'about.profile': ['কোম্পানি প্রোফাইল ও পরিচিতি', 'Company Profile'],
  'about.intro': [
    'বাংলাদেশের কৃষি বিপ্লবে উচ্চ ফলনশীল ও আধুনিক ফসল সুরক্ষা বালাইনাশক ও সার সরবরাহে আমরা এক বিশ্বস্ত নাম। বগুড়ার নিশিন্দারা হতে সমগ্র দেশের মাঠ পর্যায়ে কৃষকদের সর্বোচ্চ সেবা পৌঁছে দেওয়াই আমাদের ব্রত।',
    'We are a trusted supplier of high-yielding agricultural products, modern crop-protection pesticides, and fertilizers in Bangladesh. From Nishindara, Bogura, we are committed to serving farmers across the country.'
  ],
  'about.mission': ['আমাদের লক্ষ্য ও উদ্দেশ্য', 'Our Mission'],
  'about.missionText': [
    'কৃষকদের ফসলের পোকা-মাকড় ও রোগবালাই দ্রুত ও কার্যকরভাবে নিয়ন্ত্রণের জন্য উচ্চ কার্যক্ষমতাসম্পন্ন ফর্মুলেশন সরবরাহ করা। আমাদের পণ্যের প্রতিটি ব্যাচ কঠোর মান নিয়ন্ত্রণের মাধ্যমে মাঠ পর্যায়ে প্রেরিত হয়।',
    'We supply effective formulations to help farmers control crop pests and diseases. Every product batch is subject to strict quality control before distribution.'
  ],
  'about.point1': ['কৃষি সম্প্রসারণ অধিদপ্তর ও বালাইনাশক প্রশাসনের সকল নিয়ম মেনে নিবন্ধিত ২৬টি পণ্য সম্ভার', 'A portfolio of 26 products registered in compliance with agricultural and pesticide regulations'],
  'about.point2': ['ডিলারদের জন্য আধুনিক ইনভয়েস, চালান ও সহজ শর্তে লেনদেন সুবিধা', 'Modern invoices, delivery memos, and convenient transactions for dealers'],
  'about.point3': ['অভিজ্ঞ ফিল্ড অফিসার ও সেলস প্রতিনিধির সার্বক্ষণিক মাঠ পরামর্শ', 'Field guidance from experienced field officers and sales representatives'],
  'about.contact': ['হেড অফিস ও ডিস্ট্রিবিউশন হাব', 'Head Office & Distribution Hub'],
  'about.address': ['ঠিকানাঃ নিশিন্দারা, বগুড়া। (বগুড়া সদর)', 'Address: Nishindara, Bogura (Bogura Sadar)'],
  'about.phone': ['মোবাইল / হটলাইন: 01867912167', 'Mobile / Hotline: 01867912167'],
  'about.sister': ['সিস্টার কনসার্ন: মহানন্দা এগ্রো ইন্ডাস্ট্রিজ', 'Mahananda Agro Industries'],
  'about.call': ['সরাসরি যোগাযোগ করুন: 01867912167', 'Call us: 01867912167'],
  'auth.home': ['হোম পেজে ফিরুন', 'Back to Home'],
  'auth.register': ['অফিসার রেজিস্ট্রেশন', 'Officer Registration'],
  'auth.secureLogin': ['নিরাপদ লগইন', 'Secure Login'],
  'auth.management': ['ভ্যালিড এগ্রো অনলাইন ব্যবস্থাপনা', 'Valid Agro Online Management'],
  'auth.adminLogin': ['অ্যাডমিন লগইন', 'Admin Login'],
  'auth.officerLogin': ['অফিসার লগইন', 'Officer Login'],
  'auth.officerName': ['অফিসারের নাম', 'Officer Name'],
  'auth.officerCode': ['অফিসার কোড', 'Officer Code'],
  'auth.phone': ['নিবন্ধিত ফোন', 'Registered Phone'],
  'auth.email': ['ইমেইল', 'Email'],
  'auth.password': ['পাসওয়ার্ড', 'Password'],
  'auth.minimumPassword': ['কমপক্ষে ১০ অক্ষর', 'at least 10 characters'],
  'auth.wait': ['অপেক্ষা করুন...', 'Please wait...'],
  'auth.registerSubmit': ['রেজিস্ট্রেশন জমা দিন', 'Submit Registration'],
  'auth.loginSubmit': ['লগইন করুন', 'Log In'],
  'auth.newOfficer': ['নতুন অফিসার? রেজিস্ট্রেশন করুন', 'New officer? Register'],
  'auth.existingOfficer': ['আগে রেজিস্ট্রেশন করেছেন? লগইন করুন', 'Already registered? Log in'],
  'footer.summary': ['আধুনিক ও পরীক্ষিত ফসল সুরক্ষা বালাইনাশক ও সার প্রস্তুতকারক ও পরিবেশক।', 'Manufacturer and distributor of modern, quality-tested crop-protection pesticides and fertilizers.'],
  'footer.quickLinks': ['দ্রুত নেভিগেশন', 'Quick Links'],
  'footer.approvedProducts': ['অনুমোদিত ২৬টি পণ্য ক্যাটালগ', 'Catalog of 26 Registered Products'],
  'footer.inventorySales': ['ইনভেন্টরি ও সেলস', 'Inventory & Sales'],
  'footer.createInvoice': ['নতুন চালান ও ইনভয়েস তৈরি', 'Create Invoice'],
  'footer.warehouse': ['গোডাউন স্টক ও স্টক ইন', 'Warehouse Stock & Stock In'],
  'footer.returns': ['ডেমেজ পণ্য ফেরত অপশন', 'Damaged Product Returns'],
  'footer.dealerLedger': ['ডিলার হিসাব ও বাকি লেজার', 'Dealer Ledger & Dues'],
  'footer.officerTracking': ['অফিসার সেলস ট্র্যাকিং', 'Officer Sales Tracking'],
  'footer.monthlyStatement': ['মাসিক ইন/আউট স্টেটমেন্ট', 'Monthly In/Out Statement'],
  'footer.contact': ['যোগাযোগ ও ডিপো', 'Contact & Depot'],
  'footer.dealerInquiry': ['ডিলার ইনকোয়ারি ও মালামাল বুকিংয়ের জন্য সরাসরি ফোনে যোগাযোগ করুন।', 'Call us directly for dealer inquiries and product orders.'],
  'footer.rights': ['সর্বস্বত্ব সংরক্ষিত।', 'All rights reserved.'],
  'footer.system': ['নিশিন্দারা, বগুড়া কেন্দ্রিক ইনভেন্টরি ম্যানেজমেন্ট সিস্টেম', 'Nishindara, Bogura Inventory Management System'],
  'catalog.tagline': ['ভ্যালিড এগ্রো ও মহানন্দা এগ্রো ক্যাটালগ', 'Valid Agro / Mahananda Agro Catalog'],
  'catalog.heading': ['আমাদের সকল অনুমোদিত কৃষি পণ্য তালিকা', 'Our Registered Agricultural Products'],
  'catalog.details': ['প্রতিটি পণ্যের প্যাক সাইজ, কার্টুন প্যাকেজিং অনুপাত, টিপি ও এমআরপি রেট বিস্তারিত দেখুন', 'Explore pack sizes, carton ratios, trade prices, and retail prices.'],
  'catalog.search': ['পণ্য বা উপাদান দিয়ে খুঁজুন...', 'Search products or ingredients...'],
  'catalog.all': ['সকল পণ্য', 'All Products'],
  'catalog.pesticide': ['কীটনাশক', 'Insecticide'],
  'catalog.fungicide': ['ছত্রাকনাশক', 'Fungicide'],
  'catalog.fertilizer': ['সার ও অনুখাদ্য', 'Fertilizer & Micronutrients'],
  'catalog.growth': ['গ্রোথ প্রমোটার', 'Growth Promoter'],
  'catalog.packRatio': ['প্যাক সাইজ ও কার্টুন অনুপাত:', 'Pack Size & Carton Ratio:'],
  'catalog.detailsButton': ['বিস্তারিত দেখুন', 'View Details'],
  'catalog.notFound': ['কোনো পণ্য খুঁজে পাওয়া যায়নি।', 'No products found.'],
  'catalog.reset': ['ফিল্টার রিসেট করুন', 'Reset Filters'],
  'catalog.usage': ['কার্যকারিতা ও প্রয়োগ ক্ষেত্র:', 'Uses & Application:'],
  'catalog.rates': ['অনুমোদিত প্যাক সাইজ ও রেট তালিকা:', 'Registered Pack Sizes & Prices:'],
  'catalog.size': ['সাইজ', 'Size'],
  'catalog.packaging': ['কার্টুন প্যাকেজিং', 'Carton Packaging'],
  'catalog.tp': ['টিপি (৳)', 'Trade Price (৳)'],
  'catalog.mrp': ['এমআরপি (৳)', 'MRP (৳)'],
  'catalog.box': ['বক্স', 'box'],
  'catalog.dealerBenefit': ['ডিলারদের জন্য বিশেষ সুবিধা:', 'Dealer Benefits:'],
  'catalog.dealerBenefitDetails': ['বগুড়া ডিপো হতে তাৎক্ষণিক মালামাল ডেলিভারি ও ডেমেজ পণ্য ১০০% ফেরত গ্রহণের নিশ্চয়তা।', 'Fast delivery from the Bogura depot and guaranteed acceptance of damaged products.'],
  'catalog.close': ['বন্ধ করুন', 'Close'],
  'catalog.createMemo': ['চালান মেমো তৈরি করুন', 'Create Invoice Memo'],
  'catalog.units': ['টি', 'pcs'],
  'officer.dashboard': ['অফিসার ড্যাশবোর্ড', 'Officer Dashboard'],
  'officer.welcome': ['স্বাগতম,', 'Welcome,'],
  'officer.code': ['অফিসার কোড:', 'Officer Code:'],
  'officer.onlineSales': ['অনলাইন বিক্রয় ও স্টক', 'Online Sales & Stock'],
  'officer.invoiceCount': ['মোট বিক্রয় চালান', 'Total Sales Invoices'],
  'officer.salesAmount': ['মোট বিক্রয় মূল্য', 'Total Sales Value'],
  'officer.cartonsSold': ['আমার বিক্রিত কার্টুন', 'My Cartons Sold'],
  'officer.salesSummary': ['আমার বিক্রয় হিসাব', 'My Sales'],
  'officer.approvedInvoices': ['শুধু আপনার অফিসার কোডের অনুমোদিত চালান', 'Approved invoices for your officer code only'],
  'officer.invoice': ['চালান', 'Invoice'],
  'officer.date': ['তারিখ', 'Date'],
  'officer.dealer': ['ডিলার', 'Dealer'],
  'officer.officer': ['অফিসার', 'Officer'],
  'officer.sales': ['বিক্রয়', 'Sales'],
  'officer.noInvoices': ['এখনো কোনো বিক্রয় চালান নেই।', 'No sales invoices yet.'],
  'officer.productsSold': ['আমার বিক্রিত পণ্য', 'My Products Sold'],
  'officer.productCartonSummary': ['শুধু আপনার চালানে বিক্রি হওয়া পণ্যের কার্টুন হিসাব', 'Cartons sold on your invoices only'],
  'officer.product': ['পণ্য', 'Product'],
  'officer.packSize': ['প্যাক সাইজ', 'Pack Size'],
  'officer.cartonsSoldLabel': ['বিক্রিত কার্টুন', 'Cartons Sold'],
  'officer.noProductSales': ['আপনার কোনো বিক্রয় চালান নেই।', 'You have no sales invoices.'],
  'officer.newOrder': ['নতুন পণ্যের অর্ডার', 'New Product Order'],
  'officer.orderApproval': ['অর্ডার জমা দিলে অ্যাডমিন অনুমোদনের জন্য অপেক্ষা করবে।', 'Submitted orders will wait for admin approval.'],
  'officer.selectProduct': ['পণ্য ও প্যাক সাইজ নির্বাচন', 'Select Product & Pack Size'],
  'officer.stock': ['স্টক', 'Stock'],
  'officer.cartons': ['কার্টুন', 'cartons'],
  'officer.cartonQuantity': ['কার্টুন সংখ্যা', 'Carton Quantity'],
  'officer.remove': ['সরান', 'Remove'],
  'officer.addProduct': ['আরও পণ্য যোগ করুন', 'Add Another Product'],
  'officer.orderNote': ['অর্ডার সংক্রান্ত নোট (ঐচ্ছিক)', 'Order note (optional)'],
  'officer.submitting': ['জমা হচ্ছে...', 'Submitting...'],
  'officer.submitOrder': ['অর্ডার জমা দিন', 'Submit Order'],
  'officer.orderStatus': ['আমার অর্ডারের অবস্থা', 'My Order Status'],
  'officer.approved': ['অনুমোদিত', 'Approved'],
  'officer.rejected': ['প্রত্যাখ্যাত', 'Rejected'],
  'officer.pending': ['অনুমোদনের অপেক্ষায়', 'Awaiting approval'],
  'officer.adminNote': ['অ্যাডমিনের নোট:', 'Admin note:'],
  'officer.noOrders': ['আপনার কোনো অর্ডার নেই।', 'You have no orders.'],
  'officer.orderSubmitted': ['অর্ডারটি জমা হয়েছে। অ্যাডমিন অনুমোদনের পর এটি কার্যকর হবে।', 'Order submitted. It will take effect after admin approval.'],
  'invoice.title': ['ডিলার বিক্রয় চালান ও মেমো কপি', 'Dealer Sales Invoice & Memo Copy'],
  'invoice.session': ['সেশন: জুলাই - ডিসেম্বর ২০২৬', 'Session: July - December 2026'],
  'invoice.products': ['পণ্যের নাম ও প্যাক সাইজ', 'Product & Pack Size'],
  'invoice.cartons': ['কার্টুন', 'Cartons'],
  'invoice.tradePrice': ['ট্রেড প্রাইজ', 'Trade Price'],
  'invoice.totalTrade': ['মোট ট্রেড প্রাইজ', 'Total Trade Price'],
  'invoice.commissionPercent': ['কমিশন (%)', 'Commission (%)'],
  'invoice.commissionAmount': ['কমিশন এ্যামাউন্ট', 'Commission Amount'],
  'invoice.net': ['নীট মূল্য', 'Net Price']
};

function readStoredValue(key, fallback, allowedValues) {
  const value = window.localStorage.getItem(key);
  return allowedValues.includes(value) ? value : fallback;
}

export function UiPreferencesProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoredValue('vap-theme', 'agro', UI_THEMES.map(({ value }) => value)));
  const [language, setLanguage] = useState(() => readStoredValue('vap-language', 'bn', ['bn', 'en']));

  useEffect(() => {
    window.localStorage.setItem('vap-theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('vap-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    language,
    setLanguage,
    t: (key) => translations[key]?.[language === 'en' ? 1 : 0] ?? key
  }), [theme, language]);

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences() {
  const context = useContext(UiPreferencesContext);
  if (!context) throw new Error('useUiPreferences must be used within UiPreferencesProvider');
  return context;
}
