export function getInvoiceSalesAmount(invoice) {
  const grandTotal = Number(invoice?.grandTotal);
  if (Number.isFinite(grandTotal) && grandTotal !== 0) return grandTotal;

  const totalAmount = Number(invoice?.totalAmount);
  return Number.isFinite(totalAmount) ? totalAmount : 0;
}
