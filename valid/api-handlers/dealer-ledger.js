import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { BusinessRecord, Dealer, Invoice, Payment } from '../lib/models.js';
import { DEALER_ROLE } from '../shared/roles.js';
import { formatDealerCode } from '../shared/codes.js';

function uniqueRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const id = String(record.id || record.invoiceNo || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function uniquePayments(records) {
  const seenIds = new Set();
  const seenInvoiceSources = new Set();
  return records.filter((record) => {
    const id = String(record.id || '');
    const sourceInvoiceId = String(record.sourceInvoiceId || '');
    if ((id && seenIds.has(id)) || (sourceInvoiceId && seenInvoiceSources.has(sourceInvoiceId))) return false;
    if (id) seenIds.add(id);
    if (sourceInvoiceId) seenInvoiceSources.add(sourceInvoiceId);
    return true;
  });
}

export function getUniqueDealerCodeAliases(dealer, user, dealers) {
  const dealerId = String(dealer.id);
  const aliases = [...new Set([dealer.code, user.dealerCode].map((value) => String(value || '').trim()).filter(Boolean))];
  return aliases.filter((alias) => {
    const normalized = formatDealerCode(alias);
    const matches = dealers.filter((entry) => formatDealerCode(entry.code) === normalized);
    return matches.length === 1 && String(matches[0].id) === dealerId;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, [DEALER_ROLE]);
  if (!user) return;

  try {
    const [dealer, dealerRecords] = await Promise.all([
      Dealer.findOne({ id: user.dealerId }).lean(),
      Dealer.find({}).select('id code').lean()
    ]);
    if (!dealer) return res.status(404).json({ error: 'ডিলার রেকর্ড পাওয়া যায়নি।' });
    const dealerId = String(dealer.id);
    const dealerCode = String(dealer.code || user.dealerCode || '');
    const safeCodeAliases = getUniqueDealerCodeAliases(dealer, user, dealerRecords);
    const dealerConditions = [{ dealerId }];
    const legacyConditions = [{ 'data.dealerId': dealerId }];
    if (safeCodeAliases.length) {
      dealerConditions.push({ dealerCode: { $in: safeCodeAliases } });
      legacyConditions.push({ 'data.dealerCode': { $in: safeCodeAliases } });
    }
    const [invoices, legacyInvoices, payments, legacyPayments, damages] = await Promise.all([
      Invoice.find({ $or: dealerConditions }).sort({ date: -1 }).lean(),
      BusinessRecord.find({
        type: 'invoices',
        $or: legacyConditions
      }).select('data').lean(),
      Payment.find({ dealerId }).sort({ date: -1 }).lean(),
      BusinessRecord.find({
        type: 'payments',
        $or: legacyConditions
      }).select('data').lean(),
      BusinessRecord.find({
        type: 'damageLogs',
        $or: legacyConditions
      }).select('data').lean()
    ]);

    const invoiceRecords = uniqueRecords([
      ...invoices,
      ...legacyInvoices.map((record) => record.data).filter(Boolean)
    ]);
    const paymentRecords = uniquePayments([
      ...payments,
      ...legacyPayments.map((record) => record.data).filter(Boolean)
    ]);
    return res.status(200).json({
      dealer: {
        id: dealerId,
        code: dealerCode,
        shopName: dealer.shopName || user.name,
        openingDue: Number(dealer.lastSessionDue ?? dealer.openingDue) || 0
      },
      invoices: invoiceRecords,
      payments: paymentRecords,
      damages: damages.map((record) => record.data).filter(Boolean)
    });
  } catch (error) {
    console.error('Dealer ledger lookup failed:', error);
    return res.status(500).json({ error: 'আপনার ডিলার লেজার লোড করা যায়নি।' });
  }
}
