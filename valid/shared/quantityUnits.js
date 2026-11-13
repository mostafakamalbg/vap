export function getPackageQuantityUnit(item) {
  const productDescription = [item?.productName, item?.name, item?.generic]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/জিপসাম|gypsum|ম্যাগনেস|magnesium/.test(productDescription)) return 'বস্তা';

  const size = String(item?.size || '').trim().toLowerCase();
  if (/^(?:5|৫)\s*(?:l(?:tr|itre|iter)?|লিটার)$/.test(size)) return 'জার';

  return 'কার্টুন';
}
