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
    { date: '2026-11-01', productId: 'p1', sku: 's1', cartons: 5, quantityUnit: 'কার্টুন' }
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
