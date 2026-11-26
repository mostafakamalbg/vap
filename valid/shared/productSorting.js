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

export function sortProductItemsByInventory(items = [], products = [], fallbackComparator = compareNaturalText) {
  const productRanks = new Map();
  const variantRanks = new Map();
  sortProductsByCode(products).forEach((product, productIndex) => {
    const productId = String(product.id || '');
    productRanks.set(productId, productIndex);
    (product.variants || []).forEach((variant, variantIndex) => {
      variantRanks.set(`${productId}\u0000${String(variant.sku || '')}`, variantIndex);
    });
  });

  const productRank = (item) => productRanks.get(String(item.productId || item.id || ''));
  const variantRank = (item) => variantRanks.get(
    `${String(item.productId || item.id || '')}\u0000${String(item.sku || '')}`
  );

  return [...items].sort((left, right) => {
    const leftProductRank = productRank(left);
    const rightProductRank = productRank(right);
    if (leftProductRank != null && rightProductRank != null && leftProductRank !== rightProductRank) {
      return leftProductRank - rightProductRank;
    }
    if (leftProductRank != null && rightProductRank == null) return -1;
    if (leftProductRank == null && rightProductRank != null) return 1;

    const leftVariantRank = variantRank(left);
    const rightVariantRank = variantRank(right);
    if (leftVariantRank != null && rightVariantRank != null && leftVariantRank !== rightVariantRank) {
      return leftVariantRank - rightVariantRank;
    }
    if (leftVariantRank != null && rightVariantRank == null) return -1;
    if (leftVariantRank == null && rightVariantRank != null) return 1;

    return fallbackComparator(left, right);
  });
}
