export const PAYMENT_METHODS = [
  { value: 'cash', label: 'ক্যাশ (Cash)' },
  { value: 'credit', label: 'ক্রেডিট (Credit)' },
  { value: 'bank', label: 'ব্যাংক (Bank)' },
  { value: 'mobile_banking', label: 'মোবাইল ব্যাংকিং (Mobile Banking)' }
];

export const PAYMENT_TYPES = [
  { value: 'dealer_collection', label: 'ডিলার কালেকশন' },
  { value: 'office_payment', label: 'অফিস পেমেন্ট' },
  { value: 'salary', label: 'বেতন' },
  { value: 'vehicle_rent', label: 'গাড়ি ভাড়া' },
  { value: 'lc_commission', label: 'লেস কমিশন (LC)' }
];

export const DEALER_BALANCE_CREDIT_TYPES = new Set([
  'dealer_collection',
  'office_payment',
  'salary',
  'vehicle_rent',
  'lc_commission'
]);

export const LEDGER_PAYMENT_TYPES = PAYMENT_TYPES.filter((entry) => (
  entry.value !== 'dealer_collection'
));

const PAYMENT_TYPE_ALIASES = new Map([
  ['office pay', 'office_payment'],
  ['office payment', 'office_payment'],
  ['office_pay', 'office_payment'],
  ['office expense', 'office_payment'],
  ['office', 'office_payment'],
  ['office/depot', 'office_payment'],
  ['office / depot', 'office_payment'],
  ['office depot', 'office_payment'],
  ['office and depot', 'office_payment'],
  ['depot', 'office_payment'],
  ['depot pay', 'office_payment'],
  ['depot payment', 'office_payment'],
  ['অফিস খরচ', 'office_payment'],
  ['অফিস/ডিপো', 'office_payment'],
  ['অফিস / ডিপো', 'office_payment'],
  ['অফিস ও ডিপো', 'office_payment'],
  ['অফিস এবং ডিপো', 'office_payment'],
  ['অফিস ডিপো', 'office_payment'],
  ['ডিপো/অফিস', 'office_payment'],
  ['ডিপো', 'office_payment'],
  ['ডিপো খরচ', 'office_payment'],
  ['company transfer', 'office_payment'],
  ['company_transfer', 'office_payment'],
  ['company payment', 'office_payment'],
  ['টাকা কোম্পানিতে পাঠানো', 'office_payment'],
  ['কোম্পানিতে টাকা পাঠানো', 'office_payment'],
  ['কোম্পানিতে টাকা জমা', 'office_payment'],
  ['বেতন', 'salary'],
  ['গাড়ি ভাড়া', 'vehicle_rent'],
  ['ভাড়া', 'vehicle_rent'],
  ['lc commission', 'lc_commission'],
  ['লেস কমিশন (lc)', 'lc_commission'],
  ['lc', 'lc_commission']
]);
export const PAYMENT_TYPE_FIELDS = Object.freeze([
  'paymentType',
  'purpose',
  'category',
  'expenseType',
  'expenseCategory',
  'paymentPurpose',
  'transactionType',
  'type'
]);

function normalizePaymentTypeAlias(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolvePaymentType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (PAYMENT_TYPES.some((entry) => entry.value === value)) return value;
  return PAYMENT_TYPE_ALIASES.get(normalizePaymentTypeAlias(value)) || '';
}

export function getPaymentTypeAliases(type) {
  const resolvedType = resolvePaymentType(type);
  if (!resolvedType) return [];
  return [...new Set([
    normalizePaymentTypeAlias(resolvedType),
    ...[...PAYMENT_TYPE_ALIASES]
      .filter(([, value]) => value === resolvedType)
      .map(([alias]) => normalizePaymentTypeAlias(alias))
  ])];
}

export function resolvePaymentRecordType(payment) {
  for (const field of PAYMENT_TYPE_FIELDS) {
    const resolved = resolvePaymentType(payment?.[field]);
    if (resolved) return resolved;
  }
  return '';
}

export function getPaymentRecordTypeValue(payment) {
  let firstValue = '';
  for (const field of PAYMENT_TYPE_FIELDS) {
    const value = String(payment?.[field] || '').trim();
    if (!value) continue;
    if (resolvePaymentType(value)) return value;
    if (!firstValue && field !== 'type') firstValue = value;
  }
  return firstValue;
}

export function normalizePaymentType(type) {
  return resolvePaymentType(type) || 'dealer_collection';
}

export function isDealerCollection(payment) {
  const resolvedType = resolvePaymentRecordType(payment);
  const type = resolvedType || (!getPaymentRecordTypeValue(payment)
    ? 'dealer_collection'
    : '');
  return type === 'dealer_collection' || type === 'office_payment';
}

export function isDealerBalanceCredit(payment) {
  const resolvedType = resolvePaymentRecordType(payment);
  const type = resolvedType || (!getPaymentRecordTypeValue(payment)
    ? 'dealer_collection'
    : '');
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
