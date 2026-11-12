import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import { Invoice, Order, Product } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { getBangladeshBusinessDate, getInvoiceSessionForDate } from '../shared/sessions.js';
import { isDealerAssignedToOfficer, normalizeOfficerCode } from '../shared/codes.js';
import { getDealersWithOfficerCodes } from '../lib/dealerAssignments.js';

const invoiceIdPattern = /^VAP-(\d{4})-(\d+)$/;

async function getNextInvoiceNumber(year) {
  const [invoices, orders] = await Promise.all([
    Invoice.find({}).select('id').lean(),
    Order.find({ invoiceNo: { $exists: true, $ne: '' } }).select('invoiceNo').lean()
  ]);
  const maxSequence = [...invoices.map((invoice) => invoice.id), ...orders.map((order) => order.invoiceNo)]
    .reduce((max, id) => {
      const match = String(id || '').match(invoiceIdPattern);
      return match && Number(match[1]) === year ? Math.max(max, Number(match[2]) || 0) : max;
    }, 0);
  const seqNumber = maxSequence + 1;
  return {
    invoiceNo: `VAP-${year}-${String(seqNumber).padStart(4, '0')}`,
    seqNumber
  };
}

async function loadOrderItems(requestedItems, session = null) {
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 50) {
    const error = new Error('অর্ডারে ১ থেকে ৫০টি পণ্য থাকতে হবে।');
    error.statusCode = 400;
    throw error;
  }

  const items = [];
  for (const requested of requestedItems) {
    const cartons = Number(requested?.cartons);
    if (!requested?.productId || !requested?.sku || !Number.isSafeInteger(cartons) || cartons < 1) {
      const error = new Error('প্রতিটি পণ্যের সঠিক কার্টুন সংখ্যা দিন।');
      error.statusCode = 400;
      throw error;
    }
    const productQuery = Product.findOne({ id: requested.productId });
    if (session) productQuery.session(session);
    const product = await productQuery.lean();
    const variant = product?.variants?.find((entry) => entry.sku === requested.sku);
    if (!variant) {
      const error = new Error('নির্বাচিত পণ্য বা প্যাক সাইজ পাওয়া যায়নি।');
      error.statusCode = 400;
      throw error;
    }
    items.push({
      productId: product.id,
      productName: product.name,
      sku: variant.sku,
      size: variant.size,
      packPerBox: Number(variant.packPerBox) || 1,
      cartons,
      cartonPrice: Number(variant.cartonPrice) || 0,
      commission: Number(variant.commission) || 0
    });
  }
  return items;
}

