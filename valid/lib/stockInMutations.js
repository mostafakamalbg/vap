import { BusinessRecord, Product } from './models.js';
import {
  transactionCreateOptions,
  transactionOptions
} from './transactions.js';
import { STOCK_RECONCILIATION_START_DATE } from '../shared/stockReconciliation.js';
import { getStockInChallanKey } from '../shared/stockInChallans.js';
import { calculateStockInRevisionDeltas } from '../shared/stockInRevisions.js';

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function recordData(record) {
  return {
    ...record.data,
    id: record.data?.id || record.recordId
  };
}

export async function loadStockInChallan(id, session) {
  const anchorQuery = BusinessRecord.findOne({
    type: 'stockInLogs',
    $or: [{ recordId: id }, { 'data.id': id }]
  }).select('recordId data updatedAt');
  if (session) anchorQuery.session(session);
  const anchor = await anchorQuery.lean();
  if (!anchor) return null;

  const dateFilter = anchor.data?.date == null
    ? { 'data.date': { $exists: false } }
    : { 'data.date': anchor.data.date };
  const groupQuery = BusinessRecord.find({ type: 'stockInLogs', ...dateFilter })
    .select('recordId data updatedAt')
    .sort({ createdAt: 1, recordId: 1 });
  if (session) groupQuery.session(session);
  const records = await groupQuery.lean();
  const anchorKey = getStockInChallanKey(recordData(anchor));
  const matchingRecords = records.filter((record) => (
    getStockInChallanKey(recordData(record)) === anchorKey
  ));

  return {
    anchor,
    records: matchingRecords.filter((record) => !record.data?.deletedAt)
  };
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => (
      [key, normalizeValue(value[key])]
    )));
  }
  return value;
}

export function assertStockInSnapshot(currentRecords, snapshots) {
  if (!Array.isArray(snapshots)) return;
  if (snapshots.length !== currentRecords.length) {
    fail(409, 'চালানটি খোলার পর পরিবর্তিত হয়েছে; নতুন করে সম্পাদনা করুন।');
  }
  const currentById = new Map(currentRecords.map((record) => [record.recordId, record]));
  for (const snapshot of snapshots) {
    const snapshotId = String(snapshot?.id || snapshot?.recordId || '').trim();
    const current = currentById.get(snapshotId);
    if (!current) fail(409, 'চালানটি খোলার পর পরিবর্তিত হয়েছে; নতুন করে সম্পাদনা করুন।');

    if (snapshot.recordUpdatedAt) {
      if (new Date(snapshot.recordUpdatedAt).valueOf() !== new Date(current.updatedAt).valueOf()) {
        fail(409, 'চালানটি খোলার পর পরিবর্তিত হয়েছে; নতুন করে সম্পাদনা করুন।');
      }
      continue;
    }

    const expected = snapshot.data || snapshot;
    if (JSON.stringify(normalizeValue(recordData(current))) !== JSON.stringify(normalizeValue(expected))) {
      fail(409, 'চালানটি খোলার পর পরিবর্তিত হয়েছে; নতুন করে সম্পাদনা করুন।');
    }
  }
}

