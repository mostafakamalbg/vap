import {
  getPackageQuantityUnit,
  getStockInPieceQuantity
} from './quantityUnits.js';
import { STOCK_RECONCILIATION_START_DATE } from './stockReconciliation.js';
import { normalizeProductDisplayNames } from './productNames.js';

function getVariantKey(entry) {
  return `${entry.productId}::${entry.sku}`;
}

function getEntryId(entry) {
  return String(entry?.id || entry?.recordId || '');
}

function normalizeEntry(entry) {
  const normalized = { ...entry };
  delete normalized.recordUpdatedAt;
  return normalizeProductDisplayNames(normalized);
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => (
      [key, normalizeValue(value[key])]
    )));
  }
  return value;
}

export function getStockInRevisionChanges(originalEntries = [], proposedEntries = []) {
  const originalById = new Map(originalEntries.map((entry) => [getEntryId(entry), entry]));
  const proposedById = new Map(proposedEntries.map((entry) => [getEntryId(entry), entry]));
  const ids = [...new Set([...originalById.keys(), ...proposedById.keys()])].filter(Boolean);

  return ids.flatMap((id) => {
    const oldEntry = originalById.get(id) || null;
    const newEntry = proposedById.get(id) || null;
    if (
      oldEntry
      && newEntry
      && JSON.stringify(normalizeValue(normalizeEntry(oldEntry)))
        === JSON.stringify(normalizeValue(normalizeEntry(newEntry)))
    ) {
      return [];
    }
    return [{ id, oldEntry, newEntry }];
  });
}

export function applyStockInRevisionChanges(currentEntries = [], changes = []) {
  const entriesById = new Map(currentEntries.map((entry) => [getEntryId(entry), entry]));
  for (const change of changes) {
    const id = String(change?.id || '');
    if (!id) continue;
    if (change.newEntry == null) {
      entriesById.delete(id);
    } else {
      entriesById.set(id, { ...change.newEntry, id });
    }
  }
  return [...entriesById.values()];
}

export function calculateStockInRevisionDeltas(
  originalEntries = [],
  proposedEntries = [],
  packPerBoxByVariant = {},
  startDate = STOCK_RECONCILIATION_START_DATE
) {
  const changes = new Map();
  const movements = [
    ...originalEntries.map((entry) => ({ entry, direction: -1 })),
    ...proposedEntries.map((entry) => ({ entry, direction: 1 }))
  ];

  for (const { entry, direction } of movements) {
    if (!entry || String(entry.date || '') < startDate) continue;
    const key = getVariantKey(entry);
    const change = changes.get(key) || {
      productId: String(entry.productId || ''),
      sku: String(entry.sku || ''),
      pieces: 0,
      packages: 0
    };
    const packPerBox = Number(packPerBoxByVariant[key] || entry.packPerBox) || 1;
    const pieces = getStockInPieceQuantity(entry, packPerBox);
    const quantityUnit = String(entry.quantityUnit || getPackageQuantityUnit(entry));
    change.pieces += pieces * direction;
    change.packages += (
      quantityUnit === 'কার্টুন'
        ? Number(entry.cartons ?? entry.quantity) || 0
        : pieces
    ) * direction;
    changes.set(key, change);
  }

  return [...changes.values()];
}
