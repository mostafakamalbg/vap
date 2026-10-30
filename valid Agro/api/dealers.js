import dbConnect from '../lib/mongodb.js';
import { Dealer } from '../lib/models.js';

export default async function handler(req, res) {
  const conn = await dbConnect();

  if (!conn) {
    return res.status(200).json([]);
  }

  if (req.method === 'GET') {
    try {
      const dealers = await Dealer.find({}).sort({ code: 1 });
      return res.status(200).json(dealers);
    } catch (error) {
      return res.status(500).json({ error: error.message });
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
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
