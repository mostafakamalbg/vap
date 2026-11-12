const currentYear = new Date().getFullYear();

export const INVOICE_SESSIONS = Array.from({ length: currentYear + 6 - 2020 }, (_, index) => (
  2020 + index
)).flatMap((year) => [
  `জানুয়ারি - জুন ${year}`,
  `জুলাই - ডিসেম্বর ${year}`
]);

export const LEGACY_INVOICE_SESSION = 'সেশন নির্ধারিত নয়';

export function getInvoiceSessionForDate(date) {
  const match = String(date || '').match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return '';
  return Number(match[2]) <= 6
    ? `জানুয়ারি - জুন ${match[1]}`
    : `জুলাই - ডিসেম্বর ${match[1]}`;
}

export function getBangladeshBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
