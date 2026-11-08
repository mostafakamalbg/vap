import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import {
  clearSessionCookie,
  getSessionUser,
  hasSuperAdminAccess,
  publicUser
} from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    clearSessionCookie(res);
    return res.status(200).json({ message: 'লগআউট সম্পন্ন হয়েছে।' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'লগইন করা নেই।' });
    return res.status(200).json({
      user: publicUser(user, user.role === 'admin' && await hasSuperAdminAccess(user))
    });
  } catch (error) {
    if (error instanceof MongoConnectionError) {
      return res.status(503).json({ error: 'ডাটাবেস সাময়িকভাবে উপলব্ধ নয়।' });
    }
    console.error('Session lookup failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'সেশন যাচাই করা যায়নি।' });
  }
}
