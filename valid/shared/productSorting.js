export function normalizeProductCode(product = {}) {
  return String(product.productCode || product.code || product.id || '').trim();
}

export function compareNaturalText(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    || a.localeCompare(b);
}

export function compareProductsByCode(left, right) {
  const codeOrder = compareNaturalText(normalizeProductCode(left), normalizeProductCode(right));
  if (codeOrder !== 0) return codeOrder;
  return compareNaturalText(left.name, right.name)
    || compareNaturalText(left.id, right.id);
}

export function sortProductsByCode(products = []) {
  return [...products].sort(compareProductsByCode);
}
