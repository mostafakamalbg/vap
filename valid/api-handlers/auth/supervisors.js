import dbConnect from '../../lib/mongodb.js';
import { User } from '../../lib/models.js';
import { ASM_ROLE, RSM_ROLE } from '../../shared/roles.js';

const ACTIVE_STATUSES = ['active', 'একটিভ', 'এডমিন', 'সুপার এডমিন'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const role = String(req.query?.role || '');
  if (![ASM_ROLE, RSM_ROLE].includes(role)) {
    return res.status(400).json({ error: 'সুপারভাইজারের ধরন সঠিক নয়।' });
  }
  try {
    const users = await User.find({ role, status: { $in: ACTIVE_STATUSES } })
      .select('name officerCode territory rsmId')
      .sort({ name: 1 })
      .lean();
    return res.status(200).json(users.map((user) => ({
      id: String(user._id),
      name: user.name,
      officerCode: user.officerCode || '',
      territory: user.territory || '',
      rsmId: user.rsmId ? String(user.rsmId) : ''
    })));
  } catch (error) {
    console.error('Supervisor lookup failed:', error);
    return res.status(500).json({ error: 'সুপারভাইজারের তালিকা লোড করা যায়নি।' });
  }
}
