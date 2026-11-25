import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import { User } from '../../lib/models.js';
import { normalizePhone, publicUser, setSessionCookie, verifyPassword } from '../../lib/auth.js';
import { DEALER_ROLE, isActiveUserStatus } from '../../shared/roles.js';
import { formatDealerCode } from '../../shared/codes.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const dealerCode = formatDealerCode(req.body?.dealerCode);
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || '');
    const user = await User.findOne({
      role: DEALER_ROLE,
      dealerCode,
      phone
    }).select('+passwordHash');
    if (!user || !await verifyPassword(password, user.passwordHash) || !isActiveUserStatus(user.status)) {
      return res.status(401).json({ error: 'ডিলার কোড, ফোন নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' });
    }
    setSessionCookie(res, user._id);
    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof MongoConnectionError) {
      return res.status(503).json({ error: 'ডাটাবেস সাময়িকভাবে উপলব্ধ নয়।' });
    }
    console.error('Dealer login failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'ডিলার লগইন সম্পন্ন করা যায়নি।' });
  }
}
