import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import { Order, Product } from '../lib/models.js';
import { authorize } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(
    req,
    res,
    req.method === 'PATCH' ? ['admin'] : ['admin', 'officer']
  );
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const filter = user.role === 'admin' ? {} : { officerId: user.officerId };
      return res.status(200).json(await Order.find(filter).sort({ createdAt: -1 }).lean());
    }

    if (req.method === 'POST') {
      if (user.role !== 'officer') return res.status(403).json({ error: 'অর্ডার কেবল অফিসার জমা দিতে পারবেন।' });
      const requestedItems = req.body?.items;
      if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 50) {
        return res.status(400).json({ error: 'অর্ডারে ১ থেকে ৫০টি পণ্য থাকতে হবে।' });
      }

      const items = [];
      for (const requested of requestedItems) {
        const cartons = Number(requested?.cartons);
        if (!requested?.productId || !requested?.sku || !Number.isSafeInteger(cartons) || cartons < 1) {
          return res.status(400).json({ error: 'প্রতিটি পণ্যের সঠিক কার্টুন সংখ্যা দিন।' });
        }
        const product = await Product.findOne({ id: requested.productId }).lean();
        const variant = product?.variants?.find((entry) => entry.sku === requested.sku);
        if (!variant) return res.status(400).json({ error: 'নির্বাচিত পণ্য বা প্যাক সাইজ পাওয়া যায়নি।' });
        items.push({
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          size: variant.size,
          cartons,
          cartonPrice: Number(variant.cartonPrice) || 0
        });
      }

      const order = await Order.create({
        id: `ORD-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        officerId: user.officerId,
        officerCode: user.officerCode,
        officerName: user.name,
        items,
        note: String(req.body?.note || '').slice(0, 500),
        status: 'pending'
      });
      return res.status(201).json(order);
    }

    const { orderId, status, decisionNote } = req.body || {};
    if (!orderId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid order decision.' });
    }
    const session = await mongoose.startSession();
    let updatedOrder;
    try {
      await session.withTransaction(async () => {
        const pendingOrder = await Order.findOne({ id: orderId, status: 'pending' }).session(session);
        if (!pendingOrder) {
          const error = new Error('Pending order not found.');
          error.statusCode = 404;
          throw error;
        }

        if (status === 'approved') {
          const quantitiesByProduct = new Map();
          for (const item of pendingOrder.items) {
            const productItems = quantitiesByProduct.get(item.productId) || new Map();
            productItems.set(
              item.sku,
              (productItems.get(item.sku) || 0) + Number(item.cartons)
            );
            quantitiesByProduct.set(item.productId, productItems);
          }

          for (const [productId, quantitiesBySku] of quantitiesByProduct) {
            const product = await Product.findOne({ id: productId }).session(session);
            if (!product) {
              const error = new Error('অর্ডারের একটি পণ্য আর পাওয়া যাচ্ছে না।');
              error.statusCode = 409;
              throw error;
            }
            const variants = product.variants.map((variant) => {
              const cartons = quantitiesBySku.get(variant.sku) || 0;
              if (!cartons) return variant;
              const available = Number(variant.stockCartons) || 0;
              if (available < cartons) {
                const error = new Error(`${product.name} (${variant.size})-এর পর্যাপ্ত স্টক নেই।`);
                error.statusCode = 409;
                throw error;
              }
              const pieces = cartons * (Number(variant.packPerBox) || 1);
              return {
                ...variant,
                stockCartons: available - cartons,
                stock: Math.max(0, (Number(variant.stock) || 0) - pieces)
              };
            });
            product.variants = variants;
            await product.save({ session });
          }
        }

        pendingOrder.status = status;
        pendingOrder.decisionNote = String(decisionNote || '').slice(0, 500);
        pendingOrder.decidedAt = new Date();
        updatedOrder = await pendingOrder.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return res.status(200).json(updatedOrder);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Order operation failed:', error);
    return res.status(500).json({ error: 'অর্ডার সংরক্ষণ করা যায়নি।' });
  }
}
