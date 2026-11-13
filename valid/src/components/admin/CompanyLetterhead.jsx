import React from 'react';

export default function CompanyLetterhead({ className = '' }) {
  return (
    <div className={`company-letterhead ${className}`.trim()}>
      <img src="/logos/mahananda-logo-transparent.png" alt="Mohananda Agro Industries" />
      <div className="company-letterhead-copy">
        <h1>MOHANANDA AGRO INDUSTRIES</h1>
        <h2>মহানন্দা এগ্রো ইন্ডাস্ট্রিজ</h2>
        <p>Agricultural Commodities Importer, Repacker &amp; Supplier</p>
        <p>Office/Factory: Matidali, Bogra Sadar, Bogra</p>
        <p>Mob: 01713-736920, 01773-523723 • E-mail: mohananda.agro@gmail.com</p>
      </div>
    </div>
  );
}
