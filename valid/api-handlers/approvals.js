import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Invoice, Payment, Product } from '../lib/models.js';
import { authorize, hasSuperAdminAccess } from '../lib/auth.js';
import {
  applyInvoiceStockChanges,
  syncInvoicePayment
} from './invoices.js';
import {
  getPackageQuantityUnit,
  getStockInPieceQuantity
} from '../shared/quantityUnits.js';
import { STOCK_RECONCILIATION_START_DATE } from '../shared/stockReconciliation.js';
import {
  transactionCreateOptions,
  transactionOptions,
  withTransactionFallback
} from '../lib/transactions.js';

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function revisionMatches(current, original, originalUpdatedAt) {
  if (originalUpdatedAt && current?.updatedAt) {
    return new Date(originalUpdatedAt).valueOf() === new Date(current.updatedAt).valueOf();
  }
  const normalize = (value) => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
    }
    return value;
  };
  return JSON.stringify(normalize(current?.data || current)) === JSON.stringify(normalize(original));
}

function stockContribution(entry, variant) {
  if (!entry || String(entry.date || '') < STOCK_RECONCILIATION_START_DATE) {
    return { pieces: 0, packages: 0 };
  }
  const pieces = getStockInPieceQuantity(entry, Number(variant.packPerBox) || 1);
  const quantityUnit = String(entry.quantityUnit || getPackageQuantityUnit(entry));
  const packages = quantityUnit === 'কার্টুন'
    ? Number(entry.cartons ?? entry.quantity) || 0
    : pieces;
  return { pieces, packages };
}

async function applyStockInRevision(original, proposed, session) {
  const entries = [original, proposed].filter((entry) => (
    entry && entry.date >= STOCK_RECONCILIATION_START_DATE
  ));
  const changes = new Map();
  for (const entry of entries) {
    const key = `${entry.productId}::${entry.sku}`;
    const change = changes.get(key) || {
      productId: entry.productId,
      sku: entry.sku,
      pieces: 0,
      packages: 0
    };
    const productQuery = Product.findOne({ id: String(entry.productId) });
    if (session) productQuery.session(session);
    const product = await productQuery;
    const variant = product?.variants?.find((item) => item.sku === entry.sku);
    if (!variant) fail(409, 'স্টক-ইন পণ্যের প্যাক সাইজ আর পাওয়া যাচ্ছে না।');
    if (entry === proposed && Number(entry.packPerBox) !== Number(variant.packPerBox)) {
      fail(409, 'অনুরোধের পর পণ্যের প্যাক তথ্য পরিবর্তিত হয়েছে; নতুন করে সংশোধন জমা দিন।');
    }
    const contribution = stockContribution(entry, variant);
    const multiplier = entry === proposed ? 1 : -1;
    change.pieces += contribution.pieces * multiplier;
    change.packages += contribution.packages * multiplier;
    changes.set(key, change);
  }

  for (const change of changes.values()) {
    const productQuery = Product.findOne({ id: change.productId });
    if (session) productQuery.session(session);
    const product = await productQuery;
    if (!product) fail(409, 'স্টক-ইন পণ্যটি আর পাওয়া যাচ্ছে না।');
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
      if (stock < 0 || stockCartons < 0) {
        fail(409, 'বর্তমান বিক্রয়/স্টক সমন্বয়ের কারণে সংশোধিত পরিমাণে মজুত ঋণাত্মক হবে।');
      }
      return { ...variant, stock, stockCartons };
    });
    if (!foundVariant) fail(409, 'স্টক-ইন পণ্যের প্যাক সাইজ আর পাওয়া যাচ্ছে না।');
    product.markModified('variants');
    await product.save(transactionOptions(session));
  }
}

