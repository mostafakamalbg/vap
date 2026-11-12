import React, { useMemo, useState } from 'react';
import { Printer, Save, Trash2 } from 'lucide-react';
import SearchableRecordSelect from './SearchableRecordSelect';
import { formatDealerCode } from '../../../shared/codes';
import { toBn, toBnDate } from '../../utils/bengali';

const today = () => new Date().toISOString().slice(0, 10);
const socialOptions = ['প্রকৃত ব্যবসায়ী', 'ইউপি সদস্য', 'পৌর কমিশনার', 'রাজনীতির সাথে সংশ্লিষ্ট', 'অন্য কোন পেশা'];
const showroomOptions = ['খুচরা', 'পাইকারী', 'কাঁচা', 'আধাপাকা', 'পাকা', 'নিজস্ব', 'ভাড়া', 'সজ্জিত', 'অসজ্জিত'];
const transportOptions = ['সাইকেল', 'মোটর সাইকেল'];
const saleOptions = ['নগদ', 'বাকী'];
const checklistItems = [
  'পরিবেশক হিসেবে নিয়োগ প্রাপ্তির জন্য ও দাবীকৃত ক্রেডিট লিমিট উল্লেখ পূর্বক ছাপানো প্যাডে স্বহস্তে লিখিত একটি দরখাস্ত।',
  'ট্রেড লাইসেন্স এর ফটোকপি।',
  'কীটনাশক লাইসেন্স এর ফটোকপি।',
  'প্রথম শ্রেণীর গেজেটেড কর্মকর্তার কর্তৃক সত্যায়িত তিনকপি পাসপোর্ট সাইজের সদ্যতোলা রঙিন ছবি।',
  'সংশ্লিষ্ট কর্মকর্তার সহায়তায় পূরণকৃত এ্যাপ্রাইজাল ফরম।',
  'নাগরিক সনদপত্র।',
  'জাতীয় পরিচয় পত্রের ফটোকপি।'
];

const emptyAppraisal = () => ({
  id: '',
  documentType: 'appraisal',
  reference: `APP-${today().replace(/-/g, '')}`,
  date: today(),
  dealerId: '',
  establishment: '',
  proprietor: '',
  address: '',
  fatherName: '',
  permanentAddress: '',
  socialStatuses: [],
  pesticideLicenseNo: '',
  licenseIssueDate: '',
  licenseExpiryDate: '',
  showroomTypes: [],
  investmentCapital: '',
  salesmanCount: '',
  transportOptions: [],
  fertilizerAnnualSales: '',
  pesticideAnnualSales: '',
  distributorshipCompany: '',
  distributorshipAmount: '',
  distributorshipYears: '',
  distributorshipDue: '',
  fertilizerBusiness: '',
  retailerCount: '',
  businessAge: '',
  saleTypes: [],
  ownDue: '',
  bankAccountNumber: '',
  bankName: '',
  bankBranch: '',
  bankGuarantee: '',
  recommendation: '',
  logisticsChecklist: []
});

const emptyCheque = () => ({
  id: '',
  documentType: 'cheque',
  reference: `CHQ-${today().replace(/-/g, '')}`,
  date: today(),
  dealerId: '',
  farmName: '',
  proprietor: '',
  marketVillage: '',
  thana: '',
  district: '',
  dealerCode: '',
  phone: '',
  creditStartDate: '',
  chequeNumber: '',
  bankName: '',
  branch: '',
  chequeType: ''
});

function getAddressParts(address = '') {
  const parts = String(address)
    .split(/[,\u060c।]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    marketVillage: parts[0] || '',
    thana: parts[1] || '',
    district: parts.slice(2).join(', ')
  };
}

function Blank({ children }) {
  return children || '........................................';
}

function TickList({ values = [], options }) {
  return (
    <span className="document-ticks">
      {options.map((option) => (
        <span key={option} className="document-tick-item">
          <span className="document-checkbox">{values.includes(option) ? '✓' : ''}</span>{option}
        </span>
      ))}
    </span>
  );
}

