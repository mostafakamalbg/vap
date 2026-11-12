import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice, Product } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import {
  isDealerAssignedToOfficer,
  normalizeDealerAssignment,
  normalizeOfficerCode
} from '../shared/codes.js';
import { getDealersWithOfficerCodes } from '../lib/dealerAssignments.js';

const recordTypes = new Set([
  'products',
  'officers',
  'dealers',
  'invoices',
  'stockInLogs',
  'damageLogs',
  'payments',
  'salesAgreements'
]);
const databaseModels = { products: Product, dealers: Dealer, invoices: Invoice };

function getRecordId(record, index) {
  return String(record?.id || record?.officerId || record?._id || `${Date.now()}-${index}`);
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
  if (req.method === 'PUT' && type === 'invoices') {
    return res.status(405).json({ error: 'ইনভয়েস সংরক্ষণ, সম্পাদনা ও মুছতে নির্দিষ্ট ইনভয়েস অপশন ব্যবহার করুন।' });
  }

  try {
    const Model = databaseModels[type];
    if (req.method === 'GET') {
      if (type === 'dealers') {
        const { officers, dealers } = await getDealersWithOfficerCodes();
        if (user.role === 'admin') return res.status(200).json(dealers);
        const normalizedUserCode = normalizeOfficerCode(user.officerCode);
        const officer = (user.officerId && officers.find((entry) => (
          String(entry.id || entry.officerId || '') === String(user.officerId || '')
        ))) || (normalizedUserCode && officers.find((entry) => (
          normalizeOfficerCode(entry.code, entry.designation) === normalizedUserCode
        )));
        const officerCode = user.officerCode || officer?.code;
        const designation = officer?.designation || '';
        return res.status(200).json(dealers.filter((dealer) => (
          isDealerAssignedToOfficer(dealer, officerCode, designation)
        )));
      }
      if (Model) {
        let filter = {};
        if (user.role !== 'admin' && type === 'invoices') {
          const officerCodeMatch = String(user.officerCode || '').match(/\d+/);
          const officerCodeDigits = officerCodeMatch ? String(Number(officerCodeMatch[0])) : '';
          const conditions = [
            ...(user.officerId ? [{ officerId: user.officerId }] : []),
            ...(officerCodeDigits ? [
              { officerId: `OFF-${officerCodeDigits.padStart(2, '0')}` },
              { officerCode: `SO-${officerCodeDigits.padStart(2, '0')}` }
            ] : []),
            ...(user.officerCode ? [
              { officerCode: user.officerCode },
              ...(officerCodeDigits ? [{ officerCode: officerCodeDigits }] : [])
            ] : [])
          ];
          filter = conditions.length ? { $or: conditions } : { id: '__no_records__' };
        }
        const query = Model.find(filter);
        if (type === 'invoices') query.sort({ createdAt: -1 });
        if (type === 'products') query.sort({ id: 1 });
        return res.status(200).json(await query.lean());
      }
      let filter = { type };
      if (user.role !== 'admin') {
        if (type === 'salesAgreements') {
          return res.status(403).json({ error: 'এই রেকর্ড দেখার অনুমতি নেই।' });
        }
        if (type === 'officers') {
          filter = { type, recordId: user.officerId };
        } else if (['stockInLogs', 'damageLogs', 'payments'].includes(type)) {
          const officerCodeMatch = String(user.officerCode || '').match(/\d+/);
          const officerCodeDigits = officerCodeMatch ? String(Number(officerCodeMatch[0])) : '';
          const ownerConditions = [
            ...(user.officerId ? [{ 'data.officerId': user.officerId }] : []),
            ...(user.officerCode ? [
              { 'data.officerCode': user.officerCode },
              ...(officerCodeDigits ? [{ 'data.officerCode': officerCodeDigits }] : [])
            ] : [])
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
      let normalizedRecords = records;
      if (type === 'dealers') {
        const officerRecords = await BusinessRecord.find({ type: 'officers' }).select('data').lean();
        const officers = officerRecords.map((record) => record.data).filter(Boolean);
        normalizedRecords = records.map((record) => normalizeDealerAssignment(record, officers));
      }
      await Model.deleteMany({});
      if (normalizedRecords.length) await Model.insertMany(normalizedRecords);
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
    return res.status(500).json({ error: 'রেকর্ড পড়া বা সংরক্ষণ করা যায়নি।' });
  }
}
