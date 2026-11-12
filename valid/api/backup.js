import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import { authorize, hasSuperAdminAccess, verifyPassword } from '../lib/auth.js';
import { User } from '../lib/models.js';
import { BusinessRecord, Dealer, Invoice, Order, Product } from '../lib/models.js';
import { normalizeDealerAssignment } from '../shared/codes.js';
import {
  INITIAL_DAMAGES,
  INITIAL_DEALERS,
  INITIAL_INVOICES,
  INITIAL_OFFICERS,
  INITIAL_PAYMENTS,
  INITIAL_PRODUCTS,
  INITIAL_STOCK_IN
} from '../src/data/initialData.js';

const recordTypes = [
  'products',
  'officers',
  'dealers',
  'invoices',
  'stockInLogs',
  'damageLogs',
  'payments',
  'salesAgreements'
];
const databaseModels = { products: Product, dealers: Dealer, invoices: Invoice };

function getFactoryData() {
  return {
    products: INITIAL_PRODUCTS,
    officers: INITIAL_OFFICERS,
    dealers: INITIAL_DEALERS,
    invoices: INITIAL_INVOICES,
    stockInLogs: INITIAL_STOCK_IN,
    damageLogs: INITIAL_DAMAGES,
    payments: INITIAL_PAYMENTS,
    salesAgreements: []
  };
}

function isValidBackup(value) {
  return value?.version === 1
    && recordTypes.every((type) => (
      Array.isArray(value.data?.[type])
      && value.data[type].every((record) => (
        record && typeof record === 'object' && !Array.isArray(record)
      ))
    ));
}

async function replaceRecords(data, session = null) {
  const options = session ? { session } : {};
  for (const type of recordTypes) {
    const records = type === 'dealers'
      ? data[type].map((record) => normalizeDealerAssignment(record, data.officers))
      : data[type];
    const Model = databaseModels[type];
    if (Model) {
      await Model.deleteMany({}, options);
      if (records.length) await Model.insertMany(records, options);
      continue;
    }

    await BusinessRecord.deleteMany({ type }, options);
    if (records.length) {
      await BusinessRecord.insertMany(records.map((record, index) => ({
        type,
        recordId: String(record.id || record.officerId || record._id || `${type}-${index}`),
        data: record
      })), options);
    }
  }
}

async function replaceWithTransaction(data, { clearOrders = false } = {}) {
  await withTransactionFallback(async (session) => {
    const options = session ? { session } : {};
    if (clearOrders) await Order.deleteMany({}, options);
    await replaceRecords(data, session);
  });
}

function doesNotSupportTransactions(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 20
    || message.includes('transaction numbers are only allowed')
    || message.includes('transactions are not supported');
}

async function withTransactionFallback(operation) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => operation(session));
  } catch (error) {
    if (!doesNotSupportTransactions(error)) throw error;
    await operation(null);
  } finally {
    await session.endSession();
  }
}

async function restoreFactoryData() {
  const data = getFactoryData();
  await replaceWithTransaction(data, { clearOrders: true });
}

async function clearSalesAndStock(setStage) {
  await withTransactionFallback(async (session) => {
    const options = session ? { session } : {};
    setStage('ইনভয়েস, অর্ডার ও হিসাবের রেকর্ড মুছে ফেলা');
    await Invoice.deleteMany({}, options);
    await Order.deleteMany({}, options);
    await BusinessRecord.deleteMany({
      type: { $in: ['invoices', 'damageLogs', 'stockInLogs', 'payments', 'salesAgreements'] }
    }, options);
    setStage('ডিলারের বকেয়া শূন্য করা');
    await Dealer.updateMany({}, { $set: { openingDue: 0 } }, options);
    setStage('পণ্যের স্টক শূন্য করা');
    await Product.updateMany({ variants: { $type: 'array' } }, {
      $set: {
        'variants.$[].stock': 0,
        'variants.$[].stockCartons': 0
      }
    }, options);
  });
}

export default async function handler(req, res) {
  if (!['PUT', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['admin']);
  if (!user) return;
  const password = String(req.body?.password || '');
  const credential = await User.findById(user._id).select('+passwordHash').lean();
  if (!password || !credential || !await verifyPassword(password, credential.passwordHash)) {
    return res.status(401).json({ error: 'সঠিক অ্যাডমিন পাসওয়ার্ড দিন।' });
  }

  if (req.method === 'POST') {
    if (!['factory-reset', 'clear-sales-stock'].includes(req.body?.action)) {
      return res.status(400).json({ error: 'Invalid reset request.' });
    }
    let stage = 'ডেটাবেসের রেকর্ড';
    try {
      if (req.body.action === 'factory-reset' && !await hasSuperAdminAccess(user)) {
        return res.status(403).json({ error: 'এই রিসেট ব্যবহারের অনুমতি নেই।' });
      }
      if (req.body.action === 'clear-sales-stock') {
        const [invoiceCount, orderCount, damageCount, stockInCount, paymentCount, agreementCount] = await Promise.all([
          Invoice.countDocuments({}),
          Order.countDocuments({}),
          BusinessRecord.countDocuments({ type: 'damageLogs' }),
          BusinessRecord.countDocuments({ type: 'stockInLogs' }),
          BusinessRecord.countDocuments({ type: 'payments' }),
          BusinessRecord.countDocuments({ type: 'salesAgreements' })
        ]);

        await clearSalesAndStock((nextStage) => {
          stage = nextStage;
        });

        const deletedCounts = {
          invoices: invoiceCount,
          orders: orderCount,
          damages: damageCount,
          stockInLogs: stockInCount,
          payments: paymentCount,
          salesAgreements: agreementCount
        };
        return res.status(200).json({
          message: 'ইনভয়েস, অর্ডার, ড্যামেজ, স্টক-ইন, পেমেন্ট ও সেলস চুক্তি মুছে বকেয়া এবং পণ্যের স্টক শূন্য করা হয়েছে।',
          deleted: deletedCounts
        });
      }
      stage = 'ফ্যাক্টরি ডেটা পুনরুদ্ধার';
      await restoreFactoryData();
      return res.status(200).json({ message: 'ফ্যাক্টরি ডেটা পুনরুদ্ধার হয়েছে।' });
    } catch (error) {
      console.error('Data reset failed:', { action: req.body.action, stage, error });
      const errorMessage = req.body.action === 'clear-sales-stock'
        ? `ডেটা মুছতে ব্যর্থ হয়েছে (${stage} ধাপ)। অনুগ্রহ করে আবার চেষ্টা করুন।`
        : 'ফ্যাক্টরি ডেটা পুনরুদ্ধার করা যায়নি।';
      return res.status(500).json({ error: errorMessage });
    }
  }

  if (!isValidBackup(req.body)) {
    return res.status(400).json({ error: 'সঠিক JSON ব্যাকআপ নির্বাচন করুন; সব ডেটা তালিকা থাকা আবশ্যক।' });
  }
  try {
    await replaceWithTransaction(req.body.data);
    return res.status(200).json({ imported: recordTypes.length });
  } catch (error) {
    console.error('Backup import failed:', error);
    return res.status(500).json({ error: 'ব্যাকআপ ইমপোর্ট করা যায়নি; ডেটা পরিবর্তন সম্পন্ন হয়নি।' });
  }
}
