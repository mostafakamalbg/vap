export function roundCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

export function getInvoiceItemAmounts(item) {
  const cartons = Math.max(0, Number(item?.cartons ?? item?.quantity) || 0);
  const retailPieces = Math.max(0, Number(item?.retailPieces) || 0);
  const packPerBox = Number(item?.packPerBox) || 1;
  const cartonPrice = Number(item?.cartonPrice ?? item?.unitPrice) || 0;
  const total = roundCurrency(
    cartons * cartonPrice
      + retailPieces * (Number(item?.piecePrice ?? item?.unitPrice) || 0)
  );
  const commissionAmount = roundCurrency(total * (Number(item?.commission) || 0) / 100);

  return {
    cartons,
    retailPieces,
    totalPieces: cartons * packPerBox + retailPieces,
    total,
    commissionAmount,
    netTotal: total - commissionAmount
  };
}

export function calculateInvoiceTotals({
  items = [],
  invoiceType = 'regular',
  transportCost = 0,
  returnAdjustments = []
} = {}) {
  const normalizedItems = items.map((item) => {
    const amounts = getInvoiceItemAmounts(item);
    return {
      ...item,
      cartons: amounts.cartons,
      quantity: amounts.cartons,
      retailPieces: amounts.retailPieces,
      cartonPrice: roundCurrency(item.cartonPrice ?? item.unitPrice),
      piecePrice: roundCurrency(item.piecePrice ?? item.unitPrice),
      totalPieces: amounts.totalPieces,
      unitPrice: roundCurrency(item.unitPrice ?? item.piecePrice),
      commission: Number(item.commission) || 0,
      commissionAmount: amounts.commissionAmount,
      total: amounts.total,
      netTotal: amounts.netTotal
    };
  });
  const isRegular = invoiceType === 'regular';
  const normalizedReturns = isRegular ? returnAdjustments.map((item) => {
    const quantity = Number(item.quantity ?? item.quantityPieces);
    const price = roundCurrency(item.price ?? item.unitPrice);
    return {
      ...item,
      quantity,
      quantityPieces: quantity,
      price,
      unitPrice: price,
      total: roundCurrency(quantity * price)
    };
  }) : [];
  const subtotal = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.total, 0));
  const commissionAmount = roundCurrency(
    normalizedItems.reduce((sum, item) => sum + item.commissionAmount, 0)
  );
  const returnAdjustmentTotal = roundCurrency(
    normalizedReturns.reduce((sum, item) => sum + item.total, 0)
  );
  const normalizedTransportCost = isRegular ? roundCurrency(transportCost) : 0;
  const totalAmount = Math.max(0, roundCurrency(
    subtotal - commissionAmount + normalizedTransportCost - returnAdjustmentTotal
  ));
  return {
    items: normalizedItems,
    subtotal,
    commissionAmount,
    returnAdjustments: normalizedReturns,
    returnAdjustmentTotal,
    transportCost: normalizedTransportCost,
    totalAmount
  };
}

export function getInvoiceSalesAmount(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  if (items.length) {
    const itemNet = items.reduce((sum, item) => {
      const amounts = getInvoiceItemAmounts(item);
      const lineTotal = amounts.total || roundCurrency(item?.total);
      const lineCommission = amounts.total
        ? amounts.commissionAmount
        : roundCurrency(lineTotal * (Number(item?.commission) || 0) / 100);
      return sum + lineTotal - lineCommission;
    }, 0);
    const returnAdjustments = Array.isArray(invoice?.returnAdjustments)
      ? invoice.returnAdjustments.reduce((sum, item) => (
        sum + roundCurrency(item?.total ?? Number(item?.quantity ?? item?.quantityPieces)
          * Number(item?.price ?? item?.unitPrice))
      ), 0)
      : roundCurrency(invoice?.returnAdjustmentTotal);
    return Math.max(0, roundCurrency(
      itemNet + roundCurrency(invoice?.transportCost) - returnAdjustments
    ));
  }

  const grandTotal = Number(invoice?.grandTotal);
  const returnAdjustmentTotal = roundCurrency(invoice?.returnAdjustmentTotal);
  if (Number.isFinite(grandTotal) && grandTotal !== 0) {
    return Math.max(0, roundCurrency(grandTotal - returnAdjustmentTotal));
  }

  const totalAmount = Number(invoice?.totalAmount);
  return Number.isFinite(totalAmount)
    ? Math.max(0, roundCurrency(totalAmount - returnAdjustmentTotal))
    : 0;
}
