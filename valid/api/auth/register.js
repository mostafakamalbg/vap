import { randomUUID } from 'node:crypto';
import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import { BusinessRecord, User } from '../../lib/models.js';
import { INITIAL_OFFICERS } from '../../src/data/initialData.js';
import { hashPassword, normalizePhone } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const requestedName = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const officerCode = normalizePhone(req.body?.officerCode);
    const phone = normalizePhone(req.body?.phone);

    if (requestedName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'নাম ও সঠিক ইমেইল ঠিকানা দিন।' });
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।' });
    }
    if (!officerCode || !phone) {
      return res.status(400).json({ error: 'অফিসার কোড ও ফোন নম্বর দিন।' });
    }
    const rosterOfficer = INITIAL_OFFICERS.find((entry) => String(entry.code) === officerCode);
    const savedOfficerRecord = await BusinessRecord.findOne({
      type: 'officers',
      'data.code': officerCode
    }).lean();
    const listedOfficer = rosterOfficer || savedOfficerRecord?.data;
    if (listedOfficer && normalizePhone(listedOfficer.phone) !== phone) {
      return res.status(400).json({ error: 'এই অফিসার কোডের নিবন্ধিত ফোন নম্বরের সঙ্গে মিলছে না।' });
    }
    if (await User.exists({ $or: [{ email }, { officerCode }] })) {
      return res.status(409).json({ error: 'এই ইমেইল বা অফিসার কোড দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।' });
    }

    await User.create({
      name: listedOfficer?.name || requestedName,
      email,
      passwordHash: await hashPassword(password),
      role: 'officer',
      status: 'pending',
      officerId: listedOfficer?.id || `OFF-${randomUUID().slice(0, 8).toUpperCase()}`,
      officerCode,
      phone: listedOfficer?.phone || phone
    });
    return res.status(201).json({ message: 'নিবন্ধন সফল। অ্যাডমিন অনুমোদনের পর লগইন করতে পারবেন।' });
  } catch (error) {
    if (error instanceof MongoConnectionError) {
      return res.status(503).json({ error: 'ডাটাবেস সাময়িকভাবে উপলব্ধ নয়।' });
    }
    if (error?.code === 11000) return res.status(409).json({ error: 'এই ইমেইল দিয়ে অ্যাকাউন্ট আছে।' });
    console.error('Officer registration failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'নিবন্ধন সম্পন্ন করা যায়নি।' });
  }
}
