import assert from 'node:assert/strict';
import test from 'node:test';
import { compareProductsByCode, normalizeProductCode, sortProductsByCode } from './productSorting.js';

test('product codes sort naturally without losing numeric values', () => {
  assert.deepEqual(
    sortProductsByCode([
      { id: 'prod-10', productCode: 'P-10', name: 'Ten' },
      { id: 'prod-2', productCode: 'P-2', name: 'Two' },
      { id: 'prod-1', productCode: 'P-1', name: 'One' }
    ]).map(normalizeProductCode),
    ['P-1', 'P-2', 'P-10']
  );
  assert.deepEqual(
    sortProductsByCode([
      { id: '010', name: 'Ten' },
      { id: '002', name: 'Two' },
      { id: '001', name: 'One' }
    ]).map(normalizeProductCode),
    ['001', '002', '010']
  );
});

test('product code comparison is deterministic for missing and legacy codes', () => {
  assert.equal(compareProductsByCode(
    { id: 'P-1', name: 'One' },
    { id: 'P-10', name: 'Ten' }
  ) < 0, true);
  assert.equal(normalizeProductCode({ code: ' 003 ' }), '003');
});
