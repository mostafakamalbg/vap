import login from '../api-handlers/auth/login.js';
import me from '../api-handlers/auth/me.js';
import register from '../api-handlers/auth/register.js';

const handlers = { login, me, register };

export default function handler(req, res) {
  const route = String(req.query?.route || '');
  const authHandler = Object.hasOwn(handlers, route) ? handlers[route] : null;
  if (!authHandler) return res.status(404).json({ error: 'Not Found' });
  return authHandler(req, res);
}
