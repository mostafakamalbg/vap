import dbConnect from '../lib/mongodb.js';
import { Invoice } from '../lib/models.js';

export default async function handler(req, res) {
  const conn = await dbConnect();

  if (!conn) {
    // If MongoDB is not yet configured, return empty array with 200 so frontend falls back to localStorage
    return res.status(200).json([]);
  }

  if (req.method === 'GET') {
    try {
      const invoices = await Invoice.find({}).sort({ createdAt: -1 });
      return res.status(200).json(invoices);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const newInvoice = await Invoice.findOneAndUpdate(
        { id: req.body.id },
        req.body,
        { upsert: true, new: true }
      );
      return res.status(201).json(newInvoice);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
