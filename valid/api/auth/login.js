import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import { User } from '../../lib/models.js';
import { publicUser, setSessionCookie, verifyPassword } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'ইমেইল ও পাসওয়ার্ড দিন।' });

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !await verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'অ্যাডমিন অনুমোদনের অপেক্ষায় আছে।' });
    }
    if (user.status !== 'active') return res.status(403).json({ error: 'এই অ্যাকাউন্টটি অনুমোদিত নয়।' });
    if (req.body?.expectedRole && req.body.expectedRole !== user.role) {
      return res.status(403).json({ error: 'নির্বাচিত লগইন ধরনের সঙ্গে এই অ্যাকাউন্টের ভূমিকা মিলছে না।' });
    }

    setSessionCookie(res, user._id);
    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof MongoConnectionError) {
      return res.status(503).json({ error: 'ডাটাবেস সাময়িকভাবে উপলব্ধ নয়।' });
    }
    console.error('Login failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'লগইন সম্পন্ন করা যায়নি।' });
  }
}
