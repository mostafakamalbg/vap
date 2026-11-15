import assert from 'node:assert/strict';
import test from 'node:test';
import { getInvoiceCartons, getItemCartons } from './invoiceCartons.js';
import { getInvoiceItemAmounts, getInvoiceSalesAmount } from './invoiceTotals.js';
import { sortInvoiceItems } from './invoiceSorting.js';
import { getDealerLedgerTransactions, getDealerNetDue } from './dealerLedger.js';
import { applyInvoiceStockChanges } from './invoiceStock.js';
import {
  getInvoiceQuantityParts,
  getPackageQuantityUnit,
  getStockInQuantities,
  getStockCartonEquivalent
} from './quantityUnits.js';
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

test('invoice print quantities omit carton and jar labels but mark piece quantities', () => {
  assert.deepEqual(getInvoiceQuantityParts({
    unitType: 'carton',
    cartons: 6,
    size: '১০০ মিলি × ৩০',
    packPerBox: 30
  }), [{ quantity: 6, unit: '' }]);
  assert.deepEqual(getInvoiceQuantityParts({
    unitType: 'carton',
    cartons: 1,
    size: '৫লিটার × ০১',
    packPerBox: 1
  }), [{ quantity: 1, unit: '' }]);
  assert.deepEqual(getInvoiceQuantityParts({
    unitType: 'piece',
    cartons: 0,
    retailPieces: 28,
    unit: 'বোতল'
  }), [{ quantity: 28, unit: 'পিস' }]);
  assert.deepEqual(getInvoiceQuantityParts({
    cartons: 0,
    retailPieces: 28,
    unit: 'বোতল'
  }), [{ quantity: 28, unit: 'পিস' }]);
});

test('invoice items sort by internal product ID then descending size capacity', () => {
  const sortedItems = sortInvoiceItems([
    { productId: 'prod-02', sku: 'B', size: '৫০০মিলি × ১০' },
    { productId: 'prod-02', sku: 'A', size: '১লিঃ × ১২' },
    { productId: 'prod-01', sku: 'Z', size: '৫০গ্রাম × ৪৮' },
    { productId: 'prod-01', sku: 'A', size: '১০০গ্রাম × ২৪' },
    { productId: 'prod-01', sku: 'B', size: '১কেজি × ১০' }
  ]);

  assert.deepEqual(sortedItems.map(({ productId, size }) => [productId, size]), [
    ['prod-01', '১কেজি × ১০'],
    ['prod-01', '১০০গ্রাম × ২৪'],
    ['prod-01', '৫০গ্রাম × ৪৮'],
    ['prod-02', '১লিঃ × ১২'],
    ['prod-02', '৫০০মিলি × ১০']
  ]);
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

test('stock-in preview converts jar and bag quantities to carton equivalents', () => {
  const currentCartons = getStockCartonEquivalent({
    productName: 'Product B', size: '১০০ মিলি × ১২', packPerBox: 12, stock: 5676, stockCartons: 473
  });
  const incomingJars = getStockCartonEquivalent({
    productName: 'Product A', size: '৫লিটার × ০১', packPerBox: 1
  }, 10);
  const incomingBags = getStockCartonEquivalent({
    productName: 'জিপসাম', size: '৫কেজি × ৬', packPerBox: 6
  }, 4);

  assert.equal(currentCartons + incomingJars, 483);
  assert.equal(incomingBags, 4 / 6);
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

test('dealer returns preserve negative balances as dealer advances', () => {
  assert.equal(getDealerNetDue({
    openingDue: 0,
    totalBillAmount: 0,
    totalReturnAmount: 5000,
    totalPaidAmount: 0,
    damageCredits: 0
  }), -5000);
  assert.equal(getDealerNetDue({
    openingDue: 10000,
    totalBillAmount: 3000,
    totalReturnAmount: 5000,
    totalPaidAmount: 2000,
    damageCredits: 500
  }), 5500);
});

test('dealer ledger transactions apply return and payment credits with a running balance', () => {
  const transactions = getDealerLedgerTransactions({
    openingDue: 100,
    invoices: [
      { id: 'return', date: '2026-01-03', invoiceType: 'dealer_return', grandTotal: -40 },
      { id: 'sale', date: '2026-01-01', invoiceType: 'regular', grandTotal: 100 },
      { id: 'credit-note', date: '2026-01-02', invoiceType: 'credit_note', grandTotal: -5 },
      { id: 'factory-return', date: '2026-01-04', invoiceType: 'depot_factory_return', grandTotal: 15 }
    ],
    payments: [{ id: 'payment', date: '2026-01-02', amount: 20 }],
    damages: [{
      id: 'damage-credit',
      date: '2026-01-03',
      actionType: 'ledger_credit',
      totalDamageValue: 10
    }]
  });

  assert.deepEqual(transactions.map(({ sourceType, debit, credit, balance }) => (
    { sourceType, debit, credit, balance }
  )), [
    { sourceType: 'opening', debit: 100, credit: 0, balance: 100 },
    { sourceType: 'invoice', debit: 100, credit: 0, balance: 200 },
    { sourceType: 'invoice', debit: 0, credit: 5, balance: 195 },
    { sourceType: 'payment', debit: 0, credit: 20, balance: 175 },
    { sourceType: 'invoice', debit: 0, credit: 40, balance: 135 },
    { sourceType: 'damage', debit: 0, credit: 10, balance: 125 }
  ]);
});

test('carton and piece invoice lines calculate commission and net totals independently', () => {
  assert.deepEqual(getInvoiceItemAmounts({
    cartons: 3,
    retailPieces: 0,
    packPerBox: 12,
    cartonPrice: 1200,
    piecePrice: 100,
    commission: 20
  }), {
    cartons: 3,
    retailPieces: 0,
    totalPieces: 36,
    total: 3600,
    commissionAmount: 720,
    netTotal: 2880
  });
  assert.deepEqual(getInvoiceItemAmounts({
    cartons: 0,
    retailPieces: 5,
    packPerBox: 12,
    cartonPrice: 1200,
    piecePrice: 100,
    commission: 20
  }), {
    cartons: 0,
    retailPieces: 5,
    totalPieces: 5,
    total: 500,
    commissionAmount: 100,
    netTotal: 400
  });
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
      unitType: 'carton',
      totalPieces: 24
    }]
  });

  assert.equal(updated[0].variants[0].stockCartons, -2);
  assert.equal(updated[0].variants[0].stock, -18);
});

