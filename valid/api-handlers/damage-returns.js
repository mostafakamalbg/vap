import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { BusinessRecord, Product } from '../lib/models.js';
import { transactionCreateOptions, transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { ADMIN_ROLES, LOGISTIC_OFFICER_ROLE } from '../shared/roles.js';
import { STOCK_RECONCILIATION_START_DATE } from '../shared/stockReconciliation.js';

const ACTION_TYPES = new Set(['damage_stock', 'replaced_stock', 'write_off']);

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isValidEntry(entry) {
  return Boolean(
    entry
    && typeof entry.id === 'string'
    && entry.id.length > 0
    && entry.id.length <= 120
    && isValidDate(entry.date)
    && typeof entry.productId === 'string'
    && entry.productId.trim()
    && typeof entry.sku === 'string'
    && entry.sku.trim()
    && Number.isSafeInteger(Number(entry.quantityPieces))
    && Number(entry.quantityPieces) > 0
    && ACTION_TYPES.has(entry.actionType)
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  } catch (error) {
    console.error('Damage return database connection failed:', error);
    return res.status(503).json({ error: 'ডাটাবেজে সংযোগ করা যায়নি; পরে আবার চেষ্টা করুন।' });
  }
  const user = await authorize(req, res, [...ADMIN_ROLES, LOGISTIC_OFFICER_ROLE]);
  if (!user) return;

  const input = req.body || {};
  if (!isValidEntry(input)) {
    return res.status(400).json({ error: 'ডেমেজ ফেরতের তারিখ, পণ্য ও সঠিক পূর্ণসংখ্যার পরিমাণ দিন।' });
  }

  try {
    let savedEntry;
    let savedProduct;
    await withTransactionFallback(async (session) => {
      const options = transactionOptions(session);
      let existingRecordQuery = BusinessRecord.exists({ type: 'damageLogs', recordId: input.id });
      if (session) existingRecordQuery = existingRecordQuery.session(session);
      if (await existingRecordQuery) {
        const error = new Error('এই ডেমেজ ফেরত রেকর্ডটি আগে থেকেই আছে। হিস্ট্রি যাচাই করুন।');
        error.statusCode = 409;
        throw error;
      }

      let productQuery = Product.findOne({ id: input.productId.trim() });
      if (session) productQuery = productQuery.session(session);
      const product = await productQuery;
      if (!product) {
        const error = new Error('নির্বাচিত পণ্যটি পাওয়া যায়নি।');
        error.statusCode = 404;
        throw error;
      }
      const variant = (product.variants || []).find((item) => item.sku === input.sku.trim());
      if (!variant) {
        const error = new Error('নির্বাচিত প্যাক সাইজটি পাওয়া যায়নি।');
        error.statusCode = 404;
        throw error;
      }

      const quantityPieces = Number(input.quantityPieces);
      const packPerBox = Number(variant.packPerBox) || 1;
      const unitPrice = Number(variant.tp) || 0;
      if (input.date >= STOCK_RECONCILIATION_START_DATE) {
        variant.damageStock = (Number(variant.damageStock) || 0) + quantityPieces;
        product.markModified('variants');
        await product.save(options);
      }

      savedEntry = {
        ...input,
        id: input.id,
        date: input.date,
        productId: product.id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size || '',
        packPerBox,
        unit: variant.unit || 'পিস/বোতল',
        quantityPieces,
        unitPrice,
        totalDamageValue: Math.round(quantityPieces * unitPrice),
        status: 'গৃহীত'
      };
      await BusinessRecord.create([{
        type: 'damageLogs',
        recordId: savedEntry.id,
        data: savedEntry
      }], transactionCreateOptions(session));
      savedProduct = {
        id: product.id,
        variants: product.variants.map((item) => (
          typeof item.toObject === 'function' ? item.toObject() : { ...item }
        ))
      };
    });
    return res.status(201).json({ entry: savedEntry, product: savedProduct });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 11000) {
      return res.status(409).json({ error: 'এই ডেমেজ ফেরত রেকর্ডটি আগে থেকেই আছে। হিস্ট্রি যাচাই করুন।' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'ডেমেজ ফেরতের তথ্য সঠিক নয়; পণ্য ও পরিমাণ যাচাই করুন।' });
    }
    console.error('Damage return save failed:', error);
    return res.status(500).json({ error: 'ডেমেজ ফেরত ও পণ্যের মজুত সংরক্ষণ করা যায়নি।' });
  }
}
