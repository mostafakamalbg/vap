export const PAYMENT_METHODS = [
  { value: 'cash', label: 'ক্যাশ (Cash)' },
  { value: 'credit', label: 'ক্রেডিট (Credit)' },
  { value: 'bank', label: 'ব্যাংক (Bank)' },
  { value: 'mobile_banking', label: 'মোবাইল ব্যাংকিং (Mobile Banking)' }
];

export const PAYMENT_TYPES = [
  { value: 'dealer_collection', label: 'ডিলার কালেকশন' },
  { value: 'company_transfer', label: 'কোম্পানিতে টাকা পাঠানো' },
  { value: 'office_pay', label: 'অফিস খরচ' },
  { value: 'salary', label: 'বেতন' },
  { value: 'vehicle_rent', label: 'গাড়ি ভাড়া' },
  { value: 'lc_commission', label: 'লেস কমিশন (LC)' }
];

export const DEALER_BALANCE_CREDIT_TYPES = new Set([
  'dealer_collection',
  'company_transfer',
  'office_pay',
  'salary',
  'vehicle_rent',
  'lc_commission'
]);

export const LEDGER_PAYMENT_TYPES = PAYMENT_TYPES.filter((entry) => (
  entry.value !== 'dealer_collection' && entry.value !== 'office_pay'
));

const PAYMENT_TYPE_ALIASES = new Map([
  ['office pay', 'office_pay'],
  ['office payment', 'office_pay'],
  ['office expense', 'office_pay'],
  ['office/depot', 'office_pay'],
  ['office depot', 'office_pay'],
  ['depot', 'office_pay'],
  ['depot pay', 'office_pay'],
  ['depot payment', 'office_pay'],
  ['অফিস খরচ', 'office_pay'],
  ['অফিস/ডিপো', 'office_pay'],
  ['অফিস ডিপো', 'office_pay'],
  ['ডিপো', 'office_pay'],
  ['ডিপো খরচ', 'office_pay'],
  ['company transfer', 'company_transfer'],
  ['company payment', 'company_transfer'],
  ['কোম্পানিতে টাকা পাঠানো', 'company_transfer']
]);

export function resolvePaymentType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (PAYMENT_TYPES.some((entry) => entry.value === value)) return value;

  const alias = value
    .replace(/[._-]+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  return PAYMENT_TYPE_ALIASES.get(alias) || '';
}

export function normalizePaymentType(type) {
  return resolvePaymentType(type) || 'dealer_collection';
}

export function isDealerCollection(payment) {
  const resolvedType = resolvePaymentType(payment?.paymentType);
  const type = resolvedType || (!String(payment?.paymentType || '').trim() ? 'dealer_collection' : '');
  return type === 'dealer_collection' || type === 'company_transfer';
}

export function isDealerBalanceCredit(payment) {
  const resolvedType = resolvePaymentType(payment?.paymentType);
  const type = resolvedType || (!String(payment?.paymentType || '').trim() ? 'dealer_collection' : '');
  return DEALER_BALANCE_CREDIT_TYPES.has(type);
}

export function normalizePaymentMethod(method) {
  const value = String(method || '').trim().toLowerCase();
  if (value === 'credit' || value.includes('ক্রেডিট')) return 'credit';
  if (value === 'mobile_banking' || value.includes('মোবাইল') || value.includes('বিকাশ')) {
    return 'mobile_banking';
  }
  if (value === 'bank' || value.includes('ব্যাংক')) return 'bank';
  return 'cash';
}
