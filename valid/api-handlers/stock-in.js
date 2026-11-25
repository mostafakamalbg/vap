import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { BusinessRecord, Product } from '../lib/models.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { getStockInQuantities, isValidStockInQuantities } from '../shared/quantityUnits.js';
import { STOCK_RECONCILIATION_START_DATE } from '../shared/stockReconciliation.js';
import { ADMIN_ROLES, LOGISTIC_OFFICER_ROLE } from '../shared/roles.js';
import { createApprovalRequest } from '../lib/approvalRequests.js';

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function getCartons(input) {
  return Number(input?.cartons ?? input?.quantity);
}

function isValidEntry(input) {
  const cartons = getCartons(input);
  return Boolean(
    input
    && String(input.productId || '').trim()
    && String(input.sku || '').trim()
    && isValidDate(input.date)
    && Number.isSafeInteger(cartons)
    && cartons > 0
  );
}

export default async function handler(req, res) {
  if (!['POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  } catch (error) {
    console.error('Stock-in database connection failed:', error);
    return res.status(503).json({ error: 'ডাটাবেজে সংযোগ করা যায়নি; পরে আবার চেষ্টা করুন।' });
  }
  const user = await authorize(req, res, [...ADMIN_ROLES, LOGISTIC_OFFICER_ROLE]);
  if (!user) return;

  if (req.method === 'PATCH') {
    const id = String(req.body?.id || '').trim();
    const input = req.body?.entry;
    if (!id || !input || typeof input !== 'object') {
      return res.status(400).json({ error: 'সংশোধনের জন্য স্টক-ইন চালান নির্বাচন করুন।' });
    }
    try {
      const current = await BusinessRecord.findOne({ type: 'stockInLogs', recordId: id })
        .select('recordId data updatedAt')
        .lean();
      if (!current) return res.status(404).json({ error: 'স্টক-ইন চালান পাওয়া যায়নি।' });
      const editableFields = [
        'productId',
        'sku',
        'date',
        'cartons',
        'quantity',
        'source',
        'batchNo',
        'challanNo',
        'mfgDate',
        'expDate',
        'receivedBy',
        'note'
      ];
      const changes = Object.fromEntries(Object.entries(input).filter(([key]) => (
        editableFields.includes(key)
      )));
      const proposed = { ...current.data, ...changes, id: current.data.id || id };
      if (!isValidEntry(proposed)) {
        return res.status(400).json({ error: 'স্টক-ইন তারিখ, পণ্য ও সঠিক পরিমাণ দিন।' });
      }
      const product = await Product.findOne({ id: String(proposed.productId).trim() }).lean();
      const variant = product?.variants?.find((item) => item.sku === String(proposed.sku).trim());
      if (!variant) return res.status(400).json({ error: 'নির্বাচিত পণ্য বা প্যাক সাইজ পাওয়া যায়নি।' });
      const packPerBox = Number(variant.packPerBox);
      if (!Number.isSafeInteger(packPerBox) || packPerBox < 1) {
        return res.status(409).json({ error: 'নির্বাচিত পণ্যের প্যাক তথ্য সঠিক নয়।' });
      }
      const quantities = getStockInQuantities({
        ...variant,
        productName: product.name,
        generic: product.generic
      }, getCartons(proposed));
      if (!isValidStockInQuantities(quantities)) {
        return res.status(400).json({ error: 'স্টক পরিমাণ সঠিকভাবে হিসাব করা যায়নি; প্যাক ও মজুত তথ্য যাচাই করুন।' });
      }
      const revisedEntry = {
        ...proposed,
        productId: String(proposed.productId).trim(),
        productName: product.name,
        sku: String(proposed.sku).trim(),
        cartons: getCartons(proposed),
        quantity: getCartons(proposed),
        quantityPieces: quantities.quantityPieces,
        quantityUnit: quantities.quantityUnit,
        packPerBox,
        size: variant.size || ''
      };
      const approvalRequest = await createApprovalRequest({
        requestType: 'stock_in_update',
        targetId: id,
        original: current.data,
        originalUpdatedAt: current.updatedAt,
        proposed: revisedEntry,
        user
      });
      return res.status(202).json({ pendingApproval: true, approvalRequest });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error('Stock-in update request failed:', error);
      return res.status(500).json({ error: 'স্টক-ইন সংশোধনের অনুরোধ জমা করা যায়নি।' });
    }
  }

  const inputs = Array.isArray(req.body?.entries) ? req.body.entries : [req.body || {}];
  if (!inputs.length || inputs.length > 200 || inputs.some((input) => !isValidEntry(input))) {
    return res.status(400).json({ error: 'স্টক-ইন তারিখ, পণ্য ও সঠিক পরিমাণ দিন।' });
  }

  const entries = inputs.map((input) => ({
    ...input,
    id: `STK-IN-${randomUUID()}`,
    productId: String(input.productId).trim(),
    sku: String(input.sku).trim(),
    cartons: getCartons(input)
  }));
  try {
    await withTransactionFallback(async (session) => {
      const options = transactionOptions(session);
      const loadedProducts = new Map();
      const changedProducts = new Map();
      for (const entry of entries) {
        let product = loadedProducts.get(String(entry.productId));
        if (!product) {
          let productQuery = Product.findOne({ id: String(entry.productId) });
          if (session) productQuery = productQuery.session(session);
          product = await productQuery;
          if (!product) {
            const error = new Error('নির্বাচিত পণ্যটি পাওয়া যায়নি।');
            error.statusCode = 404;
            throw error;
          }
          loadedProducts.set(String(entry.productId), product);
        }
        const variant = (product.variants || []).find((item) => item.sku === entry.sku);
        if (!variant) {
          const error = new Error('নির্বাচিত প্যাক সাইজটি পাওয়া যায়নি।');
          error.statusCode = 404;
          throw error;
        }
        const packPerBox = Number(variant.packPerBox);
        if (!Number.isSafeInteger(packPerBox) || packPerBox < 1) {
          const error = new Error('নির্বাচিত পণ্যের প্যাক তথ্য সঠিক নয়।');
          error.statusCode = 409;
          throw error;
        }
        const stockBase = entry.date >= STOCK_RECONCILIATION_START_DATE
          ? variant
          : { ...variant, stock: 0, stockCartons: 0 };
        const quantities = getStockInQuantities({
          productName: product.name,
          generic: product.generic,
          size: variant.size,
          packPerBox,
          stock: stockBase.stock,
          stockCartons: stockBase.stockCartons
        }, entry.cartons);
        if (!isValidStockInQuantities(quantities)) {
          const error = new Error('স্টক পরিমাণ সঠিকভাবে হিসাব করা যায়নি; প্যাক ও মজুত তথ্য যাচাই করুন।');
          error.statusCode = 400;
          throw error;
        }
        entry.quantityPieces = quantities.quantityPieces;
        entry.quantityUnit = quantities.quantityUnit;
        entry.packPerBox = packPerBox;
        if (entry.date >= STOCK_RECONCILIATION_START_DATE) {
          variant.stockCartons = quantities.stockCartons;
          variant.stock = quantities.stock;
          changedProducts.set(String(entry.productId), product);
        }
      }
      for (const product of changedProducts.values()) {
        product.markModified('variants');
        await product.save(options);
      }
      await BusinessRecord.insertMany(entries.map((entry) => ({
        type: 'stockInLogs',
        recordId: entry.id,
        data: entry
      })), options);
    });
    return res.status(201).json({ entries });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 11000) {
      return res.status(409).json({ error: 'এই স্টক-ইন রেকর্ডটি আগে থেকেই আছে। আবার জমা দেওয়ার আগে হিস্ট্রি দেখুন।' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'স্টক-ইন তথ্য সঠিক নয়; পণ্য ও পরিমাণ যাচাই করুন।' });
    }
    console.error('Stock-in save failed:', error);
    return res.status(500).json({ error: 'স্টক-ইন ও পণ্যের মজুত সংরক্ষণ করা যায়নি।' });
  }
}
