import { clearSessionCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  clearSessionCookie(res);
  return res.status(200).json({ message: 'লগআউট সম্পন্ন হয়েছে।' });
}
