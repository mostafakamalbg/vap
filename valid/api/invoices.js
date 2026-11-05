import dbConnect from '../lib/mongodb.js';
import { Invoice } from '../lib/models.js';
import { authorize } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  if (req.method === 'GET') {
    if (!await authorize(req, res, ['admin', 'officer'])) return;
  } else if (req.method === 'POST') {
    if (!await authorize(req, res, ['admin'])) return;
  }

  if (req.method === 'GET') {
    try {
      const invoices = await Invoice.find({}).sort({ createdAt: -1 });
      return res.status(200).json(invoices);
    } catch (error) {
      console.error('Invoice lookup failed:', error);
      return res.status(500).json({ error: 'চালান লোড করা যায়নি।' });
    }
  } else if (req.method === 'POST') {
    try {
      const newInvoice = await Invoice.findOneAndUpdate(
        { id: req.body.id },
        req.body,
        { upsert: true, new: true }
      );
      return res.status(201).json(newInvoice);
    } catch (error) {
      console.error('Invoice save failed:', error);
      return res.status(500).json({ error: 'চালান সংরক্ষণ করা যায়নি।' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
