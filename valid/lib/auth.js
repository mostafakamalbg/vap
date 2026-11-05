import {
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';
import { User } from './models.js';

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
  if (!user || user.status !== 'active') return null;
  return user;
}

export async function authorize(req, res, allowedRoles) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'লগইন করুন।' });
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
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

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    officerId: user.officerId || '',
    officerCode: user.officerCode || '',
    phone: user.phone || ''
  };
}

export function normalizePhone(value) {
  const banglaDigits = '০১২৩৪৫৬৭৮৯';
  return String(value || '')
    .replace(/[০-৯]/g, (digit) => String(banglaDigits.indexOf(digit)))
    .replace(/\D/g, '');
}
