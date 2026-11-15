export function getInvoiceItemAmounts(item) {
  const cartons = Math.max(0, Number(item?.cartons ?? item?.quantity) || 0);
  const retailPieces = Math.max(0, Number(item?.retailPieces) || 0);
  const packPerBox = Number(item?.packPerBox) || 1;
  const total = cartons * (Number(item?.cartonPrice) || 0)
    + retailPieces * (Number(item?.piecePrice ?? item?.unitPrice) || 0);
  const commissionAmount = total * (Number(item?.commission) || 0) / 100;

  return {
    cartons,
    retailPieces,
    totalPieces: cartons * packPerBox + retailPieces,
    total,
    commissionAmount,
    netTotal: total - commissionAmount
  };
}

export function getInvoiceSalesAmount(invoice) {
  const grandTotal = Number(invoice?.grandTotal);
  if (Number.isFinite(grandTotal) && grandTotal !== 0) return grandTotal;

  const totalAmount = Number(invoice?.totalAmount);
  return Number.isFinite(totalAmount) ? totalAmount : 0;
}
