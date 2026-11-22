import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInvoiceTotals, getInvoiceSalesAmount, roundCurrency } from './invoiceTotals.js';

test('invoice calculations subtract returns and round currencies to whole units', () => {
  const result = calculateInvoiceTotals({
    items: [{ cartons: 1, cartonPrice: 15800, commission: 0 }],
    returnAdjustments: [{ quantity: 1, price: 6420 }]
  });

  assert.equal(result.totalAmount, 9380);
  assert.equal(result.returnAdjustmentTotal, 6420);
  assert.equal(roundCurrency(15.7), 16);
});

test('legacy invoice line totals derive net sales after return deduction', () => {
  assert.equal(getInvoiceSalesAmount({
    items: [{ cartons: 1, cartonPrice: 15800 }],
    returnAdjustments: [{ quantity: 1, price: 6420, total: 6420 }]
  }), 9380);
});
