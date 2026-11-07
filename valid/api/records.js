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
  const user = await authorize(req, res, req.method === 'PUT' ? ['admin'] : ['admin', 'officer']);
  if (!user) return;

  const type = String(req.query?.type || '');
  if (!recordTypes.has(type)) return res.status(400).json({ error: 'Unknown record type.' });

  try {
    const Model = databaseModels[type];
    if (req.method === 'GET') {
      if (Model) {
        let filter = {};
        if (user.role !== 'admin' && type === 'dealers') {
          const conditions = [
            ...(user.officerId ? [{ assignedOfficerId: user.officerId }] : []),
            ...(user.officerCode ? [{ assignedOfficerCode: user.officerCode }, { officerCode: user.officerCode }] : [])
          ];
          filter = conditions.length ? { $or: conditions } : { id: '__no_records__' };
        } else if (user.role !== 'admin' && type === 'invoices') {
          const conditions = [
            ...(user.officerId ? [{ officerId: user.officerId }] : []),
            ...(user.officerCode ? [{ officerCode: user.officerCode }] : [])
          ];
          filter = conditions.length ? { $or: conditions } : { id: '__no_records__' };
        }
        const query = Model.find(filter);
        if (type === 'invoices') query.sort({ createdAt: -1 });
        if (type === 'dealers') query.sort({ code: 1 });
        if (type === 'products') query.sort({ id: 1 });
        return res.status(200).json(await query.lean());
      }
      let filter = { type };
      if (user.role !== 'admin') {
        if (type === 'officers') {
          filter = { type, recordId: user.officerId };
        } else if (['stockInLogs', 'damageLogs', 'payments'].includes(type)) {
          const ownerConditions = [
            ...(user.officerId ? [{ 'data.officerId': user.officerId }] : []),
            ...(user.officerCode ? [{ 'data.officerCode': user.officerCode }] : [])
          ];
          filter = { type, ...(ownerConditions.length ? { $or: ownerConditions } : { recordId: '__no_records__' }) };
        }
      }
      const records = await BusinessRecord.find(filter).lean();
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
