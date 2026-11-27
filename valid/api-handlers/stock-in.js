import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { authorize, hasSuperAdminAccess, verifyPassword } from '../lib/auth.js';
import { BusinessRecord, Product, User } from '../lib/models.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { getStockInQuantities, isValidStockInQuantities } from '../shared/quantityUnits.js';
import { STOCK_RECONCILIATION_START_DATE } from '../shared/stockReconciliation.js';
import { getInvoiceSessionForDate } from '../shared/sessions.js';
import {
  ADMIN_ROLES,
  LOGISTIC_OFFICER_ROLE,
} from '../shared/roles.js';
import { createApprovalRequest } from '../lib/approvalRequests.js';
import {
  createStockInChallanSnapshot,
  assertStockInSnapshot,
  getStockInRecordData,
  loadStockInChallan,
  saveStockInRevision
} from '../lib/stockInMutations.js';
import { getStockInChallanKey } from '../shared/stockInChallans.js';
import { canEditStockInDirectly } from '../shared/stockInPermissions.js';
import { getStockInRevisionChanges } from '../shared/stockInRevisions.js';

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function getCartons(input) {
  return Number(input?.cartons ?? input?.quantity);
}

function isValidEntry(input) {
  const cartons = getCartons(input);
  return Boolean(
    input
    && String(input.productId || '').trim()
    && String(input.sku || '').trim()
    && isValidDate(input.date)
    && Number.isSafeInteger(cartons)
    && cartons > 0
  );
}

function getChallanSharedFields(input) {
  const fields = [
    'date',
    'source',
    'batchNo',
    'challanNo',
    'challanNumber',
    'invoiceNo',
    'voucherNo',
    'referenceId',
    'referenceNo',
    'referenceID',
    'refId',
    'mfgDate',
    'expDate',
    'receivedBy',
    'note'
  ];
  return Object.fromEntries(fields
    .filter((field) => Object.hasOwn(input, field))
    .map((field) => [field, input[field]]));
}

function getStockInTargetIds(records) {
  return [...new Set(records.flatMap((record) => [
    record.recordId,
    record.data?.id
  ]).filter(Boolean))];
}

function getStockInSnapshots(records) {
  return records.map((record) => ({
    id: record.recordId,
    data: getStockInRecordData(record),
    recordUpdatedAt: record.updatedAt
  }));
}

