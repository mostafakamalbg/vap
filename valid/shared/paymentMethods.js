export const PAYMENT_METHODS = [
  { value: 'cash', label: 'ক্যাশ (Cash)' },
  { value: 'credit', label: 'ক্রেডিট (Credit)' },
  { value: 'bank', label: 'ব্যাংক (Bank)' },
  { value: 'mobile_banking', label: 'মোবাইল ব্যাংকিং (Mobile Banking)' }
];

export const PAYMENT_TYPES = [
  { value: 'dealer_collection', label: 'ডিলার কালেকশন' },
  { value: 'company_transfer', label: 'কোম্পানিতে টাকা পাঠানো' },
  { value: 'salary', label: 'বেতন' },
  { value: 'vehicle_rent', label: 'গাড়ি ভাড়া' },
  { value: 'lc_commission', label: 'লেস কমিশন (LC)' }
];

export function normalizePaymentType(type) {
  const value = String(type || '').trim().toLowerCase();
  return PAYMENT_TYPES.some((entry) => entry.value === value)
    ? value
    : 'dealer_collection';
}

export function isDealerCollection(payment) {
  const type = String(payment?.paymentType || '');
  return !type || type === 'dealer_collection' || type === 'company_transfer';
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
