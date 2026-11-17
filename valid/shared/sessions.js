const currentYear = new Date().getFullYear();

const FIRST_SESSION_YEAR = 2025;
const FIRST_SESSION_HALF = 1;

export function getSessionOrder(session) {
  const value = String(session || '');
  const year = Number(value.match(/\b(20\d{2})\b/)?.[1]) || 0;
  const half = /জানুয়ারি|january/i.test(value) ? 0
    : /জুলাই|july/i.test(value) ? 1
      : -1;
  return year ? year * 2 + half : 0;
}

export function isCurrentSession(session) {
  return getSessionOrder(session) >= FIRST_SESSION_YEAR * 2 + FIRST_SESSION_HALF;
}

export function sortSessionsNewestFirst(sessions) {
  return [...new Set(sessions.filter(Boolean))]
    .sort((left, right) => getSessionOrder(right) - getSessionOrder(left)
      || String(right).localeCompare(String(left)));
}

export const INVOICE_SESSIONS = Array.from({ length: currentYear + 6 - FIRST_SESSION_YEAR }, (_, index) => (
  currentYear + 5 - index
)).flatMap((year) => [
  `জুলাই - ডিসেম্বর ${year}`,
  ...(year > FIRST_SESSION_YEAR ? [`জানুয়ারি - জুন ${year}`] : [])
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
