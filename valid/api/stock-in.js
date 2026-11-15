import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { BusinessRecord, Product } from '../lib/models.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { getStockInQuantities } from '../shared/quantityUnits.js';

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  } catch (error) {
    console.error('Stock-in database connection failed:', error);
    return res.status(503).json({ error: 'ডাটাবেজে সংযোগ করা যায়নি; পরে আবার চেষ্টা করুন।' });
  }
  const user = await authorize(req, res, ['admin']);
  if (!user) return;

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
      const products = new Map();
      for (const entry of entries) {
        let product = products.get(String(entry.productId));
        if (!product) {
          let productQuery = Product.findOne({ id: String(entry.productId) });
          if (session) productQuery = productQuery.session(session);
          product = await productQuery;
          if (!product) {
            const error = new Error('নির্বাচিত পণ্যটি পাওয়া যায়নি।');
            error.statusCode = 404;
            throw error;
          }
          products.set(String(entry.productId), product);
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
        const quantities = getStockInQuantities({
          productName: product.name,
          generic: product.generic,
          size: variant.size,
          packPerBox,
          stock: variant.stock,
          stockCartons: variant.stockCartons
        }, entry.cartons);
        if (
          !Number.isSafeInteger(quantities.quantityPieces)
          || quantities.quantityPieces <= 0
          || !Number.isSafeInteger(quantities.stock)
          || quantities.stock < 0
          || !Number.isSafeInteger(quantities.stockCartons)
          || quantities.stockCartons < 0
        ) {
          const error = new Error('স্টক পরিমাণ নিরাপদ সীমার বাইরে।');
          error.statusCode = 400;
          throw error;
        }
        entry.quantityPieces = quantities.quantityPieces;
        entry.quantityUnit = quantities.quantityUnit;
        variant.stockCartons = quantities.stockCartons;
        variant.stock = quantities.stock;
      }
      for (const product of products.values()) {
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
