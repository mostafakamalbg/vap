import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice, Order, Payment, Product, User } from '../lib/models.js';
import { authorize, hasSuperAdminAccess, verifyPassword } from '../lib/auth.js';
import { normalizePaymentMethod } from '../shared/paymentMethods.js';
import { getInvoiceStockChanges } from '../shared/invoiceStock.js';
import { getItemCartons } from '../shared/invoiceCartons.js';
import { calculateInvoiceTotals, roundCurrency } from '../shared/invoiceTotals.js';
import { dateRangeCondition, invoiceSessionCondition, parseReportMonth } from '../shared/reportDateFilters.js';
import { STOCK_RECONCILIATION_START_DATE } from '../shared/stockReconciliation.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { normalizeSessionText } from '../shared/sessions.js';
import { parseSessionDateRange } from '../shared/reportDateFilters.js';
import { ADMIN_ROLES, OFFICER_ROLE, isAdminRole } from '../shared/roles.js';

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

function validateInvoice(body) {
  if (!body?.id || !isValidDate(body.date) || !String(body.session || '').trim() || String(body.session).length > 100) {
    return 'ইনভয়েস নম্বর, সঠিক তারিখ ও সেশন নির্বাচন করুন।';
  }
  if (!parseSessionDateRange(normalizeSessionText(body.session))) {
    return 'সঠিক সেশন নির্বাচন করুন।';
  }
  const invoiceType = String(body.invoiceType || 'regular');
  if (!['regular', 'dealer_return', 'depot_factory_return', 'factory_damage'].includes(invoiceType)) {
    return 'ইনভয়েসের ধরন সঠিক নয়।';
  }
  if (invoiceType === 'regular' && (!body.officerId || !body.dealerId)) {
    return 'সেলস অফিসার ও ডিলার নির্বাচন করুন।';
  }
  if (invoiceType === 'dealer_return' && !body.dealerId) return 'ডিলার নির্বাচন করুন।';
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
  const invalidItem = body.items.some((item) => {
    const cartons = Number(item?.cartons ?? item?.quantity ?? 0);
    const retailPieces = Number(item?.retailPieces ?? 0);
    const piecePrice = Number(item?.piecePrice ?? item?.unitPrice);
    const unitPrice = Number(item?.unitPrice ?? item?.piecePrice);
    const cartonPrice = Number(item?.cartonPrice ?? item?.unitPrice);
    const packPerBox = Number(item?.packPerBox ?? 1);
    const commission = Number(item?.commission ?? 0);
    return !item?.productId
      || !item?.sku
      || !Number.isSafeInteger(cartons)
      || cartons < 0
      || !Number.isSafeInteger(retailPieces)
      || retailPieces < 0
      || cartons + retailPieces <= 0
      || (item?.unitType != null && !['carton', 'piece'].includes(item.unitType))
      || (item?.unitType === 'carton' && retailPieces > 0)
      || (item?.unitType === 'piece' && cartons > 0)
      || !Number.isFinite(unitPrice)
      || unitPrice < 0
      || !Number.isFinite(cartonPrice)
      || cartonPrice < 0
      || !Number.isSafeInteger(packPerBox)
      || packPerBox < 1
      || !Number.isFinite(commission)
      || commission < 0
      || commission > 100
      || (retailPieces > 0 && (!Number.isFinite(piecePrice) || piecePrice <= 0))
      || (item.stockCondition != null && !['good', 'damaged'].includes(item.stockCondition));
  });
  if (invalidItem) return 'প্রতিটি পণ্যের সঠিক পরিমাণ ও একক মূল্য দিন।';
  for (const field of ['paidAmount', 'transportCost']) {
    if (body[field] != null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) {
      return 'ইনভয়েসের টাকার পরিমাণ সঠিক নয়।';
    }
  }
  if (body.previousDue != null && !Number.isFinite(Number(body.previousDue))) {
    return 'ইনভয়েসের টাকার পরিমাণ সঠিক নয়।';
  }
  return '';
}

