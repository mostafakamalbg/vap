import login from './auth/login.js';
import me from './auth/me.js';
import register from './auth/register.js';
import supervisors from './auth/supervisors.js';
import dealerLogin from './auth/dealer-login.js';
import dealerRegister from './auth/dealer-register.js';

const handlers = {
  login,
  me,
  register,
  supervisors,
  'dealer-login': dealerLogin,
  'dealer-register': dealerRegister
};

export default function handler(req, res) {
  const route = String(req.query?.route || '');
  const authHandler = Object.hasOwn(handlers, route) ? handlers[route] : null;
  if (!authHandler) return res.status(404).json({ error: 'Not Found' });
  return authHandler(req, res);
}
