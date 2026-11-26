import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMonthlyStockReport, sumMonthlyStockReport } from './monthlyStockReport.js';

test('monthly stock report computes opening stock and all requested movement categories', () => {
  const products = [{
    id: 'p1',
    name: 'Crop Guard',
    variants: [{
      sku: 's1',
      size: '১০০ মিলি',
      packPerBox: 10,
      stock: 290,
      stockCartons: 29
    }]
  }];
  const invoices = [
    { date: '2026-10-04', invoiceType: 'dealer_return', items: [{ productId: 'p1', sku: 's1', cartons: 2, packPerBox: 10 }] },
    { date: '2026-10-06', invoiceType: 'regular', items: [{ productId: 'p1', sku: 's1', cartons: 3, packPerBox: 10 }] },
    { date: '2026-10-08', invoiceType: 'depot_factory_return', items: [{ productId: 'p1', sku: 's1', cartons: 1, packPerBox: 10 }] },
    { date: '2026-11-02', invoiceType: 'regular', items: [{ productId: 'p1', sku: 's1', cartons: 4, packPerBox: 10 }] }
  ];
  const stockInLogs = [
    { date: '2026-10-01', productId: 'p1', sku: 's1', cartons: 10, quantityUnit: 'কার্টুন' },
    { date: '2026-11-01', productId: 'p1', sku: 's1', cartons: 5, quantityUnit: 'কার্টুন' },
    { date: '2026-10-15', productId: 'p1', sku: 's1', cartons: 99, quantityUnit: 'কার্টুন', deletedAt: '2026-10-16T00:00:00.000Z' }
  ];

  const rows = calculateMonthlyStockReport({
    products,
    invoices,
    stockInLogs,
    range: { start: '2026-10-01', end: '2026-11-01' }
  });

  assert.deepEqual(rows[0], {
    productId: 'p1',
    productCode: 'p1',
    productName: 'Crop Guard',
    sku: 's1',
    packSize: '১০০ মিলি',
    quantityUnit: 'কার্টুন',
    lastMonthStock: 20,
    factoryReceive: 10,
    marketReturn: 2,
    totalStock: 32,
    factoryReturn: 1,
    sales: 3,
    netStock: 28
  });
  assert.deepEqual(sumMonthlyStockReport(rows), {
    lastMonthStock: 20,
    factoryReceive: 10,
    marketReturn: 2,
    totalStock: 32,
    factoryReturn: 1,
    sales: 3,
    netStock: 28
  });
});

test('monthly stock report follows inventory product and variant order', () => {
  const rows = calculateMonthlyStockReport({
    products: [
      {
        id: 'prod-10',
        code: '10',
        name: 'Ten',
        variants: [{ sku: 'second' }, { sku: 'first' }]
      },
      {
        id: 'prod-2',
        code: '2',
        name: 'Two',
        variants: [{ sku: 'large' }, { sku: 'small' }]
      }
    ],
    range: { start: '2026-10-01', end: '2026-11-01' }
  });

  assert.deepEqual(rows.map(({ productId, sku }) => [productId, sku]), [
    ['prod-2', 'large'],
    ['prod-2', 'small'],
    ['prod-10', 'second'],
    ['prod-10', 'first']
  ]);
});

test('all-period stock report keeps factory receipts separate from opening stock', () => {
  const rows = calculateMonthlyStockReport({
    products: [{
      id: 'p1',
      productCode: 'AG-02',
      name: 'Crop Guard',
      variants: [{ sku: 's1', size: '১০০ মিলি', packPerBox: 10, stock: 290, stockCartons: 29 }]
    }],
    invoices: [
      { date: '2026-10-04', invoiceType: 'dealer_return', items: [{ productId: 'p1', sku: 's1', cartons: 2, packPerBox: 10 }] },
      { date: '2026-10-06', invoiceType: 'regular', items: [{ productId: 'p1', sku: 's1', cartons: 3, packPerBox: 10 }] },
      { date: '2026-10-08', invoiceType: 'depot_factory_return', items: [{ productId: 'p1', sku: 's1', cartons: 1, packPerBox: 10 }] },
      { date: '2026-11-02', invoiceType: 'regular', items: [{ productId: 'p1', sku: 's1', cartons: 4, packPerBox: 10 }] }
    ],
    stockInLogs: [
      { date: '2026-10-01', productId: 'p1', sku: 's1', cartons: 10, quantityUnit: 'কার্টুন' },
      { date: '2026-11-01', productId: 'p1', sku: 's1', cartons: 5, quantityUnit: 'কার্টুন' }
    ],
    range: { start: '0001-01-01', end: '9999-12-31' }
  });

  assert.equal(rows[0].productCode, 'AG-02');
  assert.equal(rows[0].lastMonthStock, 20);
  assert.equal(rows[0].factoryReceive, 15);
  assert.equal(rows[0].marketReturn, 2);
  assert.equal(rows[0].sales, 7);
  assert.equal(rows[0].factoryReturn, 1);
  assert.equal(rows[0].netStock, 29);
});
