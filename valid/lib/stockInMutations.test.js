import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertStockInChallanSnapshot,
  assertStockInSnapshot,
  createStockInChallanSnapshot
} from './stockInMutations.js';
import { REAL_HORMONE_SHORT_NAME } from '../shared/productNames.js';

test('stock-in snapshot ignores server timestamp changes when record data is unchanged', () => {
  const currentRecords = [{
    recordId: 'STK-IN-1',
    updatedAt: new Date('2026-11-27T00:00:00.000Z'),
    data: {
      id: 'STK-IN-1',
      date: '2026-11-26',
      cartons: 19,
      recordUpdatedAt: '2026-11-26T23:00:00.000Z'
    }
  }];
  const snapshots = [{
    id: 'STK-IN-1',
    date: '2026-11-26',
    cartons: 19,
    recordUpdatedAt: '2026-11-26T22:00:00.000Z'
  }];

  assert.doesNotThrow(() => assertStockInSnapshot(currentRecords, snapshots));
});

test('stock-in snapshot still rejects changed record contents', () => {
  const currentRecords = [{
    recordId: 'STK-IN-1',
    updatedAt: new Date('2026-11-27T00:00:00.000Z'),
    data: { id: 'STK-IN-1', date: '2026-11-26', cartons: 20 }
  }];
  const snapshots = [{
    id: 'STK-IN-1',
    date: '2026-11-26',
    cartons: 19,
    recordUpdatedAt: '2026-11-26T22:00:00.000Z'
  }];

  assert.throws(
    () => assertStockInSnapshot(currentRecords, snapshots),
    (error) => error.statusCode === 409
  );
});

test('stock-in snapshot fails closed when the caller provides no snapshot', () => {
  assert.throws(
    () => assertStockInSnapshot([{
      recordId: 'STK-IN-1',
      data: { id: 'STK-IN-1', cartons: 19 }
    }]),
    (error) => error.statusCode === 409
  );
});

test('stock-in snapshots accept legacy data IDs that differ from storage record IDs', () => {
  const currentRecords = [{
    recordId: 'legacy-storage-key',
    data: { id: 'legacy-display-key', cartons: 19 }
  }];
  const snapshots = [{
    id: 'legacy-display-key',
    cartons: 19
  }];

  assert.doesNotThrow(() => assertStockInSnapshot(currentRecords, snapshots));
});

test('compact challan snapshots validate all rows without storing unchanged product details', () => {
  const currentRecords = [
    { recordId: 'storage-1', data: { id: 'legacy-1', productName: 'Product 1', cartons: 2 } },
    { recordId: 'storage-2', data: { id: 'legacy-2', productName: 'Product 2', cartons: 4 } }
  ];
  const snapshot = createStockInChallanSnapshot(currentRecords);

  assert.equal(snapshot.length, currentRecords.length);
  assert.equal(Object.hasOwn(snapshot[1], 'data'), false);
  assert.doesNotThrow(() => assertStockInChallanSnapshot(currentRecords, snapshot));
  assert.throws(
    () => assertStockInChallanSnapshot([
      currentRecords[0],
      { ...currentRecords[1], data: { ...currentRecords[1].data, cartons: 5 } }
    ], snapshot),
    (error) => error.statusCode === 409
  );
});

test('stock-in snapshot allows display-name normalization without ignoring business changes', () => {
  const currentRecords = [{
    recordId: 'STK-IN-1',
    updatedAt: new Date('2026-11-27T00:00:00.000Z'),
    data: {
      id: 'STK-IN-1',
      productName: 'রিয়েল হরমোন (প্যাকলোবিউট্রাজল ২৫% এসসি)',
      cartons: 19
    }
  }];
  const snapshots = [{
    id: 'STK-IN-1',
    productName: REAL_HORMONE_SHORT_NAME,
    cartons: 19
  }];

  assert.doesNotThrow(() => assertStockInSnapshot(currentRecords, snapshots));
});
