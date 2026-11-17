import assert from 'node:assert/strict';
import test from 'node:test';
import { getInvoicePackageCount } from './invoiceCartons.js';

test('carton totals count whole cartons and exclude fractional retail pieces', () => {
  const count = getInvoicePackageCount({
    items: [
      { cartons: 10, retailPieces: 5, packPerBox: 10 },
      { cartons: 2, retailPieces: 3, packPerBox: 12 }
    ]
  });

  assert.equal(count, 12);
  assert.equal(Number.isInteger(count), true);
});
