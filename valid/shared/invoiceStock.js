import { getPackageQuantityUnit } from './quantityUnits.js';

function getInvoiceStockMovements(invoice) {
  const movements = new Map();
  const isDealerReturn = invoice.invoiceType === 'dealer_return';
  const isDepotFactoryReturn = ['depot_factory_return', 'factory_damage'].includes(invoice.invoiceType);

  (invoice.items || []).forEach((item) => {
    if (!item.productId || !item.sku) return;

    if (item.unitType === 'piece') return;

    const cartons = Math.trunc(Number(item.cartons ?? item.quantity) || 0);
    if (cartons <= 0) return;

    const key = `${item.productId}\u0000${item.sku}`;
    const packPerBox = Number(item.packPerBox);
    const totalPieces = Number(item.totalPieces);
    const quantityUnit = getPackageQuantityUnit(item);
    const pieces = quantityUnit !== 'কার্টুন'
      ? cartons
      : Number.isSafeInteger(packPerBox) && packPerBox > 0
        ? cartons * packPerBox
      : Number.isFinite(totalPieces)
        ? Math.max(0, totalPieces - (Number(item.retailPieces) || 0))
        : cartons;
    const movement = movements.get(key) || {
      productId: item.productId,
      sku: item.sku,
      cartons: 0,
      pieces: 0,
      damagePieces: 0
    };

    const direction = isDealerReturn ? 1 : -1;
    if (item.stockCondition === 'damaged' && (isDealerReturn || isDepotFactoryReturn)) {
      movement.damagePieces += pieces * direction;
    } else {
      movement.cartons += cartons * direction;
      movement.pieces += pieces * direction;
    }
    movements.set(key, movement);
  });

  return movements;
}

export function getInvoiceStockChanges(previousInvoice, nextInvoice) {
  const changes = new Map();

  [[previousInvoice, -1], [nextInvoice, 1]].forEach(([invoice, multiplier]) => {
    if (!invoice) return;

    getInvoiceStockMovements(invoice).forEach((movement, key) => {
      const change = changes.get(key) || {
        productId: movement.productId,
        sku: movement.sku,
        cartons: 0,
        pieces: 0,
        damagePieces: 0
      };
      change.cartons += movement.cartons * multiplier;
      change.pieces += movement.pieces * multiplier;
      change.damagePieces += movement.damagePieces * multiplier;
      changes.set(key, change);
    });
  });

  return changes;
}

export function applyInvoiceStockChanges(products, previousInvoice, nextInvoice) {
  const changes = getInvoiceStockChanges(previousInvoice, nextInvoice);

  return products.map((product) => {
    const productChanges = [...changes.values()].filter((change) => change.productId === product.id);
    if (productChanges.length === 0) return product;

    return {
      ...product,
      variants: (product.variants || []).map((variant) => {
        const change = productChanges.find((entry) => entry.sku === variant.sku);
        if (!change) return variant;

        return {
          ...variant,
          stockCartons: (Number(variant.stockCartons) || 0) + change.cartons,
          stock: (Number(variant.stock) || 0) + change.pieces,
          damageStock: (Number(variant.damageStock) || 0) + change.damagePieces
        };
      })
    };
  });
}
