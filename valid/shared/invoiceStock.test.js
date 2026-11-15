import assert from 'node:assert/strict';
import test from 'node:test';
import { getInvoiceCartons, getItemCartons } from './invoiceCartons.js';
import { getInvoiceSalesAmount } from './invoiceTotals.js';
import { applyInvoiceStockChanges } from './invoiceStock.js';
import { getPackageQuantityUnit, getStockInQuantities } from './quantityUnits.js';
import { normalizeHotlineNumber } from './companyContact.js';
import { normalizeProductDisplayNames, REAL_HORMONE_SHORT_NAME } from './productNames.js';

test('legacy hotline values normalize to the current company number', () => {
  assert.equal(normalizeHotlineNumber('017-96791398'), '01713736320');
  assert.equal(normalizeHotlineNumber('০১৭৯৬৭৯১৩৯৮'), '01713736320');
  assert.equal(normalizeHotlineNumber('01700000000'), '01700000000');
});

test('legacy real hormone product names are shortened in product and invoice records', () => {
  const records = normalizeProductDisplayNames([
    { id: 'prod-25', name: 'রিয়েল হরমোন (প্যাকলোবিউট্রাজল ২৫% এসসি)' },
    { items: [{ productName: 'রিয়েল হরমোন (প্যাকলোবিউট্রাজল ২৫% এসসি)' }] }
  ]);
  assert.equal(records[0].name, REAL_HORMONE_SHORT_NAME);
  assert.equal(records[1].items[0].productName, REAL_HORMONE_SHORT_NAME);
});

test('invoice package units use bags for gypsum and magnesium', () => {
  assert.equal(getPackageQuantityUnit({ productName: 'জিপসাম', packPerBox: 1 }), 'বস্তা');
  assert.equal(getPackageQuantityUnit({ productName: 'Magnesium Sulphate', packPerBox: 20 }), 'বস্তা');
  assert.equal(getPackageQuantityUnit({ productName: 'মহা ম্যাগ', packPerBox: 20 }), 'বস্তা');
});

test('invoice package units use jars for five-liter products and cartons otherwise', () => {
  assert.equal(getPackageQuantityUnit({ productName: 'Product A', size: '5 L', packPerBox: 1 }), 'জার');
  assert.equal(getPackageQuantityUnit({ productName: 'Product A', size: '৫লিটার × ০১', packPerBox: 1 }), 'জার');
  assert.equal(getPackageQuantityUnit({ productName: 'Product B', size: '১০০ মিলি', packPerBox: 30 }), 'কার্টুন');
});

test('stock-in counts bags and jars directly while carton counts expand by pack size', () => {
  assert.deepEqual(getStockInQuantities({
    productName: 'মহাশক্তি প্লাস জিপসাম',
    size: '৫কেজি × ৬',
    packPerBox: 6,
    stock: 480,
    stockCartons: 80
  }, 4), {
    quantityUnit: 'বস্তা', cartons: 4, quantityPieces: 4, stock: 484, stockCartons: 80
  });
  assert.deepEqual(getStockInQuantities({
    productName: 'Product A', size: '৫লিটার × ০১', packPerBox: 1, stock: 10, stockCartons: 10
  }, 2), {
    quantityUnit: 'জার', cartons: 2, quantityPieces: 2, stock: 12, stockCartons: 12
  });
  assert.deepEqual(getStockInQuantities({
    productName: 'Product B', size: '১০০ মিলি × ১২', packPerBox: 12, stock: 24, stockCartons: 2
  }, 3), {
    quantityUnit: 'কার্টুন', cartons: 3, quantityPieces: 36, stock: 60, stockCartons: 5
  });
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

test('retail pieces contribute to carton equivalents while retaining exact piece quantity', () => {
  assert.equal(getItemCartons({ cartons: 2, retailPieces: 3, packPerBox: 12 }), 2.25);
  assert.equal(getInvoiceCartons({
    items: [{ cartons: 0, quantity: 0, retailPieces: 6, packPerBox: 12 }]
  }), 0.5);
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

test('retail-only invoice lines subtract exact pieces and fractional carton equivalents', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 2, stock: 24, packPerBox: 12 }]
  }];
  const updated = applyInvoiceStockChanges(products, null, {
    invoiceType: 'regular',
    items: [{
      productId: 'product-1',
      sku: 'sku-1',
      cartons: 0,
      quantity: 0,
      retailPieces: 3,
      totalPieces: 3,
      packPerBox: 12
    }]
  });

  assert.equal(updated[0].variants[0].stockCartons, 1.75);
  assert.equal(updated[0].variants[0].stock, 21);
});

test('dealer returns add good goods to depot stock and damaged goods to damage stock', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 10, stock: 120, damageStock: 3, packPerBox: 12 }]
  }];
  const updated = applyInvoiceStockChanges(products, null, {
    invoiceType: 'dealer_return',
    items: [
      { productId: 'product-1', sku: 'sku-1', cartons: 2, totalPieces: 24, stockCondition: 'good' },
      { productId: 'product-1', sku: 'sku-1', cartons: 1, totalPieces: 12, stockCondition: 'damaged' }
    ]
  });

  assert.equal(updated[0].variants[0].stockCartons, 12);
  assert.equal(updated[0].variants[0].stock, 144);
  assert.equal(updated[0].variants[0].damageStock, 15);
});

test('depot factory returns subtract good and damaged goods from their respective stocks', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 10, stock: 120, damageStock: 15, packPerBox: 12 }]
  }];
  const updated = applyInvoiceStockChanges(products, null, {
    invoiceType: 'depot_factory_return',
    items: [
      { productId: 'product-1', sku: 'sku-1', cartons: 1, totalPieces: 12, stockCondition: 'good' },
      { productId: 'product-1', sku: 'sku-1', cartons: 2, totalPieces: 24, stockCondition: 'damaged' }
    ]
  });

  assert.equal(updated[0].variants[0].stockCartons, 9);
  assert.equal(updated[0].variants[0].stock, 108);
  assert.equal(updated[0].variants[0].damageStock, -9);
});

test('editing a return reverses its previous stock movement before applying the replacement', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 12, stock: 144, damageStock: 0, packPerBox: 12 }]
  }];
  const updated = applyInvoiceStockChanges(products, {
    invoiceType: 'dealer_return',
    items: [{ productId: 'product-1', sku: 'sku-1', cartons: 2, totalPieces: 24, stockCondition: 'good' }]
  }, {
    invoiceType: 'depot_factory_return',
    items: [{ productId: 'product-1', sku: 'sku-1', cartons: 1, totalPieces: 12, stockCondition: 'damaged' }]
  });

  assert.equal(updated[0].variants[0].stockCartons, 10);
  assert.equal(updated[0].variants[0].stock, 120);
  assert.equal(updated[0].variants[0].damageStock, -12);
});
