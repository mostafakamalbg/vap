import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyStockInRevisionChanges,
  calculateStockInRevisionDeltas,
  getStockInRevisionChanges
} from './stockInRevisions.js';

test('revision changes include only modified, added, and removed rows', () => {
  const originalEntries = [
    { id: 'existing-1', productName: 'Product 1', cartons: 2 },
    { id: 'existing-2', productName: 'Product 2', cartons: 4 }
  ];
  const proposedEntries = [
    { id: 'existing-1', productName: 'Product 1', cartons: 3 },
    { id: 'new-1', productName: 'Product 3', cartons: 1 }
  ];

  assert.deepEqual(
    getStockInRevisionChanges(originalEntries, proposedEntries),
    [
      {
        id: 'existing-1',
        oldEntry: originalEntries[0],
        newEntry: proposedEntries[0]
      },
      { id: 'existing-2', oldEntry: originalEntries[1], newEntry: null },
      { id: 'new-1', oldEntry: null, newEntry: proposedEntries[1] }
    ]
  );
});

test('revision patch preserves untouched entries and applies additions/removals', () => {
  const untouched = { id: 'existing-2', productName: 'Product 2', cartons: 4 };
  const changes = [
    {
      id: 'existing-1',
      oldEntry: { id: 'existing-1', cartons: 2 },
      newEntry: { id: 'existing-1', cartons: 3 }
    },
    { id: 'removed-1', oldEntry: { id: 'removed-1' }, newEntry: null },
    { id: 'new-1', oldEntry: null, newEntry: { id: 'new-1', cartons: 1 } }
  ];

  assert.deepEqual(
    applyStockInRevisionChanges([
      { id: 'existing-1', cartons: 2 },
      untouched,
      { id: 'removed-1' }
    ], changes),
    [
      { id: 'existing-1', cartons: 3 },
      untouched,
      { id: 'new-1', cartons: 1 }
    ]
  );
});

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
