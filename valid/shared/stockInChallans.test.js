import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStockInChallanNumber,
  groupStockInEntries
} from './stockInChallans.js';

test('legacy challan aliases are shown and grouped by challan plus date', () => {
  const groups = groupStockInEntries([
    { id: 'one', date: '2026-10-01', challanNumber: 'CH-10', cartons: 2 },
    { id: 'two', date: '2026-10-01', voucherNo: 'CH-10', cartons: 3 },
    { id: 'three', date: '2026-10-02', invoiceNo: 'CH-10', cartons: 1 }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].displayChallanNo, 'CH-10');
  assert.equal(groups[0].totalProducts, 1);
  assert.equal(groups[1].totalProducts, 2);
  assert.equal(groups[1].totalCartons, 5);
});

test('missing legacy challan numbers receive a stable display fallback without changing records', () => {
  const entry = { id: 'STK-IN-LEGACY-1', date: '2026-10-01', batchNo: 'BAT-26-123' };
  const group = groupStockInEntries([entry])[0];

  assert.equal(getStockInChallanNumber(entry), '');
  assert.equal(group.displayChallanNo, 'STK-IN-BAT-26-123');
  assert.equal(entry.challanNo, undefined);
});

test('active and soft-deleted lines retain one challan history group', () => {
  const [group] = groupStockInEntries([
    { id: 'one', date: '2026-10-01', challanNo: 'CH-10', cartons: 2 },
    { id: 'two', date: '2026-10-01', challanNo: 'CH-10', cartons: 3, deletedAt: '2026-10-02' }
  ]);

  assert.equal(group.status, 'partial');
  assert.equal(group.activeEntries.length, 1);
  assert.equal(group.deletedEntries.length, 1);
  assert.equal(group.totalProducts, 2);
  assert.equal(group.totalCartons, 5);
  assert.equal(group.activeCartons, 2);
});
