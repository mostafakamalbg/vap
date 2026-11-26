import {
  getPackageQuantityUnit,
  getStockInPieceQuantity
} from './quantityUnits.js';
import { STOCK_RECONCILIATION_START_DATE } from './stockReconciliation.js';

function getVariantKey(entry) {
  return `${entry.productId}::${entry.sku}`;
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
