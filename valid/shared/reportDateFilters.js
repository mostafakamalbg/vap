const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

export function parseReportMonth(value) {
  const text = String(value || '').trim();
  let year;
  let month;
  let match = text.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
  } else {
    match = text.match(/^([a-z]+)\/(\d{2}|\d{4})$/i);
    if (!match) return null;
    month = MONTHS.indexOf(match[1].toLowerCase()) + 1;
    year = Number(match[2].length === 2 ? `20${match[2]}` : match[2]);
  }
  if (month < 1 || month > 12 || year < 1) return null;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  };
}

export function parseSessionDateRange(value) {
  const session = String(value || '')
    .replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const year = session.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return null;
  if (session.includes('জানু') || session.includes('january')) {
    return { start: `${year}-01-01`, end: `${year}-07-01` };
  }
  if (session.includes('জুলাই') || session.includes('july')) {
    return { start: `${year}-07-01`, end: `${Number(year) + 1}-01-01` };
  }
  return null;
}

export function dateRangeCondition(field, range) {
  return range ? { [field]: { $gte: range.start, $lt: range.end } } : null;
}

export function invoiceSessionCondition(value, dateField = 'date') {
  const session = String(value || '').trim();
  const range = parseSessionDateRange(session);
  if (!range) return { session };
  const year = range.start.slice(0, 4);
  const canonical = range.start.endsWith('-01-01')
    ? `জানুয়ারি - জুন ${year}`
    : `জুলাই - ডিসেম্বর ${year}`;
  return {
    $or: [
      { session },
      { session: canonical },
      dateRangeCondition(dateField, range)
    ]
  };
}
