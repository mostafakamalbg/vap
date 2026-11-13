import assert from 'node:assert/strict';
import test from 'node:test';
import { getInvoiceCartons } from './invoiceCartons.js';
import { getInvoiceSalesAmount } from './invoiceTotals.js';
import { applyInvoiceStockChanges } from './invoiceStock.js';
import { getPackageQuantityUnit } from './quantityUnits.js';
import { normalizeHotlineNumber } from './companyContact.js';

test('legacy hotline values normalize to the current company number', () => {
  assert.equal(normalizeHotlineNumber('017-96791398'), '01713736320');
  assert.equal(normalizeHotlineNumber('০১৭৯৬৭৯১৩৯৮'), '01713736320');
  assert.equal(normalizeHotlineNumber('01700000000'), '01700000000');
});

test('invoice package units use bags for gypsum and magnesium', () => {
  assert.equal(getPackageQuantityUnit({ productName: 'জিপসাম', packPerBox: 1 }), 'বস্তা');
  assert.equal(getPackageQuantityUnit({ productName: 'Magnesium Sulphate', packPerBox: 20 }), 'বস্তা');
});

test('invoice package units use jars for five-liter products and cartons otherwise', () => {
  assert.equal(getPackageQuantityUnit({ productName: 'Product A', size: '5 L', packPerBox: 1 }), 'জার');
  assert.equal(getPackageQuantityUnit({ productName: 'Product B', size: '১০০ মিলি', packPerBox: 30 }), 'কার্টুন');
});

test('invoice carton totals fall back to item quantities when the stored total is missing or zero', () => {
  assert.equal(getInvoiceCartons({
    totalCartons: 0,
    items: [
      { cartons: 2 },
      { quantity: 3 },
      { totalPieces: 24, packPerBox: 12 }
    ]
  }), 7);
});

test('invoice sales totals fall back to totalAmount when grandTotal is zero', () => {
  assert.equal(getInvoiceSalesAmount({ grandTotal: 0, totalAmount: 125 }), 125);
});

test('invoice stock changes preserve negative carton and piece balances', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 0, stock: 6, packPerBox: 12 }]
  }];
  const updated = applyInvoiceStockChanges(products, null, {
    invoiceType: 'regular',
    items: [{
      productId: 'product-1',
      sku: 'sku-1',
      cartons: 2,
      totalPieces: 24
    }]
  });

  assert.equal(updated[0].variants[0].stockCartons, -2);
  assert.equal(updated[0].variants[0].stock, -18);
});
