import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStockInRevisionDeltas } from './stockInRevisions.js';

test('editing a challan applies only the old-to-new stock delta', () => {
  const [change] = calculateStockInRevisionDeltas(
    [{ productId: 'p1', sku: 's1', date: '2026-10-01', cartons: 2, quantityPieces: 60, quantityUnit: 'কার্টুন' }],
    [{ productId: 'p1', sku: 's1', date: '2026-10-01', cartons: 3, quantityPieces: 90, quantityUnit: 'কার্টুন' }]
  );

  assert.deepEqual(change, { productId: 'p1', sku: 's1', pieces: 30, packages: 1 });
});

test('group revisions aggregate additions, removals, and product changes by SKU', () => {
  const changes = calculateStockInRevisionDeltas(
    [
      { productId: 'p1', sku: 's1', date: '2026-10-01', cartons: 2, quantityPieces: 60, quantityUnit: 'কার্টুন' },
      { productId: 'p1', sku: 's1', date: '2026-10-01', cartons: 1, quantityPieces: 30, quantityUnit: 'কার্টুন' }
    ],
    [
      { productId: 'p1', sku: 's1', date: '2026-10-01', cartons: 1, quantityPieces: 30, quantityUnit: 'কার্টুন' },
      { productId: 'p2', sku: 's2', date: '2026-10-01', cartons: 4, quantityPieces: 4, quantityUnit: 'বস্তা' }
    ]
  );

  assert.deepEqual(changes, [
    { productId: 'p1', sku: 's1', pieces: -60, packages: -2 },
    { productId: 'p2', sku: 's2', pieces: 4, packages: 4 }
  ]);
});

test('stock-in before the reconciliation boundary does not change live stock', () => {
  assert.deepEqual(calculateStockInRevisionDeltas(
    [{ productId: 'p1', sku: 's1', date: '2026-09-29', cartons: 2, quantityPieces: 60 }],
    [{ productId: 'p1', sku: 's1', date: '2026-09-29', cartons: 3, quantityPieces: 90 }]
  ), []);
});
