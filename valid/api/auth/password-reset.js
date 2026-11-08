import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import { hashPassword, normalizePhone } from '../../lib/auth.js';
import { PasswordResetChallenge, User } from '../../lib/models.js';

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function isLocalOtpMode() {
  return process.env.NODE_ENV === 'development'
    && process.env.OTP_DELIVERY_MODE === 'console';
}

function hashOtp(otp, userId) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET is not configured.');
  return createHmac('sha256', secret).update(`${userId}:${otp}`).digest('hex');
}

function toBangladeshNumber(value) {
  const digits = normalizePhone(value);
  if (digits.startsWith('880') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+880${digits.slice(1)}`;
  if (digits.length === 10) return `+880${digits}`;
  throw new Error('নিবন্ধিত মোবাইল নম্বরটি SMS পাঠানোর উপযোগী নয়।');
}

async function sendSms(to, otp) {
  if (isLocalOtpMode()) {
    const maskedPhone = to.replace(/\d(?=\d{4})/g, '*');
    console.info(`[TEST OTP] Phone: ${maskedPhone}, OTP: ${otp}`);
    return;
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('পাসওয়ার্ড রিকভারির SMS সেবা কনফিগার করা নেই।');
  }
  const body = new URLSearchParams({
    To: to,
    From: TWILIO_FROM_NUMBER,
    Body: `Valid Agro password reset code: ${otp}. It expires in 10 minutes.`
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    }
  );
  if (!response.ok) {
    console.error('Password recovery SMS failed with Twilio status:', response.status);
    throw new Error('SMS পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।');
  }
}

async function findOfficer(identifier) {
  if (identifier.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return null;
    return User.findOne({
      email: identifier.toLowerCase(),
      role: 'officer',
      status: 'active'
    }).select('_id phone');
  }

  const normalizedPhone = normalizePhone(identifier);
  if (normalizedPhone.length < 10) return null;
  const officers = await User.find({ role: 'officer', status: 'active' })
    .select('_id phone')
    .lean();
  return officers.find((officer) => normalizePhone(officer.phone) === normalizedPhone) || null;
}

function matchesOtp(supplied, expected) {
  const suppliedBuffer = Buffer.from(supplied, 'hex');
  const expectedBuffer = Buffer.from(expected || '', 'hex');
  return suppliedBuffer.length === expectedBuffer.length
    && suppliedBuffer.length > 0
    && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });

  const action = req.body?.action;
  if (!['request', 'confirm'].includes(action)) {
    return res.status(400).json({ error: 'Invalid password recovery request.' });
  }
  if (
    action === 'request'
    && !isLocalOtpMode()
    && (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER)
  ) {
    return res.status(503).json({ error: 'পাসওয়ার্ড রিকভারির SMS সেবা কনফিগার করা নেই।' });
  }

  try {
    const identifier = String(req.body?.identifier || '').trim();
    const officer = await findOfficer(identifier);
    if (action === 'request') {
      if (officer) {
        const recentChallenge = await PasswordResetChallenge.findOne({
          userId: officer._id,
          updatedAt: { $gt: new Date(Date.now() - OTP_RESEND_DELAY_MS) }
        }).select('_id').lean();
        if (!recentChallenge) {
          const otp = String(randomInt(100000, 1000000));
          const expiresAt = new Date(Date.now() + OTP_LIFETIME_MS);
          await PasswordResetChallenge.findOneAndUpdate(
            { userId: officer._id },
            { $set: { tokenHash: hashOtp(otp, officer._id), attempts: 0, expiresAt } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          try {
            await sendSms(toBangladeshNumber(officer.phone), otp);
          } catch (error) {
            await PasswordResetChallenge.deleteOne({ userId: officer._id });
            if (error.message.includes('কনফিগার করা নেই')) {
              return res.status(503).json({ error: error.message });
            }
            return res.status(502).json({ error: error.message });
          }
        }
      }
      return res.status(200).json({
        message: 'তথ্য মিললে নিবন্ধিত মোবাইলে OTP পাঠানো হবে।'
      });
    }

    const otp = String(req.body?.otp || '').trim();
    const password = String(req.body?.password || '');
    if (!officer || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'OTP অথবা অ্যাকাউন্টের তথ্য সঠিক নয় বা মেয়াদ শেষ।' });
    }
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: 'পাসওয়ার্ড ১০ থেকে ১২৮ অক্ষরের মধ্যে হতে হবে।' });
    }
    const challenge = await PasswordResetChallenge.findOne({
      userId: officer._id,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_OTP_ATTEMPTS }
    }).lean();
    if (!challenge) {
      return res.status(400).json({ error: 'OTP অথবা অ্যাকাউন্টের তথ্য সঠিক নয় বা মেয়াদ শেষ।' });
    }

    const suppliedHash = hashOtp(otp, officer._id);
    if (!matchesOtp(suppliedHash, challenge.tokenHash)) {
      await PasswordResetChallenge.updateOne(
        { _id: challenge._id, attempts: { $lt: MAX_OTP_ATTEMPTS } },
        { $inc: { attempts: 1 } }
      );
      return res.status(400).json({ error: 'OTP অথবা অ্যাকাউন্টের তথ্য সঠিক নয় বা মেয়াদ শেষ।' });
    }

    const consumedChallenge = await PasswordResetChallenge.findOneAndDelete({
      _id: challenge._id,
      tokenHash: suppliedHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_OTP_ATTEMPTS }
    });
    if (!consumedChallenge) {
      return res.status(400).json({ error: 'OTP অথবা অ্যাকাউন্টের তথ্য সঠিক নয় বা মেয়াদ শেষ।' });
    }
    const updated = await User.updateOne(
      { _id: officer._id, role: 'officer', status: 'active' },
      { $set: { passwordHash: await hashPassword(password) } }
    );
    if (updated.matchedCount !== 1) {
      return res.status(404).json({ error: 'অ্যাকাউন্টটি আর সক্রিয় নেই।' });
    }
    return res.status(200).json({
      message: 'পাসওয়ার্ড পরিবর্তন হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
    });
  } catch (error) {
    if (error instanceof MongoConnectionError) {
      return res.status(503).json({ error: 'ডাটাবেস সাময়িকভাবে উপলব্ধ নয়।' });
    }
    console.error('Password recovery failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'পাসওয়ার্ড রিকভারি সম্পন্ন করা যায়নি।' });
  }
}