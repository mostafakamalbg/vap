import React from 'react';

const invoiceTypeLabels = {
  dealer_return: 'ডিলার ফেরত চালান ও ক্রেডিট মেমো',
  factory_damage: 'ফ্যাক্টরি ফেরত চালান',
  regular: 'ডিলার বিক্রয় চালান ও মেমো কপি'
};

export default function InvoicePrintHeader({ invoiceType = 'regular' }) {
  return (
    <div className="invoice-company-header border-b-2 border-emerald-800 pb-3">
      <div className="invoice-company-row">
        <div className="invoice-company-brand">
          <img src="/logos/valid-logo.png" alt="ভ্যালিড এগ্রো প্রোডাক্টস" />
          <h2>ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড</h2>
        </div>
        <div className="invoice-company-brand">
          <img src="/logos/mahananda-logo.png" alt="মহানন্দা এগ্রো ইন্ডাস্ট্রিজ" />
          <h3>মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</h3>
        </div>
      </div>
      <div className="invoice-company-contact">
        নিশিন্দারা, বগুড়া • হটলাইন: 01867912167
      </div>
      <div className="text-center mt-2">
        <span className="inline-block bg-emerald-800 text-white px-4 py-0.5 rounded text-xs font-bold">
          {invoiceTypeLabels[invoiceType] || invoiceTypeLabels.regular}
        </span>
      </div>
    </div>
  );
}
