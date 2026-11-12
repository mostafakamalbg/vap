import dbConnect from '../lib/mongodb.js';
import { Dealer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { getDealersWithOfficerCodes } from '../lib/dealerAssignments.js';
import { normalizeDealerAssignment, normalizeOfficerCode, isDealerAssignedToOfficer } from '../shared/codes.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, ['admin', 'officer']);
  if (!user) return;
  if (req.method === 'POST' && user.role !== 'admin') {
    return res.status(403).json({ error: 'এই কাজের অনুমতি নেই।' });
  }
  if (req.method === 'GET') {
    try {
      const { officers, dealers } = await getDealersWithOfficerCodes();
      if (user.role === 'admin') return res.status(200).json(dealers);
      const normalizedUserCode = normalizeOfficerCode(user.officerCode);
      const officer = (user.officerId && officers.find((entry) => (
        String(entry.id || entry.officerId || '') === String(user.officerId || '')
      ))) || (normalizedUserCode && officers.find((entry) => (
        normalizeOfficerCode(entry.code, entry.designation) === normalizedUserCode
      )));
      return res.status(200).json(dealers.filter((dealer) => (
        isDealerAssignedToOfficer(
          dealer,
          user.officerCode || officer?.code,
          officer?.designation
        )
      )));
    } catch (error) {
      console.error('Dealer lookup failed:', error);
      return res.status(500).json({ error: 'ডিলার লোড করা যায়নি।' });
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
