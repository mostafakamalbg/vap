import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import { authorize, hasSuperAdminAccess, verifyPassword } from '../lib/auth.js';
import { User } from '../lib/models.js';
import { BusinessRecord, Dealer, Invoice, Product } from '../lib/models.js';
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

async function replaceRecords(data, session) {
  for (const type of recordTypes) {
    const records = data[type];
    const Model = databaseModels[type];
    if (Model) {
      await Model.deleteMany({}, { session });
      if (records.length) await Model.insertMany(records, { session });
      continue;
    }

    await BusinessRecord.deleteMany({ type }, { session });
    if (records.length) {
      await BusinessRecord.insertMany(records.map((record, index) => ({
        type,
        recordId: String(record.id || record.officerId || record._id || `${type}-${index}`),
        data: record
      })), { session });
    }
  }
}

async function replaceWithTransaction(data) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => replaceRecords(data, session));
  } finally {
    await session.endSession();
  }
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
    if (req.body?.action !== 'factory-reset') {
      return res.status(400).json({ error: 'Invalid reset request.' });
    }
    try {
      if (!await hasSuperAdminAccess(user)) {
        return res.status(403).json({ error: 'এই রিসেট ব্যবহারের অনুমতি নেই।' });
      }
      await replaceWithTransaction(getFactoryData());
      return res.status(200).json({ message: 'ফ্যাক্টরি ডেটা পুনরুদ্ধার হয়েছে।' });
    } catch (error) {
      console.error('Factory reset failed:', error);
      return res.status(500).json({ error: 'ফ্যাক্টরি ডেটা পুনরুদ্ধার করা যায়নি।' });
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