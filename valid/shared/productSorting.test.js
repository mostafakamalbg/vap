import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareProductsByCode,
  normalizeProductCode,
  sortProductsByCode,
  sortProductItemsByInventory
} from './productSorting.js';

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

test('product items follow inventory product and variant order', () => {
  const products = [
    { id: 'p-10', code: '10', variants: [{ sku: 'large' }, { sku: 'small' }] },
    { id: 'p-2', code: '2', variants: [{ sku: 'first' }, { sku: 'second' }] }
  ];
  const items = [
    { productId: 'p-10', sku: 'small' },
    { productId: 'p-2', sku: 'second' },
    { productId: 'p-10', sku: 'large' },
    { productId: 'p-2', sku: 'first' }
  ];

  assert.deepEqual(
    sortProductItemsByInventory(items, products).map(({ productId, sku }) => [productId, sku]),
    [
      ['p-2', 'first'],
      ['p-2', 'second'],
      ['p-10', 'large'],
      ['p-10', 'small']
    ]
  );
});