function CompanyHeader({ reference, date }) {
  return (
    <header className="corporate-header">
      <h1>MOHANANDA AGRO INDUSTRIES (মহানন্দা এগ্রো ইন্ডাস্ট্রিজ)</h1>
      <p className="corporate-tagline">Agricultural Commodities Importer, Repacker &amp; Supplier</p>
      <div className="corporate-reference"><span><strong>Ref:</strong> {reference || '____________'}</span><span><strong>Date:</strong> {toBnDate(date) || '____________'}</span></div>
      <p>Office/Factory: Matidali, Bogra Sadar, Bogra.</p>
      <p>Mob: 01713-736920, 01773-523723 • E-mail: mohananda.agro@gmail.com</p>
    </header>
  );
}

function CompanyFooter() {
  return (
    <footer className="corporate-document-footer">
      <p>Office/Factory: Matidali, Bogra Sadar, Bogra.</p>
      <p>Mob: 01713-736920, 01773-523723 • E-mail: mohananda.agro@gmail.com</p>
    </footer>
  );
}

function SignatureLine({ children }) {
  return <div className="corporate-signature"><span>{children}</span></div>;
}

function AppraisalDocument({ form }) {
  return (
    <article className="corporate-document appraisal-document">
      <section className="corporate-page">
        <CompanyHeader reference={form.reference} date={form.date} />
        <h2 className="corporate-title">এ্যাপ্রাইজাল ফরম</h2>
        <p>প্রতি,<br />মহানন্দা এগ্রো ইন্ডাস্ট্রিজ,<br />নিশিন্দারা, বগুড়া সদর, বগুড়া।</p>
        <p><strong>বিষয়ঃ- পরিবেশক নিয়োগ প্রাপ্তির জন্য আবেদন।</strong></p>
        <p>জনাব, আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ।</p>
        <p className="document-justified">নিম্ন লিখিত তথ্য সম্বলিত ব্যক্তি একজন সার ও কীটনাশক ব্যবসায়ী। তিনি মহানন্দা এগ্রো ইন্ডাস্ট্রিজ এর সাথে ব্যবসা করার জন্য খুবই আগ্রহী এবং সে জন্য তিনি আপনার বরাবর দরখাস্ত পেশ করেছেন। আমি তার বিস্তারিত তথ্য সংগ্রহ করে নিম্নে বিনীত ছকে পূরণ করে আপনার বরাবর পেশ করিলাম।</p>
        <table className="corporate-table appraisal-table">
          <tbody>
            <tr><th>১. ব্যবসা প্রতিষ্ঠানের নাম</th><td><Blank>{form.establishment}</Blank></td></tr>
            <tr><th>২. স্বত্বাধিকারীর নাম</th><td><Blank>{form.proprietor}</Blank></td></tr>
            <tr><th>৩. ঠিকানা</th><td><Blank>{form.address}</Blank></td></tr>
            <tr><th>৪. পিতার নাম</th><td><Blank>{form.fatherName}</Blank></td></tr>
            <tr><th>৫. স্থায়ী ঠিকানা</th><td><Blank>{form.permanentAddress}</Blank></td></tr>
            <tr><th>৬. সামাজিক মর্যাদা</th><td><TickList values={form.socialStatuses} options={socialOptions} /></td></tr>
            <tr><th>৭. কীটনাশক লাইসেন্স</th><td>লাইসেন্স নং: <Blank>{form.pesticideLicenseNo}</Blank> • ইস্যু তাং: <Blank>{toBnDate(form.licenseIssueDate)}</Blank> • মেয়াদ: <Blank>{toBnDate(form.licenseExpiryDate)}</Blank></td></tr>
            <tr><th>৮. শো রুমের ধরন</th><td><TickList values={form.showroomTypes} options={showroomOptions} /></td></tr>
            <tr><th>৯. নিজস্ব বিনিয়োগযুক্ত পুঁজি</th><td>টাকা: <Blank>{form.investmentCapital && toBn(form.investmentCapital)}</Blank></td></tr>
            <tr><th>১০. জনবল / ট্রান্সপোর্ট</th><td>সেলস্ ম্যান: <Blank>{form.salesmanCount && toBn(form.salesmanCount)}</Blank> জন • <TickList values={form.transportOptions} options={transportOptions} /></td></tr>
            <tr><th>১১. বাৎসরিক ব্যবসা</th><td>সার: <Blank>{form.fertilizerAnnualSales && toBn(form.fertilizerAnnualSales)}</Blank> টাকা • কীটনাশক: <Blank>{form.pesticideAnnualSales && toBn(form.pesticideAnnualSales)}</Blank> টাকা</td></tr>
            <tr><th>১২. ডিস্ট্রিবিউটরশীপ</th><td>কোম্পানির নাম: <Blank>{form.distributorshipCompany}</Blank> • ব্যবসা: <Blank>{form.distributorshipAmount && toBn(form.distributorshipAmount)}</Blank> টাকা • সময়: <Blank>{form.distributorshipYears && toBn(form.distributorshipYears)}</Blank> বছর • বাকি: <Blank>{form.distributorshipDue && toBn(form.distributorshipDue)}</Blank> টাকা</td></tr>
            <tr><th>১৩. সারের ব্যবসা আছে কিনা</th><td><TickList values={form.fertilizerBusiness ? [form.fertilizerBusiness] : []} options={['আছে', 'নাই']} /></td></tr>
            <tr><th>১৪. কত জন রিটেইলার আছে</th><td><Blank>{form.retailerCount && toBn(form.retailerCount)}</Blank> জন / নাই</td></tr>
            <tr><th>১৫. সার-কীটনাশক ব্যবসার বয়স</th><td><Blank>{form.businessAge && toBn(form.businessAge)}</Blank> বছর</td></tr>
            <tr><th>১৬. বিক্রয় ধরন</th><td><TickList values={form.saleTypes} options={saleOptions} /></td></tr>
            <tr><th>১৭. বাকী হয়ে থাকলে কত টাকা বাকী আছে</th><td>নিজস্ব বাকী: <Blank>{form.ownDue && toBn(form.ownDue)}</Blank> টাকা</td></tr>
            <tr><th>১৮. ব্যাংক একাউন্ট বিবরণ</th><td>হিসাব নং: <Blank>{form.bankAccountNumber}</Blank> • ব্যাংক: <Blank>{form.bankName}</Blank> • শাখা: <Blank>{form.bankBranch}</Blank></td></tr>
            <tr><th>১৯. ব্যাংক গ্যারান্টি দিতে সক্ষম কিনা</th><td><TickList values={form.bankGuarantee ? [form.bankGuarantee] : []} options={['সক্ষম', 'সক্ষম নয়']} /></td></tr>
          </tbody>
        </table>
        <div className="corporate-signature-row">
          <SignatureLine>কোম্পানির পক্ষে স্থানীয় প্রতিনিধি</SignatureLine>
          <SignatureLine>দ্বিতীয় পক্ষের স্বাক্ষর ও সিল</SignatureLine>
        </div>
      </section>

      <section className="corporate-page">
        <CompanyHeader reference={form.reference} date={form.date} />
        <h2 className="corporate-title">অফিসার ও আবেদনকারীর ঘোষণা</h2>
        <h3>অফিসারের সুপারিশঃ</h3>
        <p className="document-justified">আবেদনকারী একজন রাজনীতিমুক্ত প্রকৃত সার-কীটনাশক ব্যবসায়ী। লিখিত বিবরণ অনুযায়ী সম্পূর্ণ সত্য তথ্য প্রদান করিয়াছি। সে কোম্পানির সকল নিয়ম নীতি মেনে ব্যবসা করতে আগ্রহী, বিধায় পরিবেশক হিসাবে তাকে নির্বাচিত করিবার সদয় অনুমতি প্রার্থনা করিতেছি।</p>
        {form.recommendation && <p><strong>অতিরিক্ত মন্তব্য:</strong> {form.recommendation}</p>}
        <div className="corporate-signature-row single-signature"><SignatureLine>অফিসারের স্বাক্ষর ও সিল</SignatureLine></div>
        <h3 className="declaration-heading">আবেদনকারীর ঘোষণাঃ</h3>
        <p className="document-justified">আমি উপরোক্ত তথ্যাবলী সম্পূর্ণ সত্যভাবে উপস্থাপন করেছি। কোন সত্য গোপন বা মিথ্যা তথ্য প্রদান করি নাই এবং মহানন্দা এগ্রো ইন্ডাস্ট্রিজ এর সাথে ব্যবসা করার জন্য কোম্পানী কতৃক যে সমস্ত শর্ত আরোপ করা হবে আমি তা সর্বান্তভাবে মেনে চলার অঙ্গীকার করছি এবং কোম্পানীর নিয়ম অনুযায়ী প্রতি বছরের ২৮শে ডিসেম্বর ও ৩০শে জুন এর মধ্যে সমূদয় বকেয়া টাকা ডি ডি আকারে পরিশোধ করতে বাধ্য থাকিব অন্যথায় জামানত হিসাবে জমাকৃত চেকটি নগদায়ন করে কোম্পানী তার পাওনা টাকা আদায়ের ব্যবস্থা গ্রহণ করতে পারবেন এবং বাৎসরিক বোনাস কর্তন করার এখতিয়ার কোম্পানীর থাকিবে। উক্ত বিষয়ে আমি ওজর আপত্তি করিব না।</p>
        <div className="corporate-signature-row single-signature applicant-signature"><SignatureLine>আবেদনকারীর স্বাক্ষর ও সিল</SignatureLine></div>
        <div className="corporate-document-parties"><span>আবেদনকারী: {form.establishment || '________________'}</span><span>স্বত্বাধিকারী: {form.proprietor || '________________'}</span></div>
      </section>

      <section className="corporate-page">
        <CompanyHeader reference={form.reference} date={form.date} />
        <h2 className="corporate-title">লজিস্টিক অফিসারের মতামতঃ</h2>
        <p className="document-justified">আবেদন কারি দ্বারা প্রদত্ত নিম্ন লিখিত যাবতীয় প্রয়োজনীয় কাগজ পত্র সেলস্ অফিসার মারফত বুঝিয়া পেয়েছি।</p>
        <ol className="logistics-checklist">
          {checklistItems.map((item, index) => (
            <li key={item}><span className="document-checkbox">{form.logisticsChecklist.includes(String(index)) ? '✓' : ''}</span>{item}</li>
          ))}
        </ol>
        <div className="approval-statement">পরিবেশক নিয়োগ অনুমতি দেওয়া হইল।</div>
        <div className="corporate-signature-row approval-signatures">
          <SignatureLine>লজিস্টিক অফিসারের স্বাক্ষর ও সিল</SignatureLine>
          <SignatureLine>হেড অব কোম্পানী</SignatureLine>
        </div>
      </section>
    </article>
  );
}

