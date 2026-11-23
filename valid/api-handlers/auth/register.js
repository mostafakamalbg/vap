import { randomUUID } from 'node:crypto';
import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import { BusinessRecord, User } from '../../lib/models.js';
import { INITIAL_OFFICERS } from '../../src/data/initialData.js';
import { hashPassword, normalizePhone } from '../../lib/auth.js';
import { normalizeOfficerCode } from '../../shared/codes.js';
import mongoose from 'mongoose';
import {
  ASM_ROLE,
  LOGISTIC_OFFICER_ROLE,
  GENERAL_ADMIN_ROLE,
  RSM_ROLE,
  SO_ROLE,
  OFFICER_ROLE
} from '../../shared/roles.js';

const ACTIVE_STATUSES = ['active', 'একটিভ', 'এডমিন', 'সুপার এডমিন'];
const REGISTRABLE_ROLES = [
  RSM_ROLE,
  ASM_ROLE,
  SO_ROLE,
  LOGISTIC_OFFICER_ROLE,
  GENERAL_ADMIN_ROLE
];

function registrationCode(value, role) {
  const raw = String(value || '').trim().toUpperCase();
  return [SO_ROLE, ASM_ROLE, RSM_ROLE, OFFICER_ROLE].includes(role)
    ? normalizeOfficerCode(raw, role)
    : raw;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    const requestedName = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || '');
    const officerCode = registrationCode(req.body?.officerCode, role);
    const phone = normalizePhone(req.body?.phone);
    const territory = String(req.body?.territory || '').trim().slice(0, 120);

    if (requestedName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'নাম ও সঠিক ইমেইল ঠিকানা দিন।' });
    }
    if (!REGISTRABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'নিবন্ধনের জন্য সঠিক পদবি নির্বাচন করুন।' });
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।' });
    }
    const isSalesRole = [SO_ROLE, OFFICER_ROLE].includes(role);
    if (isSalesRole && (!officerCode || !phone)) {
      return res.status(400).json({ error: 'অফিসার কোড ও ফোন নম্বর দিন।' });
    }
    if (req.body?.rsmId && !mongoose.isValidObjectId(req.body.rsmId)) {
      return res.status(400).json({ error: 'সঠিক RSM নির্বাচন করুন।' });
    }
    if (req.body?.asmId && !mongoose.isValidObjectId(req.body.asmId)) {
      return res.status(400).json({ error: 'সঠিক ASM নির্বাচন করুন।' });
    }

    let rsm = null;
    let asm = null;
    if (role === ASM_ROLE) {
      if (!req.body?.rsmId) return res.status(400).json({ error: 'সুপারভাইজিং RSM নির্বাচন করুন।' });
      rsm = await User.findOne({
        _id: req.body.rsmId,
        role: RSM_ROLE,
        status: { $in: ACTIVE_STATUSES }
      }).select('_id');
      if (!rsm) return res.status(400).json({ error: 'সক্রিয় RSM নির্বাচন করুন।' });
    }
    if (isSalesRole) {
      if (!req.body?.asmId) return res.status(400).json({ error: 'সুপারভাইজিং ASM নির্বাচন করুন।' });
      asm = await User.findOne({
        _id: req.body.asmId,
        role: ASM_ROLE,
        status: { $in: ACTIVE_STATUSES }
      }).select('_id rsmId');
      if (!asm) return res.status(400).json({ error: 'সক্রিয় ASM নির্বাচন করুন।' });
      rsm = asm.rsmId
        ? await User.findOne({
            _id: asm.rsmId,
            role: RSM_ROLE,
            status: { $in: ACTIVE_STATUSES }
          }).select('_id')
        : null;
      if (!rsm) return res.status(409).json({ error: 'নির্বাচিত ASM-এর RSM নির্ধারিত নেই।' });
    }

    const savedOfficerRecords = await BusinessRecord.find({ type: 'officers' }).lean();
    const savedOfficerRecord = savedOfficerRecords.find((record) => (
      normalizeOfficerCode(record.data?.code, record.data?.designation) === officerCode
    ));
    const rosterOfficer = INITIAL_OFFICERS.find((entry) => (
      normalizeOfficerCode(entry.code) === officerCode
      || normalizeOfficerCode(entry.code, entry.designation) === officerCode
    ));
    const listedOfficer = isSalesRole ? savedOfficerRecord?.data || rosterOfficer : null;
    const registeredPhone = normalizePhone(listedOfficer?.phone);
    const officerPhoneMismatch = Boolean(listedOfficer && registeredPhone !== phone);
    const existingUsers = await User.find({ officerCode: { $ne: '' } }).select('officerCode').lean();
    if (
      await User.exists({ email })
      || (officerCode && existingUsers.some((user) => (
        registrationCode(user.officerCode, user.role) === officerCode
      )))
    ) {
      return res.status(409).json({ error: 'এই ইমেইল বা অফিসার কোড দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।' });
    }

    await User.create({
      name: listedOfficer?.name || requestedName,
      email,
      passwordHash: await hashPassword(password),
      role,
      status: 'pending',
      officerId: isSalesRole
        ? listedOfficer?.id || listedOfficer?.officerId || `OFF-${randomUUID().slice(0, 8).toUpperCase()}`
        : '',
      officerCode,
      territory,
      rsmId: rsm?._id || null,
      asmId: asm?._id || null,
      phone,
      officerPhoneMismatch,
      registeredOfficerPhone: officerPhoneMismatch ? listedOfficer.phone : ''
    });
    return res.status(201).json({
      message: 'নিবন্ধন সফল। অ্যাডমিন অনুমোদনের পর লগইন করতে পারবেন।',
      officerPhoneMismatch,
      warning: officerPhoneMismatch
        ? 'আপনার দেওয়া ফোন নম্বরটি অফিসার কোডের নিবন্ধিত নম্বরের সঙ্গে মেলেনি। আবেদনটি অ্যাডমিন পর্যালোচনা করবেন।'
        : ''
    });
  } catch (error) {
    if (error instanceof MongoConnectionError) {
      return res.status(503).json({ error: 'ডাটাবেস সাময়িকভাবে উপলব্ধ নয়।' });
    }
    if (error?.code === 11000) return res.status(409).json({ error: 'এই ইমেইল দিয়ে অ্যাকাউন্ট আছে।' });
    console.error('Officer registration failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'নিবন্ধন সম্পন্ন করা যায়নি।' });
  }
}
