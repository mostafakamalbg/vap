import dbConnect from '../lib/mongodb.js';
import mongoose from 'mongoose';
import { BusinessRecord, User } from '../lib/models.js';
import { authorize, hashPassword } from '../lib/auth.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import {
  ADMIN_ROLES,
  ASM_ROLE,
  GENERAL_ADMIN_ROLE,
  LOGISTIC_OFFICER_ROLE,
  OFFICER_ROLE,
  RSM_ROLE,
  SO_ROLE,
  isSalesOfficerRole
} from '../shared/roles.js';

const MANAGED_ROLES = [
  RSM_ROLE,
  ASM_ROLE,
  SO_ROLE,
  OFFICER_ROLE,
  LOGISTIC_OFFICER_ROLE,
  GENERAL_ADMIN_ROLE
];
const ACTIVE_STATUSES = ['active', 'একটিভ', 'এডমিন', 'সুপার এডমিন'];

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  if (!await authorize(req, res, ADMIN_ROLES)) return;

  try {
    if (req.method === 'GET') {
      const status = req.query?.status === 'active' ? 'active' : 'pending';
      const users = await User.find({
        role: { $in: MANAGED_ROLES },
        status: status === 'active' ? { $in: ACTIVE_STATUSES } : 'pending'
      })
        .select('name email role officerId officerCode phone territory rsmId asmId officerPhoneMismatch registeredOfficerPhone createdAt')
        .sort({ createdAt: 1 })
        .lean();
      return res.status(200).json(users.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        officerId: user.officerId || '',
        officerCode: user.officerCode,
        phone: user.phone,
        territory: user.territory || '',
        rsmId: user.rsmId ? String(user.rsmId) : '',
        asmId: user.asmId ? String(user.asmId) : '',
        officerPhoneMismatch: Boolean(user.officerPhoneMismatch),
        registeredOfficerPhone: user.registeredOfficerPhone || '',
        createdAt: user.createdAt
      })));
    }

    if (req.body?.action === 'hierarchy') {
      const { userId, rsmId, asmId, role } = req.body;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ error: 'সঠিক ব্যবহারকারী নির্বাচন করুন।' });
      }
      const target = await User.findById(userId);
      if (!target || !ACTIVE_STATUSES.includes(target.status)) {
        return res.status(404).json({ error: 'সক্রিয় ব্যবহারকারী পাওয়া যায়নি।' });
      }
      const assignableRoles = [RSM_ROLE, ASM_ROLE, SO_ROLE, OFFICER_ROLE, LOGISTIC_OFFICER_ROLE];
      const roleChanged = Boolean(role && role !== target.role);
      if (roleChanged && !assignableRoles.includes(role)) {
        return res.status(400).json({ error: 'নির্বাচিত ব্যবহারকারী পদবি সমর্থিত নয়।' });
      }
      if (roleChanged) target.role = role;
      let rsm = null;
      let asm = null;
      if (target.role === ASM_ROLE) {
        if (!rsmId && roleChanged) {
          target.rsmId = null;
          target.asmId = null;
          await target.save();
          return res.status(200).json({ message: 'পদবি আপডেট হয়েছে; RSM সংযুক্ত করুন।' });
        }
        if (!mongoose.isValidObjectId(rsmId)) {
          return res.status(400).json({ error: 'সুপারভাইজিং RSM নির্বাচন করুন।' });
        }
        rsm = await User.findOne({
          _id: rsmId,
          role: RSM_ROLE,
          status: { $in: ACTIVE_STATUSES }
        }).select('_id');
        if (!rsm) return res.status(400).json({ error: 'সক্রিয় RSM নির্বাচন করুন।' });
      } else if (isSalesOfficerRole(target.role)) {
        if (!asmId && roleChanged) {
          target.rsmId = null;
          target.asmId = null;
          await target.save();
          return res.status(200).json({ message: 'পদবি আপডেট হয়েছে; ASM সংযুক্ত করুন।' });
        }
        if (!mongoose.isValidObjectId(asmId)) {
          return res.status(400).json({ error: 'সুপারভাইজিং ASM নির্বাচন করুন।' });
        }
        asm = await User.findOne({
          _id: asmId,
          role: ASM_ROLE,
          status: { $in: ACTIVE_STATUSES }
        }).select('_id rsmId');
        if (!asm?.rsmId) return res.status(400).json({ error: 'সক্রিয় RSM-সহ ASM নির্বাচন করুন।' });
        rsm = await User.findOne({
          _id: asm.rsmId,
          role: RSM_ROLE,
          status: { $in: ACTIVE_STATUSES }
        }).select('_id');
        if (!rsm) return res.status(400).json({ error: 'ASM-এর সক্রিয় RSM নির্ধারিত নেই।' });
      } else if (![RSM_ROLE, LOGISTIC_OFFICER_ROLE, GENERAL_ADMIN_ROLE].includes(target.role)) {
        return res.status(400).json({ error: 'এই ব্যবহারকারীর জন্য hierarchy assignment প্রযোজ্য নয়।' });
      }
      target.rsmId = rsm?._id || null;
      target.asmId = asm?._id || null;
      await target.save();
      return res.status(200).json({
        message: 'অফিসারের hierarchy সংরক্ষণ হয়েছে।',
        user: {
          id: String(target._id),
          rsmId: target.rsmId ? String(target.rsmId) : '',
          asmId: target.asmId ? String(target.asmId) : ''
        }
      });
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
        { _id: userId, role: { $in: MANAGED_ROLES }, status: { $in: ACTIVE_STATUSES } },
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
        const pendingUser = await User.findOne({
          _id: userId,
          role: { $in: MANAGED_ROLES },
          status: 'pending'
        }).session(session);
        if (!pendingUser) {
          const error = new Error('Pending officer account not found.');
          error.statusCode = 404;
          throw error;
        }
        pendingUser.status = status;
        updatedUser = await pendingUser.save({ session });

        if (status === 'active' && isSalesOfficerRole(pendingUser.role)) {
          const normalizedCode = normalizeOfficerCode(pendingUser.officerCode);
          const record = await BusinessRecord.findOne({
            type: 'officers',
            $or: [
              { recordId: pendingUser.officerId },
              { 'data.id': pendingUser.officerId },
              { 'data.officerId': pendingUser.officerId },
              { 'data.code': pendingUser.officerCode },
              { 'data.code': normalizedCode }
            ]
          }).session(session);
          const officer = {
            ...(record?.data || {}),
            id: pendingUser.officerId,
            code: pendingUser.officerCode,
            name: pendingUser.name,
            designation: record?.data?.designation || 'সেলস অফিসার (SO)',
            territory: record?.data?.territory || '',
            phone: pendingUser.officerPhoneMismatch
              ? pendingUser.registeredOfficerPhone
              : pendingUser.phone,
            joinDate: record?.data?.joinDate || new Date().toISOString().slice(0, 10)
          };
          await BusinessRecord.findOneAndUpdate(
            { type: 'officers', recordId: record?.recordId || officer.id },
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