function ChequeDocument({ form }) {
  return (
    <article className="corporate-document cheque-document">
      <section className="corporate-page">
        <CompanyHeader reference={form.reference} date={form.date} />
        <h2 className="corporate-title">চেক প্রদান ও গ্রহণ সম্পর্কিত বিবরণ</h2>
        <div className="cheque-party">
          <p>প্রথম পক্ষ, কোম্পানীঃ মেসার্স মহানন্দা এগ্রো ইন্ডাস্ট্রিজ।</p>
          <p>মাটিডালি, বগুড়া সদর, বগুড়া।</p>
        </div>
        <div className="cheque-fields">
          <p>দ্বিতীয় পক্ষ, ফার্মের নাম: <Blank>{form.farmName}</Blank> প্রোপাইটার: <Blank>{form.proprietor}</Blank></p>
          <p>বাজার/গ্রাম: <Blank>{form.marketVillage}</Blank> উপজেলা: <Blank>{form.thana}</Blank></p>
          <p>জেলা: <Blank>{form.district}</Blank> টোটার আইডি নং: <Blank>{form.dealerCode}</Blank></p>
          <p>মোবাইল নং: <Blank>{form.phone}</Blank></p>
        </div>
        <p className="cheque-declaration">প্রকাশ থাকে যে, আমি দ্বিতীয় পক্ষ গত <Blank>{toBnDate(form.creditStartDate)}</Blank> তারিখ থেকে প্রথম পক্ষের সাথে বাকীতে ব্যবসা পরিচালনা আসিতেছি। বাকী ব্যবসার বিপরীতে আমার নিকট পাওনা কৃত টাকা নগদায়ন এর জন্য প্রথম পক্ষকে এক খানা চেক প্রদান করিলাম।</p>
        <p>যার বিবরণঃ চেক নং: <Blank>{form.chequeNumber}</Blank> ব্যাংক এর নাম: <Blank>{form.bankName}</Blank></p>
        <p>শাখা: <Blank>{form.branch}</Blank> ধরন: <Blank>{form.chequeType}</Blank></p>
        <p className="cheque-declaration">উপরোক্ত বিষয়াদি আমি দ্বিতীয় পক্ষ জেনে, বুঝে, স্ব-জ্ঞানে, স্ব-ইচ্ছায় নিম্নে স্বাক্ষর করিলাম।</p>
        <div className="corporate-signature-row cheque-signatures">
          <SignatureLine>কোম্পানির পক্ষে স্থানীয় প্রতিনিধি</SignatureLine>
          <SignatureLine>দ্বিতীয় পক্ষের স্বাক্ষর ও সিল</SignatureLine>
        </div>
        <CompanyFooter />
      </section>
    </article>
  );
}

