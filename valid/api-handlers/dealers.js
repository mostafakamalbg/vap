import dbConnect from '../lib/mongodb.js';
import { hasSuperAdminAccess } from '../lib/auth.js';
import { Dealer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { getDealersWithOfficerCodes } from '../lib/dealerAssignments.js';
import { normalizeDealerAssignment, normalizeOfficerCode } from '../shared/codes.js';
import { normalizeSessionText } from '../shared/sessions.js';
import { parseSessionDateRange } from '../shared/reportDateFilters.js';
import { ADMIN_ROLES, LOGISTIC_OFFICER_ROLE, isAdminRole } from '../shared/roles.js';
import { HIERARCHY_ROLE_VALUES } from '../shared/roles.js';
import { resolveHierarchyScope } from '../lib/hierarchy.js';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, [...ADMIN_ROLES, ...HIERARCHY_ROLE_VALUES, LOGISTIC_OFFICER_ROLE]);
  if (!user) return;
  if (req.method === 'POST' && !isAdminRole(user.role) && user.role !== LOGISTIC_OFFICER_ROLE) {
    return res.status(403).json({ error: 'এই কাজের অনুমতি নেই।' });
  }
  if (req.method === 'PATCH' && !await hasSuperAdminAccess(user)) {
    return res.status(403).json({ error: 'পূর্বের বকেয়া পরিবর্তনের অনুমতি শুধু সুপার অ্যাডমিনের।' });
  }
  if (req.method === 'GET') {
    try {
      const { officers, dealers } = await getDealersWithOfficerCodes();
      if (isAdminRole(user.role)) return res.status(200).json(dealers);
      const scope = await resolveHierarchyScope(user);
      const codes = new Set([...scope.officerCodes]
        .map((code) => normalizeOfficerCode(code))
        .filter(Boolean));
      return res.status(200).json(dealers.filter((dealer) => (
        codes.has(normalizeOfficerCode(dealer.officerCode))
        || scope.officerIds.has(String(dealer.previousDueOfficerId || ''))
      )));
    } catch (error) {
      console.error('Dealer lookup failed:', error);
      return res.status(500).json({ error: 'ডিলার লোড করা যায়নি।' });
    }
  }

  if (req.method === 'PATCH') {
    const { dealerId, officerId, session, date, amount } = req.body || {};
    const dateValue = String(date || '');
    const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);
    if (!String(dealerId || '').trim()
      || !String(officerId || '').trim()
      || !String(session || '').trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      || Number.isNaN(parsedDate.valueOf())
      || parsedDate.toISOString().slice(0, 10) !== dateValue
      || !Number.isFinite(Number(amount))
      || Number(amount) < 0
      || !parseSessionDateRange(normalizeSessionText(session))) {
      return res.status(400).json({
        error: 'ডিলার, অফিসার, সেশন, তারিখ ও পূর্বের বকেয়া সঠিকভাবে দিন।'
      });
    }
    try {
      const due = Math.round(Number(amount));
      const normalizedSession = normalizeSessionText(session);
      const dealer = await Dealer.findOneAndUpdate(
        { id: String(dealerId) },
        {
          $set: {
            previousDue: due,
            openingDue: due,
            lastSessionDue: due,
            previousDueSession: normalizedSession,
            previousDueDate: dateValue,
            previousDueOfficerId: String(officerId)
          },
          $push: {
            previousDueHistory: {
              date: dateValue,
              session: normalizedSession,
              amount: due,
              officerId: String(officerId),
              postedAt: new Date()
            }
          }
        },
        { new: true, runValidators: true }
      ).lean();
      if (!dealer) return res.status(404).json({ error: 'ডিলার পাওয়া যায়নি।' });
      return res.status(200).json(dealer);
    } catch (error) {
      console.error('Previous due save failed:', error);
      return res.status(500).json({ error: 'পূর্বের বকেয়া সংরক্ষণ করা যায়নি।' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { officers } = await getDealersWithOfficerCodes();
      const dealer = normalizeDealerAssignment(req.body, officers);
      delete dealer._id;
      const newDealer = await Dealer.findOneAndUpdate(
        { id: req.body.id },
        {
          $set: dealer,
          $unset: {
            assignedOfficerId: 1,
            assignedOfficerCode: 1,
            officerId: 1
          }
        },
        { upsert: true, new: true }
      );
      return res.status(201).json(newDealer);
    } catch (error) {
      console.error('Dealer save failed:', error);
      return res.status(500).json({ error: 'ডিলার সংরক্ষণ করা যায়নি।' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
