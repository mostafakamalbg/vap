import dbConnect from '../lib/mongodb.js';
import { Dealer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['admin', 'officer']);
  if (!user) return;
  if (req.method === 'POST' && user.role !== 'admin') {
    return res.status(403).json({ error: 'এই কাজের অনুমতি নেই।' });
  }
  if (req.method === 'GET') {
    try {
      const dealers = await Dealer.find({}).sort({ code: 1 });
      return res.status(200).json(dealers);
    } catch (error) {
      console.error('Dealer lookup failed:', error);
      return res.status(500).json({ error: 'ডিলার লোড করা যায়নি।' });
    }
  }

  if (req.method === 'POST') {
    try {
      const newDealer = await Dealer.findOneAndUpdate(
        { id: req.body.id },
        req.body,
        { upsert: true, new: true }
      );
      return res.status(201).json(newDealer);
    } catch (error) {
      console.error('Dealer save failed:', error);
      return res.status(500).json({ error: 'ডিলার সংরক্ষণ করা যায়নি।' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