function InputField({ form, setForm, name, label, type = 'text', className = '' }) {
  return (
    <label className={`text-xs font-bold text-slate-700 ${className}`}>
      {label}
      <input
        type={type}
        value={form[name] || ''}
        onChange={(event) => setForm((previous) => ({ ...previous, [name]: event.target.value }))}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
      />
    </label>
  );
}

function CheckField({ form, setForm, name, label, options }) {
  const values = Array.isArray(form[name]) ? form[name] : [];
  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-bold text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={() => setForm((previous) => ({
                ...previous,
                [name]: values.includes(option)
                  ? values.filter((value) => value !== option)
                  : [...values, option]
              }))}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function DistributorForms({
  type,
  dealers,
  getDealerSummary,
  documents,
  saveDocument,
  deleteDocument
}) {
  const isAppraisal = type === 'appraisal';
  const [form, setForm] = useState(() => isAppraisal ? emptyAppraisal() : emptyCheque());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const currentDocuments = documents
    .filter((document) => document.documentType === type)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const dealerItems = useMemo(() => dealers, [dealers]);
  const autoFillDealer = (dealerId) => {
    const dealer = dealers.find((entry) => entry.id === dealerId);
    if (!dealer) {
      setForm((previous) => ({ ...previous, dealerId }));
      return;
    }
    const address = getAddressParts(dealer.address);
    const dealerSummary = getDealerSummary(dealer.id);
    setForm((previous) => ({
      ...previous,
      dealerId,
      ...(isAppraisal ? {
        establishment: dealer.shopName || '',
        proprietor: dealer.proprietor || '',
        address: dealer.address || '',
        permanentAddress: dealer.address || '',
        ownDue: String(dealerSummary?.currentDue ?? dealer.openingDue ?? '')
      } : {
        farmName: dealer.shopName || '',
        proprietor: dealer.proprietor || '',
        marketVillage: address.marketVillage,
        thana: address.thana || dealer.zone || '',
        district: address.district,
        dealerCode: formatDealerCode(dealer.code || dealer.id),
        phone: dealer.phone || ''
      })
    }));
    setError('');
    setMessage('');
  };

  const reset = () => {
    setForm(isAppraisal ? emptyAppraisal() : emptyCheque());
    setError('');
    setMessage('');
  };

  const loadDocument = (document) => {
    setForm({
      ...(isAppraisal ? emptyAppraisal() : emptyCheque()),
      ...document
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (!form.reference.trim() || !form.date || !form.dealerId) {
      setError('রেফারেন্স, তারিখ ও ডিলার নির্বাচন করুন।');
      return;
    }
    const document = saveDocument({
      ...form,
      documentType: type,
      dealerName: dealers.find((dealer) => dealer.id === form.dealerId)?.shopName || '',
      reference: form.reference.trim()
    });
    setForm(document);
    setMessage('ফরম সংরক্ষণ হয়েছে।');
    setError('');
  };

  const handleDelete = (document) => {
    if (!window.confirm(`${document.reference || document.establishment || document.farmName} ফরমটি মুছবেন?`)) return;
    deleteDocument(document.id);
    if (form.id === document.id) reset();
  };

  const report = isAppraisal ? <AppraisalDocument form={form} /> : <ChequeDocument form={form} />;

  return (
    <div className="space-y-5">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900">{isAppraisal ? 'পরিবেশক এ্যাপ্রাইজাল ফরম' : 'চেক প্রদান ও গ্রহণ সম্পর্কিত বিবরণ'}</h1>
          <p className="text-sm text-slate-500">ডিলার নির্বাচন করলে বিদ্যমান পরিচিতি, বিক্রয় ও বকেয়ার তথ্য স্বয়ংক্রিয়ভাবে বসবে।</p>
        </div>
        <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">নতুন ফরম</button>
      </header>

      {error && <p role="alert" className="no-print rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="no-print rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={handleSave} className="no-print space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">{form.id ? 'ফরম সম্পাদনা' : 'ফরমের তথ্য'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField form={form} setForm={setForm} name="reference" label="রেফারেন্স (Ref) *" />
            <InputField form={form} setForm={setForm} name="date" label="তারিখ *" type="date" />
            <div className="sm:col-span-2">
              <SearchableRecordSelect
                label="ডিলার নির্বাচন করে স্বয়ংক্রিয় তথ্য পূরণ করুন *"
                items={dealerItems}
                value={form.dealerId}
                onChange={autoFillDealer}
                placeholder="ডিলার নির্বাচন করুন"
                searchPlaceholder="কোড বা নাম দিয়ে খুঁজুন"
                optionLabel={(dealer) => `${formatDealerCode(dealer.code)} • ${dealer.shopName}`}
                searchText={(dealer) => `${formatDealerCode(dealer.code)} ${dealer.shopName || ''} ${dealer.proprietor || ''}`}
              />
            </div>
            {isAppraisal ? (
              <>
                <InputField form={form} setForm={setForm} name="establishment" label="ব্যবসা প্রতিষ্ঠানের নাম" />
                <InputField form={form} setForm={setForm} name="proprietor" label="স্বত্বাধিকারীর নাম" />
                <InputField form={form} setForm={setForm} name="address" label="ঠিকানা" className="sm:col-span-2" />
                <InputField form={form} setForm={setForm} name="fatherName" label="পিতার নাম" />
                <InputField form={form} setForm={setForm} name="permanentAddress" label="স্থায়ী ঠিকানা" />
                <CheckField form={form} setForm={setForm} name="socialStatuses" label="সামাজিক মর্যাদা" options={socialOptions} />
                <InputField form={form} setForm={setForm} name="pesticideLicenseNo" label="কীটনাশক লাইসেন্স নং" />
                <InputField form={form} setForm={setForm} name="licenseIssueDate" label="লাইসেন্স ইস্যু তারিখ" type="date" />
                <InputField form={form} setForm={setForm} name="licenseExpiryDate" label="লাইসেন্স মেয়াদ" type="date" />
                <CheckField form={form} setForm={setForm} name="showroomTypes" label="শো রুমের ধরন" options={showroomOptions} />
                <InputField form={form} setForm={setForm} name="investmentCapital" label="নিজস্ব বিনিয়োগযুক্ত পুঁজি (৳)" type="number" />
                <InputField form={form} setForm={setForm} name="salesmanCount" label="সেলস্ ম্যান (জন)" type="number" />
                <CheckField form={form} setForm={setForm} name="transportOptions" label="ট্রান্সপোর্ট" options={transportOptions} />
                <InputField form={form} setForm={setForm} name="fertilizerAnnualSales" label="বাৎসরিক সার ব্যবসা (৳)" type="number" />
                <InputField form={form} setForm={setForm} name="pesticideAnnualSales" label="বাৎসরিক কীটনাশক ব্যবসা (৳)" type="number" />
                <InputField form={form} setForm={setForm} name="distributorshipCompany" label="ডিস্ট্রিবিউটরশীপ কোম্পানি" />
                <InputField form={form} setForm={setForm} name="distributorshipAmount" label="কত টাকার ব্যবসা (৳)" type="number" />
                <InputField form={form} setForm={setForm} name="distributorshipYears" label="কত বছর যাবৎ" type="number" />
                <InputField form={form} setForm={setForm} name="distributorshipDue" label="বাকী কত টাকা (৳)" type="number" />
                <label className="text-xs font-bold text-slate-700">সারের ব্যবসা আছে কিনা<select value={form.fertilizerBusiness} onChange={(event) => setForm((previous) => ({ ...previous, fertilizerBusiness: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">নির্বাচন করুন</option><option>আছে</option><option>নাই</option></select></label>
                <InputField form={form} setForm={setForm} name="retailerCount" label="রিটেইলার সংখ্যা" type="number" />
                <InputField form={form} setForm={setForm} name="businessAge" label="ব্যবসার বয়স (বছর)" type="number" />
                <CheckField form={form} setForm={setForm} name="saleTypes" label="বিক্রয় ধরন" options={saleOptions} />
                <InputField form={form} setForm={setForm} name="ownDue" label="নিজস্ব বাকী (৳)" type="number" />
                <InputField form={form} setForm={setForm} name="bankAccountNumber" label="ব্যাংক হিসাব নং" />
                <InputField form={form} setForm={setForm} name="bankName" label="ব্যাংকের নাম" />
                <InputField form={form} setForm={setForm} name="bankBranch" label="ব্যাংক শাখা" />
                <label className="text-xs font-bold text-slate-700">ব্যাংক গ্যারান্টি দিতে সক্ষম কিনা<select value={form.bankGuarantee} onChange={(event) => setForm((previous) => ({ ...previous, bankGuarantee: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">নির্বাচন করুন</option><option>সক্ষম</option><option>সক্ষম নয়</option></select></label>
                <label className="text-xs font-bold text-slate-700 sm:col-span-2">অফিসারের অতিরিক্ত সুপারিশ<textarea rows={2} value={form.recommendation} onChange={(event) => setForm((previous) => ({ ...previous, recommendation: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                <fieldset className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
                  <legend className="px-1 text-xs font-bold text-slate-700">লজিস্টিক কাগজপত্র গ্রহণ</legend>
                  <div className="grid gap-2 sm:grid-cols-2">{checklistItems.map((item, index) => <label key={item} className="flex items-start gap-2 text-xs font-normal text-slate-700"><input type="checkbox" checked={form.logisticsChecklist.includes(String(index))} onChange={() => setForm((previous) => ({ ...previous, logisticsChecklist: previous.logisticsChecklist.includes(String(index)) ? previous.logisticsChecklist.filter((value) => value !== String(index)) : [...previous.logisticsChecklist, String(index)] }))} />{item}</label>)}</div>
                </fieldset>
              </>
            ) : (
              <>
                <InputField form={form} setForm={setForm} name="farmName" label="দ্বিতীয় পক্ষ, ফার্মের নাম" />
                <InputField form={form} setForm={setForm} name="proprietor" label="প্রোপাইটার" />
                <InputField form={form} setForm={setForm} name="marketVillage" label="বাজার / গ্রাম" />
                <InputField form={form} setForm={setForm} name="thana" label="উপজেলা" />
                <InputField form={form} setForm={setForm} name="district" label="জেলা" />
                <InputField form={form} setForm={setForm} name="dealerCode" label="ডিলার আইডি নং" />
                <InputField form={form} setForm={setForm} name="phone" label="মোবাইল নং" />
                <InputField form={form} setForm={setForm} name="creditStartDate" label="বাকী ব্যবসা শুরুর তারিখ" type="date" />
                <InputField form={form} setForm={setForm} name="chequeNumber" label="চেক নং" />
                <InputField form={form} setForm={setForm} name="bankName" label="ব্যাংকের নাম" />
                <InputField form={form} setForm={setForm} name="branch" label="শাখা" />
                <InputField form={form} setForm={setForm} name="chequeType" label="চেকের ধরন" />
              </>
            )}
          </div>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 font-black text-white hover:bg-emerald-800"><Save className="h-4 w-4" /> {form.id ? 'ফরম আপডেট করুন' : 'ফরম সংরক্ষণ করুন'}</button>
        </form>

        <section className="space-y-3">
          <div className="no-print flex justify-end">
            <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-bold text-white"><Printer className="h-4 w-4" /> {isAppraisal ? '৩ পৃষ্ঠার এ্যাপ্রাইজাল প্রিন্ট' : 'চেক ফরম প্রিন্ট'}</button>
          </div>
          {report}
        </section>
      </div>

      <section className="no-print overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 font-black text-slate-900">সংরক্ষিত {isAppraisal ? 'এ্যাপ্রাইজাল' : 'চেক প্রদান' } ফরম</h2>
        <div className="divide-y divide-slate-100">
          {currentDocuments.map((document) => (
            <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div><p className="font-bold text-slate-800">{document.establishment || document.farmName || document.dealerName || 'ডিলার'} • {document.proprietor || 'স্বত্বাধিকারী'}</p><p className="text-xs text-slate-500">{document.reference} • {toBnDate(document.date)}</p></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => loadDocument(document)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">খুলুন / প্রিন্ট</button>
                <button type="button" onClick={() => handleDelete(document)} aria-label="ফরম মুছুন" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {!currentDocuments.length && <p className="p-6 text-center text-sm text-slate-500">এখনও কোনো ফরম সংরক্ষণ করা হয়নি।</p>}
        </div>
      </section>
    </div>
  );
}
