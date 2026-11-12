export function getItemCartons(item) {
  const cartons = Number(item?.cartons);
  if (Number.isFinite(cartons) && cartons > 0) return cartons;

  const quantity = Number(item?.quantity);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;

  const pieces = Number(item?.totalPieces);
  const packPerBox = Number(item?.packPerBox);
  return Number.isFinite(pieces) && pieces > 0
    ? pieces / (Number.isFinite(packPerBox) && packPerBox > 0 ? packPerBox : 1)
    : 0;
}

export function getInvoiceCartons(invoice) {
  const storedTotal = Number(invoice?.totalCartons);
  if (Number.isFinite(storedTotal) && storedTotal > 0) return storedTotal;

  return (invoice?.items || []).reduce((sum, item) => sum + getItemCartons(item), 0);
}