async function prepareStockInEntries(currentRecords, input, session) {
  const rawItems = Array.isArray(input.items) ? input.items : [input];
  if (!rawItems.length || rawItems.length > 200) {
    const error = new Error('চালানে অন্তত একটি পণ্য এবং সর্বোচ্চ ২০০টি পণ্য দিন।');
    error.statusCode = 400;
    throw error;
  }
  const sharedFields = getChallanSharedFields(input);
  const currentById = new Map(currentRecords.flatMap((record) => [
    [String(record.recordId || ''), record],
    [String(record.data?.id || ''), record]
  ]).filter(([id]) => id));
  const selectedIds = new Set();
  const products = new Map();
  const revisedEntries = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      const error = new Error('চালানের পণ্যের তথ্য সঠিক নয়।');
      error.statusCode = 400;
      throw error;
    }
    const requestedId = String(rawItem?.id || '').trim();
    const current = requestedId
      ? currentById.get(requestedId)
      : (rawItems.length === 1 ? currentRecords[0] : null);
    const currentRecordId = String(current?.recordId || '');
    if (requestedId && (!current || selectedIds.has(currentRecordId))) {
      const error = new Error('চালানের পণ্য তালিকা সঠিক নয়; আবার খুলে সম্পাদনা করুন।');
      error.statusCode = 409;
      throw error;
    }
    if (requestedId) selectedIds.add(currentRecordId);
    const id = current?.recordId || `STK-IN-${randomUUID()}`;
    const itemFields = Object.fromEntries(
      ['productId', 'sku', 'cartons', 'quantity']
        .filter((field) => Object.hasOwn(rawItem, field))
        .map((field) => [field, rawItem[field]])
    );
    const revised = {
      ...(current ? getStockInRecordData(current) : {}),
      ...itemFields,
      ...sharedFields,
      id
    };
    delete revised.items;
    revised.cartons = getCartons(revised);
    revised.quantity = revised.cartons;
    if (!isValidEntry(revised)) {
      const error = new Error('স্টক-ইন তারিখ, পণ্য ও সঠিক পরিমাণ দিন।');
      error.statusCode = 400;
      throw error;
    }

    const productId = String(revised.productId).trim();
    let product = products.get(productId);
    if (!product) {
      const query = Product.findOne({ id: productId });
      if (session) query.session(session);
      product = await query.lean();
      if (!product) {
        const error = new Error('নির্বাচিত পণ্যটি পাওয়া যায়নি।');
        error.statusCode = 404;
        throw error;
      }
      products.set(productId, product);
    }
    const sku = String(revised.sku).trim();
    const variant = product.variants?.find((item) => item.sku === sku);
    if (!variant) {
      const error = new Error('নির্বাচিত পণ্য বা প্যাক সাইজ পাওয়া যায়নি।');
      error.statusCode = 400;
      throw error;
    }
    const packPerBox = Number(variant.packPerBox);
    if (!Number.isSafeInteger(packPerBox) || packPerBox < 1) {
      const error = new Error('নির্বাচিত পণ্যের প্যাক তথ্য সঠিক নয়।');
      error.statusCode = 409;
      throw error;
    }
    const quantities = getStockInQuantities({
      ...variant,
      productName: product.name,
      generic: product.generic
    }, revised.cartons);
    if (!isValidStockInQuantities(quantities)) {
      const error = new Error('স্টক পরিমাণ সঠিকভাবে হিসাব করা যায়নি; প্যাক ও মজুত তথ্য যাচাই করুন।');
      error.statusCode = 400;
      throw error;
    }
    revised.productId = productId;
    revised.productName = product.name;
    revised.sku = sku;
    revised.quantityPieces = quantities.quantityPieces;
    revised.quantityUnit = quantities.quantityUnit;
    revised.packPerBox = packPerBox;
    revised.size = variant.size || '';
    revised.session = getInvoiceSessionForDate(revised.date);
    revisedEntries.push(revised);
  }

  if (new Set(revisedEntries.map((entry) => entry.id)).size !== revisedEntries.length) {
    const error = new Error('চালানের প্রতিটি পণ্যের আলাদা রেকর্ড আইডি থাকা আবশ্যক।');
    error.statusCode = 400;
    throw error;
  }
  return revisedEntries;
}

async function hasDirectStockInAccess(user) {
  const superAdminAccess = await hasSuperAdminAccess(user);
  return canEditStockInDirectly(user, superAdminAccess);
}

