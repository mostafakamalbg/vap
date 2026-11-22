import {
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';
import { AdminSeat, User } from './models.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import {
  ADMIN_ROLE_VALUES,
  SUPER_ADMIN_ROLE,
  isActiveUserStatus,
  isAdminRole,
  normalizeAdminRole,
  normalizeUserStatus
} from '../shared/roles.js';

const scrypt = promisify(nodeScrypt);
const SESSION_COOKIE = 'vap_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  return secret;
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = String(storedHash || '').split(':');
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sign(value) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => {
      const separator = part.indexOf('=');
      if (separator < 0) return ['', ''];
      return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }).filter(([key]) => key)
  );
}

export function setSessionCookie(res, userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(userId),
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
  })).toString('base64url');
  const value = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_SECONDS}${secure}`
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

function readSession(req) {
  const value = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!value) return null;

  const separator = value.lastIndexOf('.');
  if (separator < 0) return null;
  const payload = value.slice(0, separator);
  const suppliedSignature = Buffer.from(value.slice(separator + 1));
  const expectedSignature = Buffer.from(sign(payload));
  if (
    suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)
  ) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(req) {
  const session = readSession(req);
  if (!session?.sub) return null;
  const user = await User.findById(session.sub).lean();
  if (!user || !isActiveUserStatus(user.status)) return null;
  return normalizeUser(user);
}

export async function hasSuperAdminAccess(user) {
  if (!isAdminRole(user?.role)) return false;
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;
  const primarySeat = await AdminSeat.findById(1).select('email').lean();
  if (primarySeat) return String(primarySeat.email || '').trim().toLowerCase() === email;
  const primaryRoleUser = await User.findOne({ role: SUPER_ADMIN_ROLE })
    .sort({ createdAt: 1, _id: 1 })
    .select('email')
    .lean();
  if (primaryRoleUser) {
    return String(primaryRoleUser.email || '').trim().toLowerCase() === email;
  }

  const authorizedEmails = String(process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (authorizedEmails.length) return authorizedEmails[0] === email;

  if (user.status !== 'সুপার এডমিন') return false;
  const legacyPrimary = await User.findOne({
    role: { $in: ADMIN_ROLE_VALUES },
    status: 'সুপার এডমিন'
  }).sort({ createdAt: 1, _id: 1 }).select('email').lean();
  return String(legacyPrimary?.email || '').trim().toLowerCase() === email;
}

export async function normalizeUser(user) {
  if (isAdminRole(user.role)) {
    user.role = normalizeAdminRole(user.role, await hasSuperAdminAccess(user));
  }
  user.status = normalizeUserStatus(user.status);
  return user;
}

export async function authorize(req, res, allowedRoles) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'লগইন করুন।' });
      return null;
    }
    if (allowedRoles && !allowedRoles.some((role) => (
      role === user.role || (isAdminRole(role) && isAdminRole(user.role))
    ))) {
      res.status(403).json({ error: 'এই কাজের অনুমতি নেই।' });
      return null;
    }
    return user;
  } catch (error) {
    console.error('Authorization failed:', error);
    res.status(500).json({ error: 'অনুমতি যাচাই করা যায়নি।' });
    return null;
  }
}

export function publicUser(user, isSuperAdmin = false) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: normalizeUserStatus(user.status),
    officerId: user.officerId || '',
    officerCode: normalizeOfficerCode(user.officerCode),
    phone: user.phone || '',
    isSuperAdmin: isSuperAdmin || user.role === SUPER_ADMIN_ROLE
  };
}

export function normalizePhone(value) {
  const banglaDigits = '০১২৩৪৫৬৭৮৯';
  const digits = String(value || '')
    .replace(/[০-৯]/g, (digit) => String(banglaDigits.indexOf(digit)))
    .replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('880')
    ? digits.slice(2)
    : digits;
}
