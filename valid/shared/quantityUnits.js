export function getPackageQuantityUnit(item) {
  const packPerBox = Number(item?.packPerBox) || 1;
  return packPerBox > 1 ? 'কার্টুন' : item?.unit || 'একক';
}
