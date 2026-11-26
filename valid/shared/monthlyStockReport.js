import { getInvoiceStockChanges } from './invoiceStock.js';
import { getPackageQuantityUnit, getStockPackageCount } from './quantityUnits.js';
import { sortProductItemsByInventory } from './productSorting.js';

function isInRange(date, range) {
  return String(date || '') >= range.start && String(date || '') < range.end;
}

function addMovement(totals, movement, invoiceType) {
  const packageChange = [...movement.values()].reduce((sum, item) => sum + item.cartons, 0);
  if (invoiceType === 'dealer_return') {
    totals.marketReturn += Math.max(0, packageChange);
  } else if (['factory_damage', 'depot_factory_return'].includes(invoiceType)) {
    totals.factoryReturn += Math.max(0, -packageChange);
  } else {
    totals.sales += Math.max(0, -packageChange);
  }
  totals.periodNet += packageChange;
}

export function calculateMonthlyStockReport({ products = [], invoices = [], stockInLogs = [], range }) {
  if (!range?.start || !range?.end || range.start >= range.end) {
    throw new Error('স্টক রিপোর্টের তারিখসীমা সঠিক নয়।');
  }

  const rows = [];
  products.forEach((product) => (product.variants || []).forEach((variant) => {
    const key = `${product.id}\u0000${variant.sku}`;
    const movement = {
      factoryReceive: 0,
      marketReturn: 0,
      factoryReturn: 0,
      sales: 0,
      periodNet: 0,
      futureNet: 0
    };

    stockInLogs.forEach((entry) => {
      if (`${entry.productId}\u0000${entry.sku}` !== key) return;
      const date = String(entry.date || '');
      const quantityUnit = entry.quantityUnit
        || getPackageQuantityUnit({
          ...entry,
          productName: entry.productName || product.name,
          generic: product.generic,
          size: entry.size || variant.size
        });
      if (quantityUnit === 'পিস') return;
      const packages = Math.trunc(Number(entry.cartons ?? entry.quantity) || 0);
      if (!packages) return;
      if (isInRange(date, range)) movement.factoryReceive += packages;
      else if (date >= range.end) movement.futureNet += packages;
    });

    invoices.forEach((invoice) => {
      const date = String(invoice.date || '');
      if (date < range.start) return;
      const changes = getInvoiceStockChanges(null, invoice);
      const invoiceMovement = new Map([...changes].filter(([, item]) => (
        `${item.productId}\u0000${item.sku}` === key
      )));
      if (!invoiceMovement.size) return;
      if (isInRange(date, range)) addMovement(movement, invoiceMovement, invoice.invoiceType);
      else if (date >= range.end) {
        movement.futureNet += [...invoiceMovement.values()]
          .reduce((sum, item) => sum + item.cartons, 0);
      }
    });

    const currentStock = getStockPackageCount({
      ...variant,
      productName: product.name,
      generic: product.generic
    });
    const netStock = currentStock - movement.futureNet;
    const lastMonthStock = netStock - movement.periodNet
      - movement.factoryReceive;
    const totalStock = lastMonthStock + movement.factoryReceive + movement.marketReturn;
    const calculatedNetStock = totalStock - movement.factoryReturn - movement.sales;
    rows.push({
      productId: product.id,
      productCode: product.productCode || product.code || product.id,
      productName: product.name || 'পণ্য',
      sku: variant.sku,
      packSize: variant.size || '—',
      quantityUnit: getPackageQuantityUnit({
        ...variant,
        productName: product.name,
        generic: product.generic
      }),
      lastMonthStock,
      factoryReceive: movement.factoryReceive,
      marketReturn: movement.marketReturn,
      totalStock,
      factoryReturn: movement.factoryReturn,
      sales: movement.sales,
      netStock: calculatedNetStock
    });
  }));

  return sortProductItemsByInventory(rows, products);
}

export function sumMonthlyStockReport(rows = []) {
  return rows.reduce((totals, row) => {
    Object.keys(totals).forEach((field) => { totals[field] += Number(row[field]) || 0; });
    return totals;
  }, {
    lastMonthStock: 0,
    factoryReceive: 0,
    marketReturn: 0,
    totalStock: 0,
    factoryReturn: 0,
    sales: 0,
    netStock: 0
  });
}
