export function getPackageQuantityUnit(item) {
  const productDescription = [item?.productName, item?.name, item?.generic]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/জিপসাম|gypsum|ম্যাগনেস|magnesium/.test(productDescription)) return 'বস্তা';

  const size = String(item?.size || '').trim().toLowerCase();
  if (/^(?:5|৫)\s*(?:l(?:tr|itre|iter)?|লিটার)(?:\s*[×x].*)?$/.test(size)) return 'জার';

  return 'কার্টুন';
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
