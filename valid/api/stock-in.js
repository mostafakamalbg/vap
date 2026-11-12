import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { BusinessRecord, Product } from '../lib/models.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['admin']);
  if (!user) return;

  const inputs = Array.isArray(req.body?.entries) ? req.body.entries : [req.body || {}];
  if (!inputs.length || inputs.length > 50 || inputs.some((input) => (
    !input?.productId
    || !input?.sku
    || !isValidDate(input.date)
    || !Number.isSafeInteger(Number(input.quantityPieces))
    || Number(input.quantityPieces) <= 0
    || !Number.isSafeInteger(Number(input.cartons))
    || Number(input.cartons) < 0
  ))) {
    return res.status(400).json({ error: 'স্টক-ইন তারিখ, পণ্য ও সঠিক পরিমাণ দিন।' });
  }

  const entries = inputs.map((input) => ({
    ...input,
    id: `STK-IN-${randomUUID()}`,
    quantityPieces: Number(input.quantityPieces),
    cartons: Number(input.cartons)
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
        variant.stockCartons = (Number(variant.stockCartons) || 0) + entry.cartons;
        variant.stock = (Number(variant.stock) || 0) + entry.quantityPieces;
      }
      for (const product of products.values()) await product.save(options);
      await BusinessRecord.create(entries.map((entry) => ({
        type: 'stockInLogs',
        recordId: entry.id,
        data: entry
      })), options);
    });
    return res.status(201).json({ entries });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Stock-in save failed:', error);
    return res.status(500).json({ error: 'স্টক-ইন ও পণ্যের মজুত সংরক্ষণ করা যায়নি।' });
  }
}
