import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { User } from '../lib/models.js';
import { ADMIN_ROLES, DEALER_ROLE, LOGISTIC_OFFICER_ROLE, isAdminRole } from '../shared/roles.js';

const ONLINE_WINDOW_MS = 90 * 1000;
const VISIBLE_WINDOW_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const allowedRoles = [...ADMIN_ROLES, LOGISTIC_OFFICER_ROLE];
  const user = await authorize(req, res, req.method === 'POST' ? null : allowedRoles);
  if (!user) return;

  try {
    if (req.method === 'POST') {
      if (user.role === DEALER_ROLE) return res.status(403).json({ error: 'এই সেশনের heartbeat অনুমোদিত নয়।' });
      const lastActiveAt = new Date();
      await User.updateOne({ _id: user._id }, { $set: { lastActiveAt } });
      return res.status(200).json({ lastActiveAt });
    }
    if (!isAdminRole(user.role) && user.role !== LOGISTIC_OFFICER_ROLE) {
      return res.status(403).json({ error: 'সক্রিয় ব্যবহারকারী তালিকা দেখার অনুমতি নেই।' });
    }

    const now = Date.now();
    const users = await User.find({
      lastActiveAt: { $gte: new Date(now - VISIBLE_WINDOW_MS) },
      role: { $nin: ['Dealer'] }
    }).select('name role lastActiveAt').sort({ lastActiveAt: -1 }).lean();
    return res.status(200).json(users.map((entry) => ({
      name: entry.name,
      role: entry.role,
      lastActiveAt: entry.lastActiveAt,
      status: now - new Date(entry.lastActiveAt).valueOf() <= ONLINE_WINDOW_MS ? 'online' : 'away'
    })));
  } catch (error) {
    console.error('Presence request failed:', error);
    return res.status(500).json({ error: 'সক্রিয় ব্যবহারকারীর তথ্য লোড করা যায়নি।' });
  }
}
