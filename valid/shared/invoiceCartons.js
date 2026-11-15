export function getItemCartons(item) {
  const cartonCount = Number(item?.cartons ?? item?.quantity);
  const retailPieces = Number(item?.retailPieces) || 0;
  const packPerBox = Number(item?.packPerBox);
  if (
    Number.isFinite(cartonCount)
    && cartonCount >= 0
    && Number.isSafeInteger(retailPieces)
    && retailPieces >= 0
    && (cartonCount > 0 || retailPieces > 0)
  ) {
    return cartonCount + retailPieces / (Number.isFinite(packPerBox) && packPerBox > 0 ? packPerBox : 1);
  }

  const cartons = Number(item?.cartons);
  if (Number.isFinite(cartons) && cartons > 0) return cartons;

  const quantity = Number(item?.quantity);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;

  const pieces = Number(item?.totalPieces);
  return Number.isFinite(pieces) && pieces > 0
    ? pieces / (Number.isFinite(packPerBox) && packPerBox > 0 ? packPerBox : 1)
    : 0;
}

export function getInvoiceCartons(invoice) {
  const storedTotal = Number(invoice?.totalCartons);
  if (Number.isFinite(storedTotal) && storedTotal > 0) return storedTotal;

  return (invoice?.items || []).reduce((sum, item) => sum + getItemCartons(item), 0);
}