async function getAssignedDealer(user, dealerId) {
  const normalizedCode = normalizeOfficerCode(user.officerCode);
  const { officers, dealers } = await getDealersWithOfficerCodes();
  const officer = (user.officerId && officers.find((entry) => (
    String(entry.id || entry.officerId || '') === String(user.officerId || '')
  ))) || (normalizedCode && officers.find((entry) => (
    normalizeOfficerCode(entry.code, entry.designation) === normalizedCode
  )));
  const dealer = dealers.find((entry) => entry.id === String(dealerId || ''));
  return isDealerAssignedToOfficer(
    dealer,
    user.officerCode || officer?.code,
    officer?.designation
  ) ? dealer : null;
}

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
      const dealer = await getAssignedDealer(user, req.body?.dealerId);
      if (!dealer) return res.status(400).json({ error: 'আপনার কোডের সঙ্গে যুক্ত ডিলার নির্বাচন করুন।' });
      const date = getBangladeshBusinessDate();
      const invoiceSession = getInvoiceSessionForDate(date);
      if (!invoiceSession) return res.status(400).json({ error: 'এই তারিখের জন্য ইনভয়েস সেশন নির্ধারিত নেই।' });

      const items = await loadOrderItems(req.body?.items);
      let order;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const year = Number(date.slice(0, 4));
        const number = await getNextInvoiceNumber(year);
        try {
          order = await Order.create({
            id: `ORD-${year}-${randomUUID().slice(0, 8).toUpperCase()}`,
            invoiceNo: number.invoiceNo,
            seqNumber: number.seqNumber,
            date,
            session: invoiceSession,
            dealerId: dealer.id,
            dealerCode: dealer.code,
            dealerName: dealer.shopName,
            dealerProprietor: dealer.proprietor || '',
            dealerAddress: dealer.address || '',
            dealerPhone: dealer.phone || '',
            officerId: user.officerId,
            officerCode: user.officerCode,
            officerName: user.name,
            items,
            note: String(req.body?.note || '').slice(0, 500),
            status: 'pending'
          });
          break;
        } catch (error) {
          if (error?.code !== 11000 || !error.keyPattern?.invoiceNo) throw error;
        }
      }
      if (!order) return res.status(409).json({ error: 'ইনভয়েস নম্বর তৈরি করা যায়নি; আবার চেষ্টা করুন।' });
      return res.status(201).json(order);
    }

    const { orderId, status, decisionNote } = req.body || {};
    if (!orderId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid order decision.' });
    }
    const session = await mongoose.startSession();
    let updatedOrder;
    let createdInvoice;
    try {
      await session.withTransaction(async () => {
        const pendingOrder = await Order.findOne({ id: orderId, status: 'pending' }).session(session);
        if (!pendingOrder) {
          const error = new Error('Pending order not found.');
          error.statusCode = 404;
          throw error;
        }

        if (status === 'approved') {
          if (req.body?.items != null) {
            pendingOrder.items = await loadOrderItems(req.body.items, session);
          }
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

          const items = pendingOrder.items.map((item) => {
            const cartons = Number(item.cartons) || 0;
            const cartonPrice = Number(item.cartonPrice) || 0;
            return {
              ...item.toObject(),
              cartons,
              quantity: cartons,
              totalPieces: cartons * (Number(item.packPerBox) || 1),
              unitPrice: cartonPrice / (Number(item.packPerBox) || 1),
              total: cartons * cartonPrice
            };
          });
          const subtotal = items.reduce((sum, item) => sum + item.total, 0);
          const commissionAmount = items.reduce(
            (sum, item) => sum + item.total * (Number(item.commission) || 0) / 100,
            0
          );
          const totalAmount = Math.max(0, subtotal - commissionAmount);
          const invoiceValues = {
            id: pendingOrder.invoiceNo,
            invoiceNo: pendingOrder.invoiceNo,
            seqNumber: pendingOrder.seqNumber,
            date: pendingOrder.date,
            session: pendingOrder.session,
            officerId: pendingOrder.officerId,
            officerCode: pendingOrder.officerCode,
            officerName: pendingOrder.officerName,
            dealerId: pendingOrder.dealerId,
            dealerCode: pendingOrder.dealerCode,
            dealerName: pendingOrder.dealerName,
            dealerProprietor: pendingOrder.dealerProprietor,
            dealerAddress: pendingOrder.dealerAddress,
            dealerPhone: pendingOrder.dealerPhone,
            items,
            totalCartons: items.reduce((sum, item) => sum + item.cartons, 0),
            subtotal,
            commissionAmount,
            totalAmount,
            grandTotal: totalAmount,
            paidAmount: 0,
            currentDue: totalAmount,
            dueAmount: totalAmount,
            paymentMethod: 'credit',
            invoiceType: 'regular',
            previousDue: 0,
            netPayable: totalAmount,
            note: pendingOrder.note || ''
          };
          [createdInvoice] = await Invoice.create([invoiceValues], { session });
        }

        pendingOrder.status = status;
        pendingOrder.decisionNote = String(decisionNote || '').slice(0, 500);
        pendingOrder.decidedAt = new Date();
        updatedOrder = await pendingOrder.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return res.status(200).json({
      order: updatedOrder,
      invoice: createdInvoice?.toObject() || null
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error?.code === 11000) return res.status(409).json({ error: 'ইনভয়েস নম্বরটি অন্য একটি অর্ডারে সংরক্ষিত হয়েছে। আবার অর্ডার দিন।' });
    console.error('Order operation failed:', error);
    return res.status(500).json({ error: 'অর্ডার সংরক্ষণ করা যায়নি।' });
  }
}
