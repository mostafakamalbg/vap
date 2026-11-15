export function getPackageQuantityUnit(item) {
  const productDescription = [item?.productName, item?.name, item?.generic]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/জিপসাম|gypsum|ম্যাগনেস|magnesium|মহা\s*ম্যাগ/.test(productDescription)) return 'বস্তা';

  const size = String(item?.size || '').trim().toLowerCase();
  if (/^(?:5|৫)\s*(?:l(?:tr|itre|iter)?|লিটার)(?:\s*[×x].*)?$/.test(size)) return 'জার';

  return 'কার্টুন';
}

export function getInvoiceQuantityParts(item) {
  const cartonCount = Number(item?.cartons ?? item?.quantity) || 0;
  const retailPieces = Number(item?.retailPieces) || 0;
  const quantityUnit = getPackageQuantityUnit(item);
  const isPieceUnit = item?.unitType === 'piece'
    || (item?.unitType == null && cartonCount === 0 && retailPieces > 0);

  if (isPieceUnit) return [{ quantity: retailPieces, unit: 'পিস' }];

  const parts = [];
  if (cartonCount > 0) {
    parts.push({
      quantity: cartonCount,
      unit: ['কার্টুন', 'জার'].includes(quantityUnit) ? '' : quantityUnit
    });
  }
  if (retailPieces > 0) parts.push({ quantity: retailPieces, unit: 'পিস' });
  if (parts.length === 0) {
    parts.push({
      quantity: 0,
      unit: ['কার্টুন', 'জার'].includes(quantityUnit) ? '' : quantityUnit
    });
  }
  return parts;
}

export function getStockInQuantities(item, packageCount) {
  const count = Number(packageCount) || 0;
  const packPerBox = Number(item?.packPerBox) || 1;
  const quantityUnit = getPackageQuantityUnit(item);
  const currentStock = Number(item?.stock) || 0;
  const currentCartons = item?.stockCartons == null
    ? Math.floor(currentStock / packPerBox)
    : Number(item.stockCartons) || 0;
  const quantityPieces = quantityUnit === 'কার্টুন' ? count * packPerBox : count;
  const stock = currentStock + quantityPieces;
  return {
    quantityUnit,
    cartons: count,
    quantityPieces,
    stock,
    stockCartons: quantityUnit === 'কার্টুন'
      ? currentCartons + count
      : Math.floor(stock / packPerBox)
  };
}