function invoiceValues(body) {
  const isReturn = ['dealer_return', 'depot_factory_return', 'factory_damage'].includes(body.invoiceType);
  const totals = calculateInvoiceTotals({
    items: body.items,
    invoiceType: body.invoiceType,
    transportCost: body.transportCost,
    returnAdjustments: body.returnAdjustments || []
  });
  const { items, subtotal, commissionAmount, transportCost, returnAdjustments, returnAdjustmentTotal, totalAmount } = totals;
  const previousDue = isReturn ? 0 : roundCurrency(body.previousDue);
  const netPayable = isReturn ? 0 : totalAmount + previousDue;
  const paymentMethod = normalizePaymentMethod(body.paymentMethod);
  const paidAmount = isReturn || paymentMethod === 'credit' ? 0 : roundCurrency(body.paidAmount);
  const dueAmount = isReturn ? 0 : Math.max(0, netPayable - paidAmount);
  return {
    id: String(body.id).trim(),
    invoiceNo: String(body.invoiceNo || body.id).trim(),
    challanNo: String(body.challanNo || '').trim().slice(0, 100),
    date: body.date,
    session: normalizeSessionText(body.session),
    officerId: String(body.officerId || ''),
    officerCode: String(body.officerCode || ''),
    officerName: String(body.officerName || ''),
    officerDesignation: String(body.officerDesignation || ''),
    dealerId: String(body.dealerId || ''),
    dealerCode: String(body.dealerCode || ''),
    dealerName: String(body.dealerName || ''),
    dealerProprietor: String(body.dealerProprietor || ''),
    dealerAddress: String(body.dealerAddress || ''),
    dealerPhone: String(body.dealerPhone || ''),
    items,
    totalCartons: roundCurrency(items.reduce((sum, item) => sum + getItemCartons(item), 0)),
    subtotal,
    commissionAmount,
    transportCost,
    grandTotal: totalAmount,
    totalAmount,
    paidAmount,
    currentDue: dueAmount,
    dueAmount,
    invoiceType: String(body.invoiceType || 'regular'),
    seqNumber: Number(body.seqNumber) || 0,
    returnAdjustments,
    returnAdjustmentTotal,
    previousDue,
    netPayable,
    paymentMethod,
    transport: String(body.transport || ''),
    note: String(body.note || '').slice(0, 1000)
  };
}

function getInvoicePaymentValues(invoice) {
  return {
    id: `PAY-INVOICE-${invoice.id}`,
    sourceInvoiceId: invoice.id,
    date: invoice.date,
    session: normalizeSessionText(invoice.session),
    paymentType: 'dealer_collection',
    dealerId: invoice.dealerId,
    dealerName: invoice.dealerName,
    officerId: invoice.officerId,
    officerCode: invoice.officerCode,
    officerName: invoice.officerName,
    amount: roundCurrency(invoice.paidAmount),
    paymentMethod: invoice.paymentMethod,
    reference: `চালান #${invoice.id}`,
    receivedBy: invoice.officerCode ? `অফিসার কোড ${invoice.officerCode}` : 'ক্যাশিয়ার',
    note: `ইনভয়েস #${invoice.id} এর বিপরীতে পরিশোধ`
  };
}

async function syncInvoicePayment(invoice, session) {
  const options = transactionOptions(session);
  await Payment.deleteMany({ sourceInvoiceId: invoice.id }, options);
  await BusinessRecord.deleteMany({
    type: 'payments',
    $or: [
      { 'data.sourceInvoiceId': invoice.id },
      {
        'data.reference': `চালান #${invoice.id}`,
        'data.note': `ইনভয়েস #${invoice.id} এর বিপরীতে পরিশোধ`
      }
    ]
  }, options);
  if (invoice.paidAmount > 0) {
    await Payment.create([getInvoicePaymentValues(invoice)], options);
  }
}

