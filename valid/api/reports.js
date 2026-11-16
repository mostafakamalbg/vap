import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import { MonthlySalesCollection } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { normalizeMonthlySalesReport, validateMonthlySalesReport } from '../shared/salesReports.js';
import { normalizeOfficerCode } from '../shared/codes.js';

function getMonthFilter(value) {
  const month = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(month)) {
    const start = `${month}-01`;
    const [year, monthNumber] = month.split('-').map(Number);
    const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    return {
      $or: [
        { monthOfReport: month },
        { reportingDate: { $gte: start, $lt: end } }
      ]
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(month)) return { reportingDate: month };
  return { monthOfReport: month };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['admin', 'officer']);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const filters = [];
      if (req.query?.session) filters.push({ session: String(req.query.session) });
      if (req.query?.month) filters.push(getMonthFilter(req.query.month));
      if (req.query?.date) filters.push(getMonthFilter(req.query.date));
      if (user.role !== 'admin') {
        const code = normalizeOfficerCode(user.officerCode);
        const ownerConditions = [
          ...(user.officerId ? [{ officerId: String(user.officerId) }] : []),
          ...(code ? [
            { officerCode: code },
            { officerCode: String(user.officerCode) }
          ] : [])
        ];
        filters.push(ownerConditions.length ? { $or: ownerConditions } : { _id: null });
      }
      const query = filters.length ? { $and: filters } : {};
      const records = await MonthlySalesCollection.find(query).sort({
        reportingDate: -1,
        createdAt: -1
      }).lean();
      return res.status(200).json(records.map((record) => ({
        ...record,
        ...normalizeMonthlySalesReport(record)
      })));
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'এই রিপোর্ট পরিবর্তনের অনুমতি নেই।' });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || req.body?.id || '');
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'সঠিক রিপোর্ট নির্বাচন করুন।' });
      }
      const result = await MonthlySalesCollection.deleteOne({ _id: id });
      if (!result.deletedCount) return res.status(404).json({ error: 'রিপোর্টটি পাওয়া যায়নি।' });
      return res.status(200).json({ deleted: true });
    }

    const report = req.body;
    const validationError = validateMonthlySalesReport(report);
    if (validationError) return res.status(400).json({ error: validationError });
    const normalized = normalizeMonthlySalesReport(report);

    if (req.method === 'POST') {
      const saved = await MonthlySalesCollection.create(normalized);
      return res.status(201).json(saved);
    }
    if (!mongoose.isValidObjectId(report?._id)) {
      return res.status(400).json({ error: 'সঠিক রিপোর্ট নির্বাচন করুন।' });
    }
    const saved = await MonthlySalesCollection.findByIdAndUpdate(
      report._id,
      { $set: normalized },
      { new: true, runValidators: true }
    );
    if (!saved) return res.status(404).json({ error: 'রিপোর্টটি পাওয়া যায়নি।' });
    return res.status(200).json(saved);
  } catch (error) {
    console.error('Monthly sales report request failed:', error);
    return res.status(500).json({ error: 'মাসিক বিক্রয় রিপোর্ট পড়া বা সংরক্ষণ করা যায়নি।' });
  }
}
