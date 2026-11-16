import { getInvoiceStockChanges } from './invoiceStock.js';
import { getPackageQuantityUnit } from './quantityUnits.js';

export const STOCK_RECONCILIATION_START_DATE = '2026-09-30';

const isValidDate = (date) => (
  typeof date === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && !Number.isNaN(new Date(`${date}T00:00:00.000Z`).valueOf())
  && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date
);

function getVariantKey(productId, sku) {
  return `${productId}\u0000${sku}`;
}

function getPackageCount(value) {
  return Math.trunc(Number(value) || 0);
}

export function rebuildStockBalances(products, invoices, stockInLogs, startDate = STOCK_RECONCILIATION_START_DATE) {
  if (!isValidDate(startDate)) throw new Error('স্টক পুনর্গণনার শুরুর তারিখ সঠিক নয়।');

  const balances = new Map();
  const productsById = new Map();
  (products || []).forEach((product) => {
    productsById.set(String(product.id), product);
    (product.variants || []).forEach((variant) => {
      balances.set(getVariantKey(product.id, variant.sku), {
        productId: String(product.id),
        sku: String(variant.sku),
        packages: 0,
        units: 0,
        damageUnits: 0
      });
    });
  });

  const addBalance = (productId, sku, movement, reference) => {
    const key = getVariantKey(productId, sku);
    const balance = balances.get(key);
    if (!balance) {
      throw new Error(`স্টক লেনদেন ${reference} -এ পণ্য/SKU ${productId}/${sku} পাওয়া যায়নি।`);
    }
    balance.packages += getPackageCount(movement.packages);
    balance.units += getPackageCount(movement.units);
    balance.damageUnits += getPackageCount(movement.damageUnits);
    if (![balance.packages, balance.units, balance.damageUnits].every(Number.isSafeInteger)) {
      throw new Error(`স্টক লেনদেন ${reference}-এ পরিমাণ নিরাপদ পূর্ণসংখ্যার সীমা ছাড়িয়েছে।`);
    }
  };

  let stockInCount = 0;
  for (const entry of stockInLogs || []) {
    const date = String(entry.date || '');
    if (!isValidDate(date)) {
      throw new Error(`স্টক-ইন ${entry.id || 'রেকর্ড'}-এর তারিখ সঠিক নয়; পুনর্গণনা বন্ধ রাখা হয়েছে।`);
    }
    if (date < startDate) continue;

    const product = productsById.get(String(entry.productId));
    const variant = product?.variants?.find((item) => item.sku === entry.sku);
    if (!variant) {
      throw new Error(`স্টক-ইন ${entry.id || 'রেকর্ড'}-এ পণ্য/SKU ${entry.productId}/${entry.sku} পাওয়া যায়নি।`);
    }
    const quantityUnit = entry.quantityUnit || getPackageQuantityUnit({
      ...entry,
      productName: entry.productName || product.name,
      generic: product.generic,
      size: entry.size || variant.size
    });
    if (quantityUnit === 'পিস') continue;

    const packages = getPackageCount(entry.cartons ?? entry.quantity);
    if (packages <= 0) continue;
    const packPerBox = Number(variant.packPerBox);
    if (quantityUnit === 'কার্টুন' && (!Number.isSafeInteger(packPerBox) || packPerBox < 1)) {
      throw new Error(`স্টক-ইন ${entry.id || 'রেকর্ড'}-এ প্যাক সাইজ সঠিক নয়।`);
    }
    const unitsPerPackage = quantityUnit === 'কার্টুন'
      ? packPerBox
      : 1;
    addBalance(product.id, variant.sku, {
      packages,
      units: packages * unitsPerPackage,
      damageUnits: 0
    }, entry.id || 'স্টক-ইন');
    stockInCount += 1;
  }

  let invoiceCount = 0;
  for (const invoice of invoices || []) {
    const date = String(invoice.date || '');
    if (!isValidDate(date)) {
      throw new Error(`ইনভয়েস ${invoice.id || 'রেকর্ড'}-এর তারিখ সঠিক নয়; পুনর্গণনা বন্ধ রাখা হয়েছে।`);
    }
    if (date < startDate) continue;

    const items = (invoice.items || []).map((item) => {
      const product = productsById.get(String(item.productId));
      const variant = product?.variants?.find((entry) => entry.sku === item.sku);
      const packages = getPackageCount(item.cartons ?? item.quantity);
      if (item.unitType !== 'piece' && packages > 0 && (!product || !variant)) {
        throw new Error(`ইনভয়েস ${invoice.id || 'রেকর্ড'}-এ পণ্য/SKU ${item.productId}/${item.sku} পাওয়া যায়নি।`);
      }
      const quantityUnit = getPackageQuantityUnit({
        ...item,
        productName: item.productName || product?.name,
        generic: product?.generic,
        size: item.size || variant?.size
      });
      const packPerBox = Number(item.packPerBox || variant?.packPerBox);
      if (
        item.unitType !== 'piece'
        && packages > 0
        && quantityUnit === 'কার্টুন'
        && (!Number.isSafeInteger(packPerBox) || packPerBox < 1)
      ) {
        throw new Error(`ইনভয়েস ${invoice.id || 'রেকর্ড'}-এ প্যাক সাইজ সঠিক নয়।`);
      }
      return {
        ...item,
        productName: item.productName || product?.name,
        generic: product?.generic,
        size: item.size || variant?.size,
        packPerBox: item.packPerBox || variant?.packPerBox
      };
    });
    const changes = getInvoiceStockChanges(null, { ...invoice, items });
    for (const change of changes.values()) {
      addBalance(change.productId, change.sku, {
        packages: change.cartons,
        units: change.pieces,
        damageUnits: change.damagePieces
      }, invoice.id || 'ইনভয়েস');
    }
    if (changes.size > 0) invoiceCount += 1;
  }

  const rebuiltProducts = (products || []).map((product) => ({
    ...product,
    variants: (product.variants || []).map((variant) => {
      const balance = balances.get(getVariantKey(product.id, variant.sku));
      return {
        ...variant,
        stockCartons: balance.packages,
        stock: balance.units,
        damageStock: balance.damageUnits
      };
    })
  }));

  return {
    products: rebuiltProducts,
    startDate,
    stockInCount,
    invoiceCount
  };
}