export default async function handler(req, res) {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  } catch (error) {
    console.error('Stock-in database connection failed:', error);
    return res.status(503).json({ error: 'ডাটাবেজে সংযোগ করা যায়নি; পরে আবার চেষ্টা করুন।' });
  }
  const user = await authorize(req, res, [...ADMIN_ROLES, LOGISTIC_OFFICER_ROLE]);
  if (!user) return;

  const verifyCurrentPassword = async (password) => {
    if (typeof password !== 'string' || !password || password.length > 128) return false;
    const credential = await User.findById(user._id).select('+passwordHash').lean();
    return Boolean(credential && await verifyPassword(password, credential.passwordHash));
  };

  if (req.method === 'POST' && req.body?.action === 'verify-password') {
    try {
      if (!await verifyCurrentPassword(req.body.password)) {
        return res.status(401).json({ error: 'সঠিক অ্যাডমিন পাসওয়ার্ড দিন।' });
      }
      return res.status(200).json({ verified: true });
    } catch (error) {
      console.error('Stock-in password verification failed:', error);
      return res.status(500).json({ error: 'পাসওয়ার্ড যাচাই করা যায়নি।' });
    }
  }

  if (req.method === 'PATCH') {
    const id = String(req.body?.id || '').trim();
    const input = req.body?.entry;
    if (!id || !input || typeof input !== 'object' || Array.isArray(input)) {
      return res.status(400).json({ error: 'সংশোধনের জন্য স্টক-ইন চালান নির্বাচন করুন।' });
    }
    try {
      const directAccess = await hasDirectStockInAccess(user);
      if (!directAccess && !await verifyCurrentPassword(req.body?.password)) {
        return res.status(401).json({ error: 'সঠিক অ্যাডমিন পাসওয়ার্ড দিন।' });
      }
      const loaded = await loadStockInChallan(id);
      if (!loaded) return res.status(404).json({ error: 'স্টক-ইন চালান পাওয়া যায়নি।' });
      if (loaded.anchor.data?.deletedAt) {
        return res.status(409).json({ error: 'মুছে ফেলা স্টক-ইন চালান সংশোধন করা যাবে না।' });
      }
      const currentRecords = Array.isArray(input.items)
        ? loaded.records
        : loaded.records.filter((record) => record.recordId === loaded.anchor.recordId);
      const targetId = Array.isArray(input.items)
        ? loaded.records[0]?.recordId || loaded.anchor.recordId
        : currentRecords[0]?.recordId || loaded.anchor.recordId;
      const targetIds = getStockInTargetIds(loaded.records);
      if (!currentRecords.length) {
        return res.status(409).json({ error: 'সক্রিয় স্টক-ইন পণ্য পাওয়া যায়নি।' });
      }
      const originalEntries = Array.isArray(req.body?.originalEntries)
        ? req.body.originalEntries
        : getStockInSnapshots(currentRecords);
      const conflictingRequest = await BusinessRecord.findOne({
        type: 'approvalRequests',
        'data.targetId': { $in: targetIds },
        'data.requestType': { $in: ['stock_in_update', 'stock_in_delete'] },
        'data.status': { $in: ['pending_super_admin_approval', 'processing_super_admin_approval'] }
      }).select('recordId data.status').lean();
      if (
        conflictingRequest
        && (!directAccess || conflictingRequest.data?.status === 'processing_super_admin_approval')
      ) {
        return res.status(409).json({ error: 'এই চালানের আরেকটি পরিবর্তন অনুমোদন বা প্রক্রিয়াধীন আছে।' });
      }
      assertStockInSnapshot(currentRecords, originalEntries);
      const revisedEntries = await prepareStockInEntries(currentRecords, input);
      const identity = getStockInChallanKey(revisedEntries[0]);
      if (revisedEntries.some((entry) => getStockInChallanKey(entry) !== identity)) {
        return res.status(400).json({ error: 'একটি চালানের সব পণ্যের তারিখ ও চালান নম্বর একই হতে হবে।' });
      }
      const revisionChanges = getStockInRevisionChanges(
        currentRecords.map((record) => ({
          ...getStockInRecordData(record),
          id: record.recordId
        })),
        revisedEntries
      );
      if (!revisionChanges.length) {
        return res.status(200).json({
          pendingApproval: false,
          unchanged: true,
          entries: currentRecords.map(getStockInRecordData)
        });
      }
      if (directAccess) {
        let savedEntries = [];
        await withTransactionFallback(async (session) => {
          const current = await loadStockInChallan(id, session);
          if (!current || current.anchor.data?.deletedAt) {
            const error = new Error('স্টক-ইন চালানটি আর সক্রিয় নেই।');
            error.statusCode = 409;
            throw error;
          }
          const recordsToUpdate = Array.isArray(input.items)
            ? current.records
            : current.records.filter((record) => record.recordId === current.anchor.recordId);
          assertStockInSnapshot(recordsToUpdate, originalEntries);
          savedEntries = await saveStockInRevision(recordsToUpdate, revisedEntries, {
            deletedBy: String(user.name || ''),
            deletedByRole: String(user.role || '')
          }, session);
          await BusinessRecord.updateMany({
            type: 'approvalRequests',
            'data.targetId': { $in: targetIds },
            'data.requestType': { $in: ['stock_in_update', 'stock_in_delete'] },
            'data.status': 'pending_super_admin_approval'
          }, {
            $set: {
              'data.status': 'superseded',
              'data.decidedBy': String(user.name || ''),
              'data.decidedByRole': String(user.role || ''),
              'data.decidedAt': new Date(),
              'data.resolutionNote': 'সুপার অ্যাডমিন/MD/Chairman সরাসরি চালান সংশোধন করেছেন।'
            }
          }, transactionOptions(session));
        });
        return res.status(200).json({ pendingApproval: false, entries: savedEntries });
      }
      const approvalRequest = await createApprovalRequest({
        requestType: 'stock_in_update',
        targetId,
        original: revisionChanges
          .filter((change) => change.oldEntry)
          .map((change) => ({ id: change.id, data: change.oldEntry })),
        proposed: {
          grouped: Array.isArray(input.items),
          entries: revisionChanges
            .map((change) => change.newEntry)
            .filter(Boolean),
          changes: revisionChanges,
          challanSnapshot: createStockInChallanSnapshot(currentRecords),
          requestedBy: String(user.name || ''),
          requestedByRole: String(user.role || '')
        },
        user
      });
      return res.status(202).json({ pendingApproval: true, approvalRequest });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error('Stock-in update request failed:', error);
      return res.status(500).json({ error: 'স্টক-ইন সংশোধনের অনুরোধ জমা করা যায়নি।' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String(req.body?.id || '').trim();
    if (!id) return res.status(400).json({ error: 'মুছে ফেলার জন্য স্টক-ইন চালান নির্বাচন করুন।' });
    try {
      const directAccess = await hasDirectStockInAccess(user);
      if (!directAccess && !await verifyCurrentPassword(req.body?.password)) {
        return res.status(401).json({ error: 'সঠিক অ্যাডমিন পাসওয়ার্ড দিন।' });
      }
      const loaded = await loadStockInChallan(id);
      if (!loaded) return res.status(404).json({ error: 'স্টক-ইন চালান পাওয়া যায়নি।' });
      if (loaded.anchor.data?.deletedAt) {
        return res.status(409).json({ error: 'স্টক-ইন চালানটি আগেই মুছে ফেলা হয়েছে।' });
      }
      const originalEntries = Array.isArray(req.body?.originalEntries)
        ? req.body.originalEntries
        : getStockInSnapshots(loaded.records);
      const conflictingRequest = await BusinessRecord.findOne({
        type: 'approvalRequests',
        'data.targetId': { $in: getStockInTargetIds(loaded.records) },
        'data.requestType': { $in: ['stock_in_update', 'stock_in_delete'] },
        'data.status': { $in: ['pending_super_admin_approval', 'processing_super_admin_approval'] }
      }).select('recordId data.status').lean();
      if (
        conflictingRequest
        && (!directAccess || conflictingRequest.data?.status === 'processing_super_admin_approval')
      ) {
        return res.status(409).json({ error: 'এই চালানের আরেকটি পরিবর্তন অনুমোদন বা প্রক্রিয়াধীন আছে।' });
      }
      assertStockInSnapshot(loaded.records, originalEntries);
      if (directAccess) {
        await withTransactionFallback(async (session) => {
          const current = await loadStockInChallan(id, session);
          if (!current || current.anchor.data?.deletedAt) {
            const error = new Error('স্টক-ইন চালানটি আর সক্রিয় নেই।');
            error.statusCode = 409;
            throw error;
          }
          assertStockInSnapshot(current.records, originalEntries);
          await saveStockInRevision(current.records, [], {
            deletedBy: String(user.name || ''),
            deletedByRole: String(user.role || '')
          }, session);
          await BusinessRecord.updateMany({
            type: 'approvalRequests',
            'data.targetId': { $in: getStockInTargetIds(current.records) },
            'data.requestType': { $in: ['stock_in_update', 'stock_in_delete'] },
            'data.status': 'pending_super_admin_approval'
          }, {
            $set: {
              'data.status': 'superseded',
              'data.decidedBy': String(user.name || ''),
              'data.decidedByRole': String(user.role || ''),
              'data.decidedAt': new Date(),
              'data.resolutionNote': 'সুপার অ্যাডমিন/MD/Chairman সরাসরি চালান নিষ্পত্তি করেছেন।'
            }
          }, transactionOptions(session));
        });
        return res.status(200).json({ pendingApproval: false, deleted: true });
      }
      const approvalRequest = await createApprovalRequest({
        requestType: 'stock_in_delete',
        targetId: loaded.records[0]?.recordId || loaded.anchor.recordId,
        original: getStockInSnapshots(loaded.records),
        originalUpdatedAt: Object.fromEntries(loaded.records.map((record) => (
          [record.recordId, record.updatedAt]
        ))),
        proposed: {
          requestedBy: String(user.name || ''),
          requestedByRole: String(user.role || '')
        },
        user
      });
      return res.status(202).json({ pendingApproval: true, approvalRequest });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error('Stock-in deletion request failed:', error);
      return res.status(500).json({ error: 'স্টক-ইন মুছে ফেলার অনুরোধ জমা করা যায়নি।' });
    }
  }

  const inputs = Array.isArray(req.body?.entries) ? req.body.entries : [req.body || {}];
  if (!inputs.length || inputs.length > 200 || inputs.some((input) => !isValidEntry(input))) {
    return res.status(400).json({ error: 'স্টক-ইন তারিখ, পণ্য ও সঠিক পরিমাণ দিন।' });
  }

  const entries = inputs.map((input) => ({
    ...input,
    id: `STK-IN-${randomUUID()}`,
    productId: String(input.productId).trim(),
    sku: String(input.sku).trim(),
    cartons: getCartons(input)
  }));
  try {
    await withTransactionFallback(async (session) => {
      const options = transactionOptions(session);
      const loadedProducts = new Map();
      const changedProducts = new Map();
      for (const entry of entries) {
        let product = loadedProducts.get(String(entry.productId));
        if (!product) {
          let productQuery = Product.findOne({ id: String(entry.productId) });
          if (session) productQuery = productQuery.session(session);
          product = await productQuery;
          if (!product) {
            const error = new Error('নির্বাচিত পণ্যটি পাওয়া যায়নি।');
            error.statusCode = 404;
            throw error;
          }
          loadedProducts.set(String(entry.productId), product);
        }
        const variant = (product.variants || []).find((item) => item.sku === entry.sku);
        if (!variant) {
          const error = new Error('নির্বাচিত প্যাক সাইজটি পাওয়া যায়নি।');
          error.statusCode = 404;
          throw error;
        }
        const packPerBox = Number(variant.packPerBox);
        if (!Number.isSafeInteger(packPerBox) || packPerBox < 1) {
          const error = new Error('নির্বাচিত পণ্যের প্যাক তথ্য সঠিক নয়।');
          error.statusCode = 409;
          throw error;
        }
        const stockBase = entry.date >= STOCK_RECONCILIATION_START_DATE
          ? variant
          : { ...variant, stock: 0, stockCartons: 0 };
        const quantities = getStockInQuantities({
          productName: product.name,
          generic: product.generic,
          size: variant.size,
          packPerBox,
          stock: stockBase.stock,
          stockCartons: stockBase.stockCartons
        }, entry.cartons);
        if (!isValidStockInQuantities(quantities)) {
          const error = new Error('স্টক পরিমাণ সঠিকভাবে হিসাব করা যায়নি; প্যাক ও মজুত তথ্য যাচাই করুন।');
          error.statusCode = 400;
          throw error;
        }
        entry.quantityPieces = quantities.quantityPieces;
        entry.quantityUnit = quantities.quantityUnit;
        entry.packPerBox = packPerBox;
        if (entry.date >= STOCK_RECONCILIATION_START_DATE) {
          variant.stockCartons = quantities.stockCartons;
          variant.stock = quantities.stock;
          changedProducts.set(String(entry.productId), product);
        }
      }
      for (const product of changedProducts.values()) {
        product.markModified('variants');
        await product.save(options);
      }
      await BusinessRecord.insertMany(entries.map((entry) => ({
        type: 'stockInLogs',
        recordId: entry.id,
        data: entry
      })), options);
    });
    return res.status(201).json({ entries });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 11000) {
      return res.status(409).json({ error: 'এই স্টক-ইন রেকর্ডটি আগে থেকেই আছে। আবার জমা দেওয়ার আগে হিস্ট্রি দেখুন।' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'স্টক-ইন তথ্য সঠিক নয়; পণ্য ও পরিমাণ যাচাই করুন।' });
    }
    console.error('Stock-in save failed:', error);
    return res.status(500).json({ error: 'স্টক-ইন ও পণ্যের মজুত সংরক্ষণ করা যায়নি।' });
  }
}
