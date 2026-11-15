function amountOrZero(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function getDealerNetDue({
  openingDue,
  totalBillAmount,
  totalReturnAmount,
  totalPaidAmount,
  damageCredits
} = {}) {
  return amountOrZero(openingDue)
    + amountOrZero(totalBillAmount)
    - amountOrZero(totalReturnAmount)
    - amountOrZero(totalPaidAmount)
    - amountOrZero(damageCredits);
}
