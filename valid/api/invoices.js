import dbConnect from '../lib/mongodb.js';
import { Invoice } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { INVOICE_SESSIONS } from '../shared/sessions.js';
import { normalizePaymentMethod } from '../shared/paymentMethods.js';

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

function validateInvoice(body) {
  if (!body?.id || !isValidDate(body.date) || !INVOICE_SESSIONS.includes(body.session)) {
    return 'ইনভয়েস নম্বর, সঠিক তারিখ ও সেশন নির্বাচন করুন।';
  }
  if (!body.officerId || !body.dealerId) return 'সেলস অফিসার ও ডিলার নির্বাচন করুন।';
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return 'ইনভয়েসে ১ থেকে ৫০টি পণ্য থাকতে হবে।';
  }
  if (body.returnAdjustments != null && (
    !Array.isArray(body.returnAdjustments)
    || body.returnAdjustments.length > 50
    || body.returnAdjustments.some((item) => (
      !item?.productId
      || !Number.isSafeInteger(Number(item.quantity ?? item.quantityPieces))
      || Number(item.quantity ?? item.quantityPieces) <= 0
      || !Number.isFinite(Number(item.price ?? item.unitPrice))
      || Number(item.price ?? item.unitPrice) < 0
    ))
  )) {
    return 'ফেরত পণ্যের সঠিক পরিমাণ ও দর দিন।';
  }
  const invalidItem = body.items.some((item) => (
    !item?.productId
    || !item?.sku
    || !Number.isSafeInteger(Number(item.cartons ?? item.quantity))
    || Number(item.cartons ?? item.quantity) <= 0
    || !Number.isFinite(Number(item.unitPrice))
    || Number(item.unitPrice) < 0
  ));
  if (invalidItem) return 'প্রতিটি পণ্যের সঠিক পরিমাণ ও একক মূল্য দিন।';
  for (const field of ['totalAmount', 'grandTotal', 'paidAmount', 'dueAmount', 'currentDue']) {
    if (body[field] != null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) {
      return 'ইনভয়েসের টাকার পরিমাণ সঠিক নয়।';
    }
  }
  return '';
}

function invoiceValues(body) {
  const items = body.items.map((item) => ({
    ...item,
    cartons: Number(item.cartons ?? item.quantity),
    quantity: Number(item.quantity ?? item.cartons),
    unitPrice: Number(item.unitPrice),
    total: Number(item.total ?? Number(item.unitPrice) * Number(item.cartons ?? item.quantity))
  }));
  const totalAmount = Number(body.totalAmount ?? body.grandTotal ?? 0);
  const previousDue = Number(body.previousDue) || 0;
  const netPayable = totalAmount + previousDue;
  const paymentMethod = normalizePaymentMethod(body.paymentMethod);
  const paidAmount = paymentMethod === 'credit' ? 0 : Number(body.paidAmount) || 0;
  const dueAmount = paymentMethod === 'credit'
    ? Math.max(0, netPayable - paidAmount)
    : Number(body.dueAmount ?? body.currentDue ?? 0);
  const returnAdjustments = (body.returnAdjustments || []).map((item) => ({
    ...item,
    quantity: Number(item.quantity ?? item.quantityPieces),
    quantityPieces: Number(item.quantityPieces ?? item.quantity),
    price: Number(item.price ?? item.unitPrice),
    unitPrice: Number(item.unitPrice ?? item.price),
    total: Number(item.price ?? item.unitPrice) * Number(item.quantity ?? item.quantityPieces)
  }));
  return {
    id: String(body.id).trim(),
    invoiceNo: String(body.invoiceNo || body.id).trim(),
    date: body.date,
    session: body.session,
    officerId: String(body.officerId),
    officerCode: String(body.officerCode || ''),
    officerName: String(body.officerName || ''),
    officerDesignation: String(body.officerDesignation || ''),
    dealerId: String(body.dealerId),
    dealerCode: String(body.dealerCode || ''),
    dealerName: String(body.dealerName || ''),
    items,
    subtotal: Number(body.subtotal ?? totalAmount),
    grandTotal: Number(body.grandTotal ?? totalAmount),
    totalAmount,
    paidAmount,
    currentDue: paymentMethod === 'credit' ? dueAmount : Number(body.currentDue ?? dueAmount),
    dueAmount,
    invoiceType: String(body.invoiceType || 'regular'),
    seqNumber: Number(body.seqNumber) || 0,
    commissionAmount: Number(body.commissionAmount) || 0,
    transportCost: Number(body.transportCost) || 0,
    returnAdjustments,
    returnAdjustmentTotal: returnAdjustments.reduce((sum, item) => sum + item.total, 0),
    previousDue,
    netPayable,
    paymentMethod,
    transport: String(body.transport || ''),
    note: String(body.note || '').slice(0, 1000)
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const user = await authorize(
      req,
      res,
      req.method === 'GET' ? ['admin', 'officer'] : ['admin']
    );
    if (!user) return;

    if (req.method === 'GET') {
      const ownerConditions = [
        ...(user.officerId ? [{ officerId: user.officerId }] : []),
        ...(user.officerCode ? [{ officerCode: user.officerCode }] : [])
      ];
      const filter = user.role === 'admin'
        ? {}
        : ownerConditions.length ? { $or: ownerConditions } : { id: '__no_records__' };
      return res.status(200).json(await Invoice.find(filter).sort({ date: -1, createdAt: -1 }).lean());
    }

    const input = req.method === 'PATCH' ? req.body?.invoice : req.body;
    const validationError = validateInvoice(input);
    if (validationError) return res.status(400).json({ error: validationError });

    const values = invoiceValues(input);
    if (req.method === 'POST') {
      const invoice = await Invoice.create(values);
      return res.status(201).json(invoice.toObject());
    }

    const invoice = await Invoice.findOneAndUpdate(
      { id: values.id },
      { $set: values },
      { new: true, runValidators: true }
    ).lean();
    if (!invoice) return res.status(404).json({ error: 'ইনভয়েস পাওয়া যায়নি।' });
    return res.status(200).json(invoice);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'এই ইনভয়েস নম্বরটি আগে থেকেই আছে।' });
    console.error('Invoice operation failed:', error);
    return res.status(500).json({ error: 'ইনভয়েস সংরক্ষণ করা যায়নি।' });
  }
}
