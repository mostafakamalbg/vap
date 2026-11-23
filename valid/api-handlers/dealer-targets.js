import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { Dealer, DealerSalesTarget } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { parseSessionDateRange } from '../shared/reportDateFilters.js';
import { normalizeSessionText } from '../shared/sessions.js';
import { ADMIN_ROLES, isAdminRole } from '../shared/roles.js';
import { HIERARCHY_ROLE_VALUES } from '../shared/roles.js';
import { resolveHierarchyScope } from '../lib/hierarchy.js';
import { normalizeOfficerCode } from '../shared/codes.js';

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(
    req,
    res,
    req.method === 'GET' ? [...ADMIN_ROLES, ...HIERARCHY_ROLE_VALUES] : ADMIN_ROLES
  );
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const scope = await resolveHierarchyScope(user);
      let filter = {};
      if (!scope.global) {
        const dealers = await Dealer.find({}).select('id officerCode').lean();
        const codes = new Set([...scope.officerCodes]
          .map((code) => normalizeOfficerCode(code))
          .filter(Boolean));
        const dealerIds = dealers.filter((dealer) => codes.has(
          normalizeOfficerCode(dealer.officerCode)
        )).map((dealer) => dealer.id);
        filter = dealerIds.length ? { dealerId: { $in: dealerIds } } : { _id: null };
      }
      return res.status(200).json(await DealerSalesTarget.find(filter).sort({
        targetDate: -1,
        createdAt: -1
      }).lean());
    } catch (error) {
      console.error('Dealer targets lookup failed:', error);
      return res.status(500).json({ error: 'ডিলার টার্গেট লোড করা যায়নি।' });
    }
  }

  const body = req.body || {};
  const dealerId = String(body.dealerId || '').trim();
  const targetDate = String(body.date || '');
  const session = normalizeSessionText(body.session);
  const targetAmount = Number(body.targetAmount);
  const range = parseSessionDateRange(session);
  if (!dealerId || !session || !range || !isValidDate(targetDate)
    || targetDate < range.start || targetDate >= range.end
    || String(body.targetAmount ?? '').trim() === ''
    || !Number.isFinite(targetAmount) || targetAmount < 0) {
    return res.status(400).json({ error: 'ডিলার, সেশন, তারিখ ও টার্গেটের পরিমাণ সঠিকভাবে দিন।' });
  }

  try {
    const dealer = await Dealer.findOne({ id: dealerId }).select('id code shopName').lean();
    if (!dealer) return res.status(404).json({ error: 'নির্বাচিত ডিলার পাওয়া যায়নি।' });
    const existing = await DealerSalesTarget.findOne({ dealerId: dealer.id, session })
      .select('id')
      .lean();
    if (existing) {
      return res.status(409).json({ error: 'এই ডিলারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।' });
    }
    const saved = await DealerSalesTarget.create({
      id: `DLR-TARGET-${randomUUID()}`,
      dealerId: dealer.id,
      dealerCode: dealer.code,
      dealerName: dealer.shopName,
      targetDate,
      session,
      targetAmount,
      enteredBy: String(user.officerId || user.id || user.email || '')
    });
    return res.status(201).json(saved.toObject());
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'এই ডিলারের সেশনের টার্গেট অলরেডি ইমপোর্ট করা আছে।' });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: 'ডিলার টার্গেটের তথ্য সঠিক নয়।' });
    }
    console.error('Dealer target save failed:', error);
    return res.status(500).json({ error: 'ডিলার টার্গেট সংরক্ষণ করা যায়নি।' });
  }
}