function getInvoiceCreatedAt(invoice) {
  const date = invoice.createdAt
    ? new Date(invoice.createdAt)
    : new Date(`${invoice.date}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function isWithinEditWindow(invoice) {
  const createdAt = getInvoiceCreatedAt(invoice);
  const age = createdAt ? Date.now() - createdAt.valueOf() : Number.POSITIVE_INFINITY;
  return age >= 0 && age <= 15 * 24 * 60 * 60 * 1000;
}

function isWithinDeleteWindow(invoice) {
  const createdAt = getInvoiceCreatedAt(invoice);
  if (!createdAt || createdAt.valueOf() > Date.now()) return false;
  const year = createdAt.getUTCFullYear();
  const month = createdAt.getUTCMonth() + 1;
  const day = createdAt.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const deadline = new Date(createdAt);
  deadline.setUTCFullYear(year, month, Math.min(day, lastDayOfMonth));
  return Date.now() <= deadline.valueOf();
}

async function applyInvoiceStockChanges(previousInvoice, nextInvoice, session) {
  const effectivePreviousInvoice = previousInvoice?.date >= STOCK_RECONCILIATION_START_DATE
    ? previousInvoice
    : null;
  const effectiveNextInvoice = nextInvoice?.date >= STOCK_RECONCILIATION_START_DATE
    ? nextInvoice
    : null;
  const changes = getInvoiceStockChanges(effectivePreviousInvoice, effectiveNextInvoice);
  for (const change of changes.values()) {
    let productQuery = Product.findOne({ id: change.productId });
    if (session) productQuery = productQuery.session(session);
    const product = await productQuery;
    if (!product) {
      const error = new Error(`পণ্য ${change.productId} পাওয়া যায়নি।`);
      error.statusCode = 400;
      throw error;
    }
    let foundVariant = false;
    product.variants = (product.variants || []).map((variant) => {
      if (variant.sku !== change.sku) return variant;
      foundVariant = true;
      const currentPieces = variant.stock == null
        ? (Number(variant.stockCartons) || 0) * (Number(variant.packPerBox) || 1)
        : Number(variant.stock) || 0;
      const currentCartons = variant.stockCartons == null
        ? Math.floor(currentPieces / (Number(variant.packPerBox) || 1))
        : Number(variant.stockCartons) || 0;
      const stockCartons = currentCartons + change.cartons;
      const stock = currentPieces + change.pieces;
        return {
          ...variant,
          stockCartons,
          stock,
          damageStock: (Number(variant.damageStock) || 0) + change.damagePieces
        };
    });
    if (!foundVariant) {
      const error = new Error(`প্যাক সাইজ ${change.sku} পাওয়া যায়নি।`);
      error.statusCode = 400;
      throw error;
    }
    await product.save(transactionOptions(session));
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const user = await authorize(
      req,
      res,
      req.method === 'GET' ? [...ADMIN_ROLES, OFFICER_ROLE] : ADMIN_ROLES
    );
    if (!user) return;
    if (req.method !== 'GET' && req.method !== 'POST') {
      if (!await hasSuperAdminAccess(user)) {
        return res.status(403).json({ error: 'সেলস সম্পাদনা বা মুছে ফেলার অনুমতি শুধু সুপার অ্যাডমিনের।' });
      }
    }

    if (req.method === 'GET') {
      const officerCodeMatch = String(user.officerCode || '').match(/\d+/);
      const officerCodeDigits = officerCodeMatch ? String(Number(officerCodeMatch[0])) : '';
      const ownerConditions = [
        ...(user.officerId ? [{ officerId: user.officerId }] : []),
        ...(user.officerCode ? [{ officerCode: user.officerCode }] : []),
        ...(officerCodeDigits ? [
          { officerId: `OFF-${officerCodeDigits.padStart(2, '0')}` },
          { officerCode: `SO-${officerCodeDigits.padStart(2, '0')}` },
          { officerCode: officerCodeDigits }
        ] : [])
      ];
      const filters = [];
      if (!isAdminRole(user.role)) {
        filters.push(ownerConditions.length ? { $or: ownerConditions } : { id: '__no_records__' });
      }
      if (req.query?.session != null) {
        const session = String(req.query.session).trim();
        if (!session || session.length > 100) return res.status(400).json({ error: 'সঠিক সেশন নির্বাচন করুন।' });
        filters.push(invoiceSessionCondition(session));
      }
      if (req.query?.month != null) {
        const range = parseReportMonth(req.query.month);
        if (!range) return res.status(400).json({ error: 'রিপোর্টের মাস সঠিক নয়।' });
        filters.push(dateRangeCondition('date', range));
      }
      if (req.query?.date != null) {
        const date = String(req.query.date);
        if (!isValidDate(date)) return res.status(400).json({ error: 'সঠিক তারিখ দিন।' });
        filters.push({ date });
      }
      const filter = filters.length > 1 ? { $and: filters } : filters[0] || {};
      return res.status(200).json(await Invoice.find(filter).sort({ date: -1, createdAt: -1 }).lean());
    }

    if (req.method === 'DELETE') {
      const invoiceId = String(req.body?.id || '').trim();
      const password = String(req.body?.password || '');
      if (!invoiceId || !password) {
        return res.status(400).json({ error: 'ইনভয়েস নির্বাচন ও অ্যাডমিন পাসওয়ার্ড দিন।' });
      }
      const credential = await User.findById(user._id).select('+passwordHash').lean();
      if (!credential || !await verifyPassword(password, credential.passwordHash)) {
        return res.status(401).json({ error: 'সঠিক অ্যাডমিন পাসওয়ার্ড দিন।' });
      }

      try {
        await withTransactionFallback(async (session) => {
          const options = transactionOptions(session);
          let invoiceQuery = Invoice.findOne({ id: invoiceId });
          if (session) invoiceQuery = invoiceQuery.session(session);
          const invoice = await invoiceQuery;
          if (!invoice) {
            const error = new Error('ইনভয়েস পাওয়া যায়নি।');
            error.statusCode = 404;
            throw error;
          }
          if (!isWithinDeleteWindow(invoice)) {
            const error = new Error('ইনভয়েস তৈরির এক মাস পার হলে সেটি মুছতে পারবেন না।');
            error.statusCode = 403;
            throw error;
          }

          await applyInvoiceStockChanges(invoice, null, session);
          await BusinessRecord.deleteMany({
            type: 'damageLogs',
            'data.invoiceRef': invoiceId
          }, options);
          await BusinessRecord.deleteMany({
            type: 'payments',
            $or: [
              { 'data.sourceInvoiceId': invoiceId },
              {
                'data.reference': `চালান #${invoiceId}`,
                'data.note': `ইনভয়েস #${invoiceId} এর বিপরীতে পরিশোধ`
              }
            ]
          }, options);
          await Payment.deleteMany({ sourceInvoiceId: invoiceId }, options);
          await Invoice.deleteOne({ id: invoiceId }, options);
        });
        return res.status(200).json({ deleted: invoiceId });
      } catch (error) {
        if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
        throw error;
      }
    }

    const input = req.method === 'PATCH' ? req.body?.invoice : req.body;
    const validationError = validateInvoice(input);
    if (validationError) return res.status(400).json({ error: validationError });

    const dealer = input.dealerId ? await Dealer.findOne({ id: String(input.dealerId) }).lean() : null;
    if (input.dealerId && !dealer) {
      return res.status(400).json({ error: 'নির্বাচিত ডিলার ডেটাবেজে পাওয়া যায়নি।' });
    }
    const officerRecord = input.officerId
      ? await BusinessRecord.findOne({
        type: 'officers',
        $or: [
          { recordId: String(input.officerId) },
          { 'data.id': String(input.officerId) },
          { 'data.officerId': String(input.officerId) }
        ]
      }).select('data').lean()
      : null;
    if (input.officerId && !officerRecord) {
      return res.status(400).json({ error: 'নির্বাচিত সেলস অফিসার ডেটাবেজে পাওয়া যায়নি।' });
    }
    const officer = officerRecord?.data;
    const values = invoiceValues({
      ...input,
      officerId: officer?.id || officer?.officerId || input.officerId,
      officerCode: officer?.code || input.officerCode,
      officerName: officer?.name || input.officerName,
      officerDesignation: officer?.designation || input.officerDesignation,
      dealerCode: dealer?.code || input.dealerCode,
      dealerName: dealer?.shopName || dealer?.name || input.dealerName,
      dealerProprietor: dealer?.proprietor || input.dealerProprietor || '',
      dealerAddress: dealer?.address || dealer?.businessAddress || input.dealerAddress || '',
      dealerPhone: dealer?.phone || dealer?.mobile || dealer?.phoneNumber || input.dealerPhone || ''
    });
    if (req.method === 'POST') {
      let invoice;
      await withTransactionFallback(async (session) => {
        let duplicateQuery = Invoice.findOne({
          $or: [{ id: values.id }, { invoiceNo: values.invoiceNo }]
        }).select('id');
        if (session) duplicateQuery = duplicateQuery.session(session);
        if (await duplicateQuery.lean()) {
          const error = new Error('এই ইনভয়েস নম্বরটি আগে থেকেই আছে।');
          error.statusCode = 409;
          throw error;
        }
        let orderQuery = Order.findOne({ invoiceNo: values.invoiceNo }).select('id');
        if (session) orderQuery = orderQuery.session(session);
        if (await orderQuery.lean()) {
          const error = new Error('এই ইনভয়েস নম্বরটি একটি অর্ডারে ব্যবহৃত হয়েছে।');
          error.statusCode = 409;
          throw error;
        }
        await applyInvoiceStockChanges(null, values, session);
        [invoice] = await Invoice.create([values], transactionOptions(session));
        await syncInvoicePayment(invoice, session);
      });
      return res.status(201).json(invoice.toObject());
    }

    let invoice;
    await withTransactionFallback(async (session) => {
      let existingQuery = Invoice.findOne({ id: values.id });
      if (session) existingQuery = existingQuery.session(session);
      const existingInvoice = await existingQuery.lean();
      if (!existingInvoice) {
        const error = new Error('ইনভয়েস পাওয়া যায়নি।');
        error.statusCode = 404;
        throw error;
      }
      if (!isWithinEditWindow(existingInvoice)) {
        const error = new Error('ইনভয়েস তৈরির ১৫ দিনের মধ্যে সম্পাদনা করা যাবে।');
        error.statusCode = 403;
        throw error;
      }
      await applyInvoiceStockChanges(existingInvoice, values, session);
      invoice = await Invoice.findOneAndUpdate(
        { id: values.id },
        { $set: values },
        { ...transactionOptions(session), new: true, runValidators: true }
      ).lean();
      await syncInvoicePayment(invoice, session);
    });
    if (!invoice) return res.status(404).json({ error: 'ইনভয়েস পাওয়া যায়নি।' });
    return res.status(200).json(invoice);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'এই ইনভয়েস নম্বরটি আগে থেকেই আছে।' });
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Invoice operation failed:', error);
    return res.status(500).json({ error: 'ইনভয়েস সংরক্ষণ করা যায়নি।' });
  }
}