export async function applyStockInRevision(originalEntries, proposedEntries, session) {
  const loadedProducts = new Map();
  const packPerBoxByVariant = {};
  const allEntries = [...(originalEntries || []), ...(proposedEntries || [])]
    .filter((entry) => entry && entry.date >= STOCK_RECONCILIATION_START_DATE);

  for (const entry of allEntries) {
    const productId = String(entry.productId || '');
    const sku = String(entry.sku || '');
    let product = loadedProducts.get(productId);
    if (!product) {
      const productQuery = Product.findOne({ id: productId });
      if (session) productQuery.session(session);
      product = await productQuery;
      if (!product) fail(409, 'স্টক-ইন পণ্যটি আর পাওয়া যাচ্ছে না।');
      loadedProducts.set(productId, product);
    }
    const variant = product.variants?.find((item) => item.sku === sku);
    if (!variant) fail(409, 'স্টক-ইন পণ্যের প্যাক সাইজ আর পাওয়া যাচ্ছে না।');
    if ((proposedEntries || []).includes(entry) && Number(entry.packPerBox) !== Number(variant.packPerBox)) {
      fail(409, 'অনুরোধের পর পণ্যের প্যাক তথ্য পরিবর্তিত হয়েছে; নতুন করে সম্পাদনা জমা দিন।');
    }

    const key = `${productId}::${sku}`;
    packPerBoxByVariant[key] = Number(variant.packPerBox) || 1;
  }

  const changes = calculateStockInRevisionDeltas(
    originalEntries,
    proposedEntries,
    packPerBoxByVariant,
    STOCK_RECONCILIATION_START_DATE
  );
  for (const change of changes) {
    const product = loadedProducts.get(change.productId);
    let foundVariant = false;
    product.variants = (product.variants || []).map((variant) => {
      if (variant.sku !== change.sku) return variant;
      foundVariant = true;
      const packPerBox = Number(variant.packPerBox) || 1;
      const currentPieces = variant.stock == null
        ? (Number(variant.stockCartons) || 0) * packPerBox
        : Number(variant.stock) || 0;
      const currentPackages = variant.stockCartons == null
        ? Math.floor(currentPieces / packPerBox)
        : Number(variant.stockCartons) || 0;
      const stock = currentPieces + change.pieces;
      const stockCartons = currentPackages + change.packages;
      if (
        !Number.isSafeInteger(stock)
        || !Number.isSafeInteger(stockCartons)
        || stock < 0
        || stockCartons < 0
      ) {
        fail(409, 'বর্তমান বিক্রয়/স্টক সমন্বয়ের কারণে সংশোধিত পরিমাণে মজুত ঋণাত্মক বা অবৈধ হবে।');
      }
      return { ...variant, stock, stockCartons };
    });
    if (!foundVariant) fail(409, 'স্টক-ইন পণ্যের প্যাক সাইজ আর পাওয়া যাচ্ছে না।');
    product.markModified('variants');
    await product.save(transactionOptions(session));
  }
}

export async function saveStockInRevision(
  currentRecords,
  proposedEntries,
  { deletedBy = '', deletedByRole = '' } = {},
  session
) {
  const currentById = new Map(currentRecords.map((record) => [record.recordId, record]));
  const proposedIds = new Set(proposedEntries.map((entry) => entry.id));
  const originalEntries = currentRecords.map(recordData);
  await applyStockInRevision(originalEntries, proposedEntries, session);

  for (const entry of proposedEntries) {
    const current = currentById.get(entry.id);
    if (!current) continue;
    const saved = await BusinessRecord.findOneAndUpdate(
      { type: 'stockInLogs', recordId: current.recordId, updatedAt: current.updatedAt },
      { $set: { data: entry } },
      { ...transactionOptions(session), new: true }
    ).lean();
    if (!saved) fail(409, 'স্টক-ইন চালানটি আর হালনাগাদ করা যায়নি; তালিকা রিফ্রেশ করে আবার চেষ্টা করুন।');
  }

  const deletedAt = new Date();
  for (const current of currentRecords) {
    if (proposedIds.has(current.recordId)) continue;
    const saved = await BusinessRecord.findOneAndUpdate(
      { type: 'stockInLogs', recordId: current.recordId, updatedAt: current.updatedAt },
      {
        $set: {
          data: {
            ...recordData(current),
            deletedAt,
            deletedBy,
            deletedByRole
          }
        }
      },
      { ...transactionOptions(session), new: true }
    ).lean();
    if (!saved) fail(409, 'স্টক-ইন চালানের একটি পণ্য আর হালনাগাদ করা যায়নি।');
  }

  const newEntries = proposedEntries.filter((entry) => !currentById.has(entry.id));
  if (newEntries.length) {
    await BusinessRecord.insertMany(newEntries.map((entry) => ({
      type: 'stockInLogs',
      recordId: entry.id,
      data: entry
    })), transactionCreateOptions(session));
  }

  return proposedEntries;
}

export function getStockInRecordData(record) {
  return recordData(record);
}
