import dbConnect from '../lib/mongodb.js';
import { Product } from '../lib/models.js';

export default async function handler(req, res) {
  const conn = await dbConnect();

  if (!conn) {
    return res.status(200).json([]);
  }

  if (req.method === 'GET') {
    try {
      const products = await Product.find({}).sort({ id: 1 });
      return res.status(200).json(products);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const product = await Product.findOneAndUpdate(
        { id: req.body.id },
        req.body,
        { upsert: true, new: true }
      );
      return res.status(201).json(product);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
