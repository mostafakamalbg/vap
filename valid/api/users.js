import dbConnect from '../lib/mongodb.js';
import mongoose from 'mongoose';
import { BusinessRecord, User } from '../lib/models.js';
import { authorize } from '../lib/auth.js';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  if (!await authorize(req, res, ['admin'])) return;

  try {
    if (req.method === 'GET') {
      const pendingUsers = await User.find({ role: 'officer', status: 'pending' })
        .select('name email officerCode phone createdAt')
        .sort({ createdAt: 1 })
        .lean();
      return res.status(200).json(pendingUsers.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        officerCode: user.officerCode,
        phone: user.phone,
        createdAt: user.createdAt
      })));
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
