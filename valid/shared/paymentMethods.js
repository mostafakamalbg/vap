export const PAYMENT_METHODS = [
  { value: 'cash', label: 'ক্যাশ (Cash)' },
  { value: 'credit', label: 'ক্রেডিট (Credit)' },
  { value: 'bank', label: 'ব্যাংক (Bank)' },
  { value: 'mobile_banking', label: 'মোবাইল ব্যাংকিং (Mobile Banking)' }
];

export function normalizePaymentMethod(method) {
  const value = String(method || '').trim().toLowerCase();
  if (value === 'credit' || value.includes('ক্রেডিট')) return 'credit';
  if (value === 'mobile_banking' || value.includes('মোবাইল') || value.includes('বিকাশ')) {
    return 'mobile_banking';
  }
  if (value === 'bank' || value.includes('ব্যাংক')) return 'bank';
  return 'cash';
}