test('piece-only invoice lines do not change stock for any invoice type', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 2, stock: 24, damageStock: 5, packPerBox: 12 }]
  }];
  ['regular', 'dealer_return', 'depot_factory_return'].forEach((invoiceType) => {
    const updated = applyInvoiceStockChanges(products, null, {
      invoiceType,
      items: [{
        productId: 'product-1',
        sku: 'sku-1',
        cartons: 0,
        quantity: 0,
        retailPieces: 3,
        totalPieces: 3,
        unitType: 'piece',
        packPerBox: 12,
        stockCondition: 'damaged'
      }, {
        productId: 'product-1',
        sku: 'sku-1',
        cartons: 0,
        retailPieces: 2,
        totalPieces: 2,
        packPerBox: 12,
        stockCondition: 'damaged'
      }]
    });

    assert.deepEqual(updated, products);
  });
});

test('dealer returns add good goods to depot stock and damaged goods to damage stock', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 10, stock: 120, damageStock: 3, packPerBox: 12 }]
  }];
  const updated = applyInvoiceStockChanges(products, null, {
    invoiceType: 'dealer_return',
    items: [
      { productId: 'product-1', sku: 'sku-1', cartons: 2, totalPieces: 24, unitType: 'carton', stockCondition: 'good' },
      { productId: 'product-1', sku: 'sku-1', cartons: 1, totalPieces: 12, unitType: 'carton', stockCondition: 'damaged' }
    ]
  });

  assert.equal(updated[0].variants[0].stockCartons, 12);
  assert.equal(updated[0].variants[0].stock, 144);
  assert.equal(updated[0].variants[0].damageStock, 15);
});

test('piece dealer returns do not change physical stock', () => {
  const products = [{
    id: 'product-1',
    variants: [{ sku: 'sku-1', stockCartons: 1, stock: 12, damageStock: 2, packPerBox: 12 }]
  }];
  const updated = applyInvoiceStockChanges(products, null, {
    invoiceType: 'dealer_return',
    items: [
      { productId: 'product-1', sku: 'sku-1', cartons: 0, retailPieces: 3, totalPieces: 3, unitType: 'piece', packPerBox: 12, stockCondition: 'good' },
      { productId: 'product-1', sku: 'sku-1', cartons: 0, retailPieces: 2, totalPieces: 2, unitType: 'piece', packPerBox: 12, stockCondition: 'damaged' }
    ]
  });

  assert.deepEqual(updated, products);
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
