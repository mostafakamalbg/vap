import { timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import dbConnect, { MongoConnectionError } from '../../lib/mongodb.js';
import { User } from '../../lib/models.js';

function isAuthorized(req) {
  const expected = process.env.MONGODB_DIAGNOSTIC_TOKEN;
  const authorization = req.headers.authorization || '';
  if (!expected || expected.length < 32 || !authorization.startsWith('Bearer ')) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expectedBuffer = Buffer.from(expected);
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}

function collectErrors(error) {
  const errors = [];
  const pending = [error];
  const seen = new Set();

  while (pending.length && errors.length < 20) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    errors.push(current);
    if (current.cause) pending.push(current.cause);
    if (current.reason instanceof Error) pending.push(current.reason);
    const servers = current.reason?.servers;
    if (servers && typeof servers.values === 'function') {
      for (const server of servers.values()) {
        if (server?.error) pending.push(server.error);
      }
    }
  }

  return errors;
}

function classifyConnectionError(error) {
  const errors = collectErrors(error);
  const codes = errors.map((entry) => entry.code).filter((code) => (
    typeof code === 'string' || typeof code === 'number'
  ));
  const names = errors.map((entry) => entry.name).filter((name) => typeof name === 'string');
  const messages = errors.map((entry) => (
    typeof entry.message === 'string' ? entry.message.toLowerCase() : ''
  ));

  let category = 'network';
  let message = 'MongoDB network or server-selection failure.';

  if (names.includes('MongoParseError') || codes.includes('ERR_INVALID_URL')) {
    category = 'configuration';
    message = 'MongoDB URI could not be parsed; verify its scheme and URL-encode special characters in credentials.';
  } else if (
    codes.some((code) => [18, 8000].includes(code))
    || messages.some((text) => /authentication failed|bad auth|sasl authentication/i.test(text))
  ) {
    category = 'authentication';
    message = 'MongoDB rejected authentication; verify the Atlas database user and encoded credentials.';
  } else if (
    codes.some((code) => ['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL'].includes(code))
    || messages.some((text) => /querysrv|enotfound|eai_again|eservfail|dns/i.test(text))
  ) {
    category = 'dns';
    message = 'MongoDB hostname or SRV DNS lookup failed.';
  } else if (
    codes.some((code) => ['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code))
    || names.includes('MongoNetworkTimeoutError')
    || messages.some((text) => /timed out|timeout|server selection/i.test(text))
  ) {
    category = 'timeout';
    message = 'MongoDB connection timed out; verify Atlas network access and server availability.';
  } else if (
    names.some((name) => /MongoNetwork|MongoServerSelection|MongoServerClosed/.test(name))
    || codes.some((code) => ['ECONNRESET', 'ECONNREFUSED'].includes(code))
    || messages.some((text) => /tls|ssl|socket|network/i.test(text))
  ) {
    category = 'network';
    message = 'MongoDB network or TLS connection failed; verify Atlas network access and TLS connectivity.';
  }

  const safeCode = codes.find((code) => (
    typeof code === 'number' || /^[A-Z0-9_-]{1,40}$/.test(code)
  ));

  return {
    category,
    errorName: names[0] && /^[A-Za-z0-9_]{1,60}$/.test(names[0]) ? names[0] : 'UnknownError',
    ...(safeCode === undefined ? {} : { errorCode: safeCode }),
    message
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthorized(req)) return res.status(404).json({ error: 'Not Found' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const uriVariable = process.env.MONGODB_URI?.trim()
    ? 'MONGODB_URI'
    : process.env.MONGO_URI?.trim()
      ? 'MONGO_URI'
      : null;
  const sessionSecretConfigured = Boolean(
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
  );

  if (!uriVariable) {
    return res.status(503).json({
      configured: false,
      sessionSecretConfigured,
      ping: 'not_run',
      userQuery: 'not_run',
      category: 'configuration',
      message: 'Set MONGODB_URI or MONGO_URI in this Vercel function environment.'
    });
  }

  let pingSucceeded = false;
  try {
    if (!await dbConnect()) {
      return res.status(503).json({
        configured: true,
        uriVariable,
        sessionSecretConfigured,
        ping: 'not_run',
        userQuery: 'not_run',
        category: 'configuration',
        message: 'MongoDB URI was not available to the connection module.'
      });
    }

    await mongoose.connection.db.admin().command({ ping: 1 });
    pingSucceeded = true;
    const userQueryMatched = Boolean(await User.exists({}));
    return res.status(200).json({
      configured: true,
      uriVariable,
      sessionSecretConfigured,
      ping: 'success',
      userQuery: 'success',
      userQueryMatched
    });
  } catch (error) {
    const details = classifyConnectionError(
      error instanceof MongoConnectionError ? error.cause : error
    );
    const phase = mongoose.connection.readyState !== 1
      ? 'connect'
      : pingSucceeded ? 'query' : 'ping';
    const errorCode = details.errorCode === undefined ? '' : `, code ${details.errorCode}`;
    console.error(`MongoDB diagnostic failed during ${phase} (${details.errorName}${errorCode}).`);

    return res.status(503).json({
      configured: true,
      uriVariable,
      sessionSecretConfigured,
      phase,
      ping: pingSucceeded ? 'success' : phase === 'connect' ? 'not_run' : 'failed',
      userQuery: phase === 'query' ? 'failed' : 'not_run',
      ...details
    });
  }
}
