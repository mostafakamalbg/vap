import dbConnect from '../lib/mongodb.js';
import { Product } from '../lib/models.js';
import { authorize } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  if (req.method === 'POST') {
    if (!await authorize(req, res, ['admin'])) return;
  } else if (!await authorize(req, res, ['admin', 'officer'])) {
    return;
  }
  if (req.method === 'GET') {
    try {
      const products = await Product.find({}).sort({ id: 1 });
      return res.status(200).json(products.map((product) => product.toObject()));
    } catch (error) {
      console.error('Product lookup failed:', error);
      return res.status(500).json({ error: 'পণ্য লোড করা যায়নি।' });
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
      console.error('Product save failed:', error);
      return res.status(500).json({ error: 'পণ্য সংরক্ষণ করা যায়নি।' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
