import auth from '../api-handlers/auth.js';
import backup from '../api-handlers/backup.js';
import combinedReports from '../api-handlers/combined-reports.js';
import damageReturns from '../api-handlers/damage-returns.js';
import dealers from '../api-handlers/dealers.js';
import invoices from '../api-handlers/invoices.js';
import officers from '../api-handlers/officers.js';
import orders from '../api-handlers/orders.js';
import payments from '../api-handlers/payments.js';
import products from '../api-handlers/products.js';
import records from '../api-handlers/records.js';
import stockIn from '../api-handlers/stock-in.js';
import users from '../api-handlers/users.js';
import dashboardReports from '../api-handlers/dashboard-reports.js';
import reports from '../api-handlers/reports.js';
import salesOfficers from '../api-handlers/sales-officers.js';

const handlers = {
  backup,
  'combined-reports': combinedReports,
  'damage-returns': damageReturns,
  dealers,
  invoices,
  officers,
  orders,
  payments,
  products,
  records,
  'stock-in': stockIn,
  users,
  'dashboard-reports': dashboardReports,
  reports,
  'sales-officers': salesOfficers
};

function requestPath(value) {
  if (typeof value !== 'string' || !value) return '';
  const absolutePath = value.match(/^https?:\/\/[^/]+([^?#]*)/i);
  const valuePath = absolutePath ? absolutePath[1] || '/' : value;
  const path = valuePath.startsWith('/')
    ? valuePath.split(/[?#]/, 1)[0]
    : `/api/${valuePath.split(/[?#]/, 1)[0]}`;
  return path.startsWith('/api/') ? path : '';
}

export default function handler(req, res) {
  const forwardedPath = req.query?.__path;
  const candidates = [
    Array.isArray(forwardedPath) ? forwardedPath[0] : forwardedPath,
    req.headers?.['x-original-url'],
    req.headers?.['x-forwarded-uri'],
    req.headers?.['x-invoke-path'],
    req.url
  ];
  const path = candidates.map(requestPath).find((candidate) => (
    candidate && candidate !== '/api/index.js' && candidate !== '/api/index'
  ));
  const route = path?.slice('/api/'.length).replace(/\/+$/, '') || '';

  if (route === 'auth' || route.startsWith('auth/')) {
    const authRoute = route.slice('auth/'.length);
    if (authRoute) req.query = { ...req.query, route: authRoute };
    return auth(req, res);
  }

  const selectedHandler = Object.hasOwn(handlers, route) ? handlers[route] : null;
  if (!selectedHandler) return res.status(404).json({ error: 'Not Found' });
  return selectedHandler(req, res);
}
