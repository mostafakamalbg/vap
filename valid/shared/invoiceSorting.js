import { sortProductItemsByInventory } from './productSorting.js';

function normalizeDigits(value) {
  return String(value).replace(/[০-৯]/g, (digit) => (
    String('০১২৩৪৫৬৭৮৯'.indexOf(digit))
  ));
}

function getSizeCapacity(size) {
  const normalizedSize = normalizeDigits(size);
  const match = normalizedSize.match(
    /(\d+(?:\.\d+)?)\s*(kilograms?|kg|grams?|gm|g|milligrams?|mg|millilit(?:er|re)s?|ml|liters?|litres?|l|কিলোগ্রাম|কেজি|গ্রাম|মিগ্রা|মিলিলিটার|মিলি|লিটার|লিঃ)/i
  );
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (/^(kilograms?|kg|কিলোগ্রাম|কেজি)$/.test(unit)) {
    return { dimension: 'mass', value: value * 1000 };
  }
  if (/^(grams?|gm|g|গ্রাম)$/.test(unit)) {
    return { dimension: 'mass', value };
  }
  if (/^(milligrams?|mg|মিগ্রা)$/.test(unit)) {
    return { dimension: 'mass', value: value / 1000 };
  }
  if (/^(liters?|litres?|l|লিটার|লিঃ)$/.test(unit)) {
    return { dimension: 'volume', value: value * 1000 };
  }
  return { dimension: 'volume', value };
}

function compareCodes(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    || left.localeCompare(right);
}

export function compareInvoiceItemsByIdAndSize(left, right) {
  const leftId = String(left.productId || left.id || left.productCode || left.sku || '');
  const rightId = String(right.productId || right.id || right.productCode || right.sku || '');
  const idOrder = compareCodes(leftId, rightId);
  if (idOrder !== 0) return idOrder;

  const leftCapacity = getSizeCapacity(left.size);
  const rightCapacity = getSizeCapacity(right.size);
  if (leftCapacity && rightCapacity) {
    if (leftCapacity.dimension === rightCapacity.dimension) {
      const sizeOrder = rightCapacity.value - leftCapacity.value;
      if (sizeOrder !== 0) return sizeOrder;
    }
  } else if (leftCapacity || rightCapacity) {
    return leftCapacity ? -1 : 1;
  }

  return compareCodes(
    String(left.sku || left.productCode || ''),
    String(right.sku || right.productCode || '')
  );
}

export function sortInvoiceItems(items = [], products = []) {
  return sortProductItemsByInventory(
    items,
    products,
    compareInvoiceItemsByIdAndSize
  );
}
