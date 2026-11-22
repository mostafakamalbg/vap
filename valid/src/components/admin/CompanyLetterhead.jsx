import React from 'react';
import { toBn } from '../../utils/bengali';
import { HEAD_OFFICE_ADDRESS, HOTLINE_ADDRESS, HOTLINE_NUMBER } from '../../../shared/companyContact';

export default function CompanyLetterhead({ className = '' }) {
  return (
    <div className={`invoice-print-company-row company-letterhead ${className}`.trim()}>
      <div className="invoice-print-company-group">
        <div className="invoice-print-logo invoice-print-logo-valid">
          <img src="/logos/valid-logo.png" alt="" />
        </div>
        <div className="invoice-company-copy">
          <h1>ভ্যালিড এগ্রো প্রোডাক্ট লিমিটেড</h1>
          <h2>মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</h2>
          <p>হেড অফিস: {HEAD_OFFICE_ADDRESS}</p>
          <p>হটলাইন: {toBn(HOTLINE_NUMBER)} • ঠিকানা: {HOTLINE_ADDRESS}</p>
        </div>
        <div className="invoice-print-logo invoice-print-logo-mahananda">
          <img src="/logos/mahananda-logo-transparent.png" alt="" />
        </div>
      </div>
    </div>
  );
}
