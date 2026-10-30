// Bengali Number, Currency, and Date Formatting Helpers
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/**
 * Converts any number or string with digits to Bengali numerals
 * Example: toBn('VAP-2026-0005') => 'VAP-২০২৬-০০০৫'
 * Example: toBn(15) => '১৫'
 */
export function toBn(val) {
  if (val === null || val === undefined || val === '') return '';
  return String(val).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/**
 * Formats a currency number with commas in Bengali numerals
 * Example: toBnCurrency(150000) => '১,৫০,০০০'
 */
export function toBnCurrency(val) {
  if (val === null || val === undefined || val === '') return '০';
  const num = Math.round(Number(val) || 0);
  try {
    return num.toLocaleString('bn-BD');
  } catch (e) {
    const formatted = num.toLocaleString('en-US');
    return toBn(formatted);
  }
}

/**
 * Formats a date string (YYYY-MM-DD) to standard Bangladeshi date (DD-MM-YYYY) in Bengali digits
 * Example: toBnDate('2026-10-30') => '৩০-১০-২০২৬'
 */
export function toBnDate(val) {
  if (!val) return '';
  const parts = String(val).split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return toBn(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  return toBn(val);
}
