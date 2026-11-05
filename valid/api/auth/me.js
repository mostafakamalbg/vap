import dbConnect from '../../lib/mongodb.js';
import { getSessionUser, publicUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'লগইন করা নেই।' });
    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    console.error('Session lookup failed:', error);
    return res.status(500).json({ error: 'সেশন যাচাই করা যায়নি।' });
  }
}