async function applyRequest(request, session) {
  const options = transactionOptions(session);
  const { requestType, targetId, original, originalUpdatedAt, proposed } = request;

  if (requestType === 'invoice_update') {
    const currentQuery = Invoice.findOne({ id: targetId });
    if (session) currentQuery.session(session);
    const current = await currentQuery.lean();
    if (!current || !revisionMatches(current, original, originalUpdatedAt)) {
      fail(409, 'অনুরোধ জমা হওয়ার পর ইনভয়েস পরিবর্তিত হয়েছে; নতুন করে পর্যালোচনা করুন।');
    }
    await applyInvoiceStockChanges(current, proposed, session);
    const filter = { id: targetId };
    if (originalUpdatedAt) filter.updatedAt = originalUpdatedAt;
    const saved = await Invoice.findOneAndUpdate(
      filter,
      { $set: proposed },
      { ...options, new: true, runValidators: true }
    ).lean();
    if (!saved) fail(409, 'ইনভয়েসটি আর হালনাগাদ করা যায়নি।');
    await syncInvoicePayment(saved, session);
    return;
  }

  if (requestType === 'payment_update') {
    const currentQuery = Payment.findOne({ id: targetId });
    if (session) currentQuery.session(session);
    const current = await currentQuery.lean();
    if (current) {
      if (!revisionMatches(current, original, originalUpdatedAt)) {
        fail(409, 'অনুরোধ জমা হওয়ার পর পেমেন্ট পরিবর্তিত হয়েছে; নতুন করে পর্যালোচনা করুন।');
      }
      const filter = { id: targetId };
      if (originalUpdatedAt) filter.updatedAt = originalUpdatedAt;
      const saved = await Payment.findOneAndUpdate(
        filter,
        { $set: proposed },
        { ...options, new: true, runValidators: true }
      ).lean();
      if (!saved) fail(409, 'পেমেন্টটি আর হালনাগাদ করা যায়নি।');
      await BusinessRecord.updateMany(
        {
          type: 'payments',
          $or: [{ recordId: targetId }, { 'data.id': targetId }]
        },
        { $set: { data: saved } },
        options
      );
    } else {
      const legacyFilter = {
        type: 'payments',
        $or: [{ recordId: targetId }, { 'data.id': targetId }]
      };
      const legacyQuery = BusinessRecord.findOne(legacyFilter);
      if (session) legacyQuery.session(session);
      const legacy = await legacyQuery.lean();
      if (!legacy || !revisionMatches(legacy, original, originalUpdatedAt)) {
        fail(409, 'অনুরোধ জমা হওয়ার পর পেমেন্ট পরিবর্তিত হয়েছে; নতুন করে পর্যালোচনা করুন।');
      }
      const filter = { type: 'payments', recordId: legacy.recordId };
      if (originalUpdatedAt) filter.updatedAt = originalUpdatedAt;
      const saved = await BusinessRecord.findOneAndUpdate(
        filter,
        { $set: { data: { ...legacy.data, ...proposed } } },
        { ...options, new: true }
      ).lean();
      if (!saved) fail(409, 'পেমেন্টটি আর হালনাগাদ করা যায়নি।');
    }
    return;
  }

  if (requestType === 'stock_in_update') {
    const filter = { type: 'stockInLogs', recordId: targetId };
    if (originalUpdatedAt) filter.updatedAt = originalUpdatedAt;
    const currentQuery = BusinessRecord.findOne(filter);
    if (session) currentQuery.session(session);
    const current = await currentQuery.lean();
    if (!current || !revisionMatches(current, original, originalUpdatedAt)) {
      fail(409, 'অনুরোধ জমা হওয়ার পর স্টক-ইন চালান পরিবর্তিত হয়েছে; নতুন করে সম্পাদনা করুন।');
    }
    await applyStockInRevision(current.data, proposed, session);
    const saved = await BusinessRecord.findOneAndUpdate(
      filter,
      { $set: { data: proposed } },
      { ...options, new: true }
    ).lean();
    if (!saved) fail(409, 'স্টক-ইন চালানটি আর হালনাগাদ করা যায়নি।');
    return;
  }

  if (requestType === 'officer_payment_submission') {
    const payment = proposed?.payment;
    if (!payment?.id || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) {
      fail(400, 'অফিসার পেমেন্টের প্রস্তাবটি সঠিক নয়।');
    }
    const existingQuery = Payment.findOne({ id: payment.id });
    if (session) existingQuery.session(session);
    if (await existingQuery.lean()) fail(409, 'এই পেমেন্টটি ইতোমধ্যে পোস্ট হয়েছে।');
    await Payment.create([payment], transactionCreateOptions(session));
    return;
  }

  fail(400, 'অনুমোদনের অনুরোধের ধরন সঠিক নয়।');
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['SuperAdmin', 'Admin', 'General Admin', 'MD', 'Chairman']);
  if (!user) return;
  try {
    if (req.method === 'GET') {
      const filter = {
        type: 'approvalRequests',
        'data.status': 'pending_super_admin_approval'
      };
      if (!await hasSuperAdminAccess(user)) {
        filter['data.requestType'] = 'officer_payment_submission';
      }
      const requests = await BusinessRecord.find(filter).sort({ createdAt: 1 }).lean();
      return res.status(200).json(requests.map((record) => record.data));
    }

    const id = String(req.body?.id || '').trim();
    const decision = String(req.body?.decision || '');
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!id || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'অনুমোদনের সঠিক সিদ্ধান্ত দিন।' });
    }
    if (decision === 'rejected' && !reason) {
      return res.status(400).json({ error: 'প্রত্যাখ্যানের কারণ লিখুন।' });
    }

    let result;
    await withTransactionFallback(async (session) => {
      const query = BusinessRecord.findOne({
        type: 'approvalRequests',
        recordId: id
      });
      if (session) query.session(session);
      const record = await query;
      if (!record || record.data?.status !== 'pending_super_admin_approval') {
        fail(404, 'অপেক্ষমাণ অনুমোদনের অনুরোধটি পাওয়া যায়নি।');
      }
      if (
        record.data.requestType !== 'officer_payment_submission'
        && !await hasSuperAdminAccess(user)
      ) {
        fail(403, 'এই পরিবর্তন শুধু সুপার অ্যাডমিন অনুমোদন করতে পারবেন।');
      }

      const decidedAt = new Date();
      if (decision === 'approved') await applyRequest(record.data, session);
      const updatedData = {
        ...record.data,
        status: decision,
        decidedBy: String(user.name || ''),
        decidedByRole: String(user.role || ''),
        decidedAt,
        ...(decision === 'rejected' ? { rejectionReason: reason } : {})
      };
      const updated = await BusinessRecord.findOneAndUpdate(
        {
          type: 'approvalRequests',
          recordId: id,
          'data.status': 'pending_super_admin_approval'
        },
        { $set: { data: updatedData } },
        { ...transactionOptions(session), new: true }
      ).lean();
      if (!updated) fail(409, 'অনুরোধটি অন্য একটি সিদ্ধান্তে নিষ্পত্তি হয়েছে।');
      result = updated.data;
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: 'প্রস্তাবিত পরিবর্তনের তথ্য সঠিক নয়।' });
    }
    console.error('Approval request operation failed:', error);
    return res.status(500).json({ error: 'অনুমোদনের অনুরোধ নিষ্পত্তি করা যায়নি।' });
  }
}
