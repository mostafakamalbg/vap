const REAL_HORMONE_NAMES = new Set([
  'রিয়েল হরমোন (প্যাকলোবিউট্রাজল ২৫% এসসি)',
  'রিয়েল হরমোন (প্যাকলোবিউট্রাজল ২৫% এসসি)'
]);

export const REAL_HORMONE_SHORT_NAME = 'রিয়েল হরমোন প্যা: ২৫% এসসি';

export function normalizeProductDisplayNames(records) {
  if (Array.isArray(records)) return records.map(normalizeProductDisplayNames);
  if (!records || typeof records !== 'object') return records;

  return Object.fromEntries(Object.entries(records).map(([key, value]) => {
    if ((key === 'name' || key === 'productName') && REAL_HORMONE_NAMES.has(value)) {
      return [key, REAL_HORMONE_SHORT_NAME];
    }
    return [key, normalizeProductDisplayNames(value)];
  }));
}
