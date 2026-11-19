import dbConnect from '../lib/mongodb.js';
import { authorize, verifyPassword } from '../lib/auth.js';
import { ADMIN_ROLES } from '../shared/roles.js';
import { User } from '../lib/models.js';
import { BusinessRecord, Dealer, Invoice, Order, Payment, Product } from '../lib/models.js';
import { normalizeDealerAssignment } from '../shared/codes.js';
import { normalizePaymentMethod, normalizePaymentType } from '../shared/paymentMethods.js';
import { roundCurrency } from '../shared/invoiceTotals.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { rebuildStockBalances, STOCK_RECONCILIATION_START_DATE } from '../shared/stockReconciliation.js';
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
const databaseModels = { products: Product, dealers: Dealer, invoices: Invoice, payments: Payment };

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
    let records = type === 'dealers'
      ? data[type].map((record) => normalizeDealerAssignment(record, data.officers))
      : data[type];
    if (type === 'payments') {
      records = records.map((record, index) => ({
        ...record,
        id: String(record.id || `PAY-BACKUP-${index}`),
        paymentType: normalizePaymentType(record.paymentType),
        amount: roundCurrency(record.amount),
        paymentMethod: normalizePaymentMethod(record.paymentMethod)
      }));
    }
    const Model = databaseModels[type];
    if (Model) {
      await Model.deleteMany({}, options);
      if (records.length) await Model.insertMany(records, options);
      if (type === 'payments') await BusinessRecord.deleteMany({ type: 'payments' }, options);
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
    const options = transactionOptions(session);
    if (clearOrders) await Order.deleteMany({}, options);
    await replaceRecords(data, session);
  });
}

async function restoreFactoryData() {
  const data = getFactoryData();
  await replaceWithTransaction(data, { clearOrders: true });
}

async function recalculateStock(startDate) {
  let summary;
  await withTransactionFallback(async (session) => {
    const options = transactionOptions(session);
    let productsQuery = Product.find({});
    let invoicesQuery = Invoice.find({}).select('id date invoiceType items').lean();
    let stockInQuery = BusinessRecord.find({ type: 'stockInLogs' }).select('data').lean();
    if (session) {
      productsQuery = productsQuery.session(session);
      invoicesQuery = invoicesQuery.session(session);
      stockInQuery = stockInQuery.session(session);
    }
    const [products, invoices, stockInRecords] = await Promise.all([
      productsQuery,
      invoicesQuery,
      stockInQuery
    ]);
    const rebuilt = rebuildStockBalances(
      products.map((product) => product.toObject()),
      invoices,
      stockInRecords.map((record) => record.data),
      startDate
    );
    if (rebuilt.products.length) {
      await Product.bulkWrite(rebuilt.products.map((product) => ({
        updateOne: {
          filter: { id: product.id },
          update: {
            $set: {
              variants: product.variants
            }
          }
        }
      })), options);
    }
    summary = {
      products: rebuilt.products.length,
      invoices: rebuilt.invoiceCount,
      stockInLogs: rebuilt.stockInCount,
      startDate: rebuilt.startDate
    };
  });
  return summary;
}

export default async function handler(req, res) {
  if (!['PUT', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ADMIN_ROLES);
  if (!user) return;
  const password = String(req.body?.password || '');
  const credential = await User.findById(user._id).select('+passwordHash').lean();
  if (!password || !credential || !await verifyPassword(password, credential.passwordHash)) {
    return res.status(401).json({ error: 'সঠিক অ্যাডমিন পাসওয়ার্ড দিন।' });
  }

  if (req.method === 'POST') {
    if (!['factory-reset', 'recalculate-stock'].includes(req.body?.action)) {
      return res.status(400).json({ error: 'Invalid reset request.' });
    }
    const isStockRecalculation = req.body.action === 'recalculate-stock';
    const requiredConfirmation = isStockRecalculation ? 'RECALCULATE' : 'RESET';
    if (req.body.confirmationText !== requiredConfirmation) {
      return res.status(400).json({
        error: isStockRecalculation
          ? 'স্টক পুনর্গণনা নিশ্চিত করতে RECALCULATE লিখুন।'
          : 'রিসেট নিশ্চিত করতে RESET লিখুন।'
      });
    }
    let stage = 'ডেটাবেসের রেকর্ড';
    try {
      if (isStockRecalculation) {
        const startDate = String(req.body.startDate || '');
        if (startDate !== STOCK_RECONCILIATION_START_DATE) {
          return res.status(400).json({ error: 'স্টক পুনর্গণনার শুরুর তারিখ সঠিক নয়।' });
        }
        stage = 'ইনভয়েস ও স্টক-ইন লেজার থেকে পণ্যের স্টক পুনর্গণনা';
        const recalculated = await recalculateStock(startDate);
        return res.status(200).json({
          message: 'ইনভয়েস, ডিলার লেজার ও স্টক-ইন ইতিহাস অক্ষত রেখে স্টক পুনর্গণনা হয়েছে।',
          ...recalculated
        });
      }
      stage = 'ফ্যাক্টরি ডেটা পুনরুদ্ধার';
      await restoreFactoryData();
      return res.status(200).json({ message: 'ফ্যাক্টরি ডেটা পুনরুদ্ধার হয়েছে।' });
    } catch (error) {
      console.error('Data reset failed:', { action: req.body.action, stage, error });
      const errorMessage = isStockRecalculation
        ? `স্টক পুনর্গণনা করা যায়নি (${stage} ধাপ)। ${error.message}`
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
