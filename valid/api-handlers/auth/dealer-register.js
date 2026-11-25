import { createHash } from 'node:crypto';
import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import { Dealer, User } from '../../lib/models.js';
import { hashPassword, normalizePhone, publicUser, setSessionCookie } from '../../lib/auth.js';
import { DEALER_ROLE } from '../../shared/roles.js';
import { formatDealerCode } from '../../shared/codes.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const dealerCode = formatDealerCode(req.body?.dealerCode);
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || '');
    if (!dealerCode || phone.length < 10 || phone.length > 13 || password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: 'ডিলার কোড, সঠিক ফোন নম্বর এবং কমপক্ষে ১০ অক্ষরের পাসওয়ার্ড দিন।' });
    }

    const dealers = await Dealer.find({}).select('id code shopName phone mobileNo phoneNumber').lean();
    const matchingCode = dealers.filter((entry) => (
      formatDealerCode(entry.code) === dealerCode
    ));
    if (!matchingCode.length) return res.status(404).json({ error: 'ডিলার কোডটি রেকর্ডে পাওয়া যায়নি।' });
    const matchingPhone = matchingCode.filter((entry) => (
      normalizePhone(entry.phone || entry.mobileNo || entry.phoneNumber) === phone
    ));
    if (!matchingPhone.length) {
      return res.status(403).json({ error: 'ফোন নম্বরটি ডিলারের বিদ্যমান রেকর্ডের সঙ্গে মিলছে না।' });
    }
    if (matchingPhone.length > 1) {
      return res.status(409).json({ error: 'এই ডিলার কোড ও ফোন নম্বর একাধিক রেকর্ডে রয়েছে; নিবন্ধনের আগে সহায়তার জন্য যোগাযোগ করুন।' });
    }
    const [dealer] = matchingPhone;
    if (await User.exists({ role: DEALER_ROLE, dealerId: dealer.id })) {
      return res.status(409).json({ error: 'এই ডিলারের অ্যাকাউন্ট ইতোমধ্যে নিবন্ধিত।' });
    }

    const emailDigest = createHash('sha256').update(String(dealer.id)).digest('hex').slice(0, 40);
    const user = await User.create({
      name: dealer.shopName || dealer.code,
      email: `dealer-${emailDigest}@accounts.validagro.invalid`,
      passwordHash: await hashPassword(password),
      role: DEALER_ROLE,
      status: 'active',
      dealerId: dealer.id,
      dealerCode: formatDealerCode(dealer.code),
      phone
    });
    setSessionCookie(res, user._id);
    return res.status(201).json({
      message: 'ডিলার অ্যাকাউন্ট তৈরি হয়েছে।',
      user: publicUser(user)
    });
  } catch (error) {
    if (error instanceof MongoConnectionError) {
      return res.status(503).json({ error: 'ডাটাবেস সাময়িকভাবে উপলব্ধ নয়।' });
    }
    if (error?.code === 11000) return res.status(409).json({ error: 'এই ডিলারের অ্যাকাউন্ট ইতোমধ্যে নিবন্ধিত।' });
    console.error('Dealer registration failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'ডিলার নিবন্ধন সম্পন্ন করা যায়নি।' });
  }
}
