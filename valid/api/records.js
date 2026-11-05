import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice, Product } from '../lib/models.js';
import { authorize } from '../lib/auth.js';

const recordTypes = new Set([
  'products',
  'officers',
  'dealers',
  'invoices',
  'stockInLogs',
  'damageLogs',
  'payments'
]);
const databaseModels = { products: Product, dealers: Dealer, invoices: Invoice };

function getRecordId(record, index) {
  return String(record?.id || record?._id || `${Date.now()}-${index}`);
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  if (!await authorize(req, res, req.method === 'PUT' ? ['admin'] : ['admin', 'officer'])) return;

  const type = String(req.query?.type || '');
  if (!recordTypes.has(type)) return res.status(400).json({ error: 'Unknown record type.' });

  try {
    const Model = databaseModels[type];
    if (req.method === 'GET') {
      if (Model) {
        const query = Model.find({});
        if (type === 'invoices') query.sort({ createdAt: -1 });
        if (type === 'dealers') query.sort({ code: 1 });
        if (type === 'products') query.sort({ id: 1 });
        return res.status(200).json(await query.lean());
      }
      const records = await BusinessRecord.find({ type }).lean();
      return res.status(200).json(records.map((record) => record.data));
    }

    const records = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Expected an array of records.' });

    if (Model) {
      await Model.deleteMany({});
      if (records.length) await Model.insertMany(records);
    } else {
      await BusinessRecord.deleteMany({ type });
      if (records.length) {
        await BusinessRecord.insertMany(records.map((record, index) => ({
          type,
          recordId: getRecordId(record, index),
          data: record
        })));
      }
    }
    return res.status(200).json({ saved: records.length });
  } catch (error) {
    console.error(`Record sync failed for ${type}:`, error);
    return res.status(500).json({ error: 'ডেটা সংরক্ষণ করা যায়নি।' });
  }
}
