import { getInvoiceSessionForDate } from './sessions.js';

const CHALLAN_FIELDS = [
  'challanNo',
  'challanNumber',
  'invoiceNo',
  'voucherNo',
  'referenceId',
  'referenceNo',
  'referenceID',
  'refId'
];

function usableValue(value) {
  const text = String(value ?? '').trim();
  return text && !['-', 'n/a', 'na', 'null', 'undefined'].includes(text.toLowerCase())
    ? text
    : '';
}

export function getStockInChallanNumber(entry) {
  for (const field of CHALLAN_FIELDS) {
    const value = usableValue(entry?.[field]);
    if (value) return value;
  }
  return '';
}

export function getStockInChallanKey(entry) {
  const date = usableValue(entry?.date) || 'no-date';
  const challan = getStockInChallanNumber(entry);
  if (challan) return `${date}|challan|${challan.toLowerCase()}`;

  const batch = usableValue(entry?.batchNo);
  if (batch) return `${date}|batch|${batch.toLowerCase()}`;

  const id = usableValue(entry?.id || entry?._id);
  return `${date}|entry|${id || 'legacy-entry'}`;
}

function getFallbackChallanNumber(entry) {
  const batch = usableValue(entry?.batchNo);
  const id = usableValue(entry?.id || entry?._id);
  const reference = batch || id || String(entry?.date || 'legacy').replace(/-/g, '');
  return reference.toUpperCase().startsWith('STK-IN-')
    ? reference
    : `STK-IN-${reference}`;
}

export function groupStockInEntries(entries = []) {
  const groups = new Map();
  entries.forEach((entry, index) => {
    const key = getStockInChallanKey({
      ...entry,
      id: entry?.id || entry?._id || `legacy-${index}`
    });
    const group = groups.get(key) || {
      key,
      entries: [],
      activeEntries: [],
      deletedEntries: [],
      challanNo: getStockInChallanNumber(entry),
      date: String(entry?.date || ''),
      session: String(entry?.session || getInvoiceSessionForDate(entry?.date) || ''),
      source: String(entry?.source || ''),
      batchNo: String(entry?.batchNo || ''),
      receivedBy: String(entry?.receivedBy || '')
    };
    group.entries.push(entry);
    if (entry?.deletedAt) group.deletedEntries.push(entry);
    else group.activeEntries.push(entry);
    groups.set(key, group);
  });

  return [...groups.values()].map((group) => {
    const displayEntry = group.activeEntries[0] || group.entries[0];
    return {
      ...group,
      displayChallanNo: group.challanNo || getFallbackChallanNumber(displayEntry),
      totalProducts: group.entries.length,
      activeProducts: group.activeEntries.length,
      totalCartons: group.entries.reduce((sum, entry) => (
        sum + (Number(entry.cartons ?? entry.quantity) || 0)
      ), 0),
      activeCartons: group.activeEntries.reduce((sum, entry) => (
        sum + (Number(entry.cartons ?? entry.quantity) || 0)
      ), 0),
      status: group.activeEntries.length
        ? group.deletedEntries.length ? 'partial' : 'active'
        : 'deleted'
    };
  }).sort((left, right) => (
    String(right.date || '').localeCompare(String(left.date || ''))
    || String(right.displayChallanNo || '').localeCompare(String(left.displayChallanNo || ''))
  ));
}
