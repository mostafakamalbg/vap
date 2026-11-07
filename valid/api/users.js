import dbConnect from '../lib/mongodb.js';
import mongoose from 'mongoose';
import { BusinessRecord, User } from '../lib/models.js';
import { authorize, hashPassword } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  if (!await authorize(req, res, ['admin'])) return;

  try {
    if (req.method === 'GET') {
      const status = req.query?.status === 'active' ? 'active' : 'pending';
      const users = await User.find({ role: 'officer', status })
        .select('name email officerCode phone createdAt')
        .sort({ createdAt: 1 })
        .lean();
      return res.status(200).json(users.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        officerCode: user.officerCode,
        phone: user.phone,
        createdAt: user.createdAt
      })));
    }

    if (req.body?.action === 'reset-password') {
      const { userId, password } = req.body;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ error: 'সঠিক অফিসার অ্যাকাউন্ট নির্বাচন করুন।' });
      }
      if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
        return res.status(400).json({ error: 'পাসওয়ার্ড ১০ থেকে ১২৮ অক্ষরের মধ্যে হতে হবে।' });
      }
      const updated = await User.updateOne(
        { _id: userId, role: 'officer', status: 'active' },
        { $set: { passwordHash: await hashPassword(password) } }
      );
      if (updated.matchedCount !== 1) {
        return res.status(404).json({ error: 'সক্রিয় অফিসার অ্যাকাউন্টটি পাওয়া যায়নি।' });
      }
      return res.status(200).json({ message: 'অফিসারের পাসওয়ার্ড রিসেট হয়েছে।' });
    }

    const { userId, status } = req.body || {};
    if (!userId || !['active', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid approval request.' });
    }
    const session = await mongoose.startSession();
    let updatedUser;
    try {
      await session.withTransaction(async () => {
        const pendingUser = await User.findOne({ _id: userId, role: 'officer', status: 'pending' }).session(session);
        if (!pendingUser) {
          const error = new Error('Pending officer account not found.');
          error.statusCode = 404;
          throw error;
        }
        pendingUser.status = status;
        updatedUser = await pendingUser.save({ session });

        if (status === 'active') {
          const record = await BusinessRecord.findOne({
            type: 'officers',
            recordId: pendingUser.officerId
          }).session(session);
          const officer = {
            ...(record?.data || {}),
            id: pendingUser.officerId,
            code: pendingUser.officerCode,
            name: pendingUser.name,
            designation: record?.data?.designation || 'ফিল্ড সেলস অফিসার (FSO)',
            territory: record?.data?.territory || '',
            phone: pendingUser.phone,
            joinDate: record?.data?.joinDate || new Date().toISOString().slice(0, 10)
          };
          await BusinessRecord.findOneAndUpdate(
            { type: 'officers', recordId: officer.id },
            { $set: { data: officer } },
            { upsert: true, new: true, session }
          );
        }
      });
    } finally {
      await session.endSession();
    }
    return res.status(200).json({ message: status === 'active' ? 'অফিসার অনুমোদিত হয়েছে।' : 'নিবন্ধন প্রত্যাখ্যান করা হয়েছে।' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Officer approval failed:', error);
    return res.status(500).json({ error: 'অ্যাকাউন্টের অবস্থা পরিবর্তন করা যায়নি।' });
  }
}
