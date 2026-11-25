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
import dealerTargets from '../api-handlers/dealer-targets.js';
import approvals from '../api-handlers/approvals.js';
import publicDashboard from '../api-handlers/public-dashboard.js';
import farmerOpinions from '../api-handlers/farmer-opinions.js';
import dealerLedger from '../api-handlers/dealer-ledger.js';
import presence from '../api-handlers/presence.js';
import officerPayments from '../api-handlers/officer-payments.js';

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
  'sales-officers': salesOfficers,
  'dealer-targets': dealerTargets,
  approvals,
  'public-dashboard': publicDashboard,
  'farmer-opinions': farmerOpinions,
  'dealer-ledger': dealerLedger,
  presence,
  'officer-payments': officerPayments
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

export default async function handler(req, res) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && res.statusCode <= 599) {
      const errorBody = body && typeof body === 'object' && !Array.isArray(body)
        ? body
        : {};
      return json({
        ...errorBody,
        success: false,
        message: errorBody.message || errorBody.error || 'Request failed.'
      });
    }
    return json(body);
  };

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

  try {
    if (route === 'auth' || route.startsWith('auth/')) {
      const authRoute = route.slice('auth/'.length);
      if (authRoute) req.query = { ...req.query, route: authRoute };
      return await auth(req, res);
    }

    const selectedHandler = Object.hasOwn(handlers, route) ? handlers[route] : null;
    if (!selectedHandler) return res.status(404).json({ error: 'Not Found' });
    return await selectedHandler(req, res);
  } catch (error) {
    console.error(`Unhandled API failure for ${route}:`, error);
    if (res.headersSent || res.writableEnded) return;
    const statusCode = [400, 403, 404, 409].includes(error?.statusCode)
      ? error.statusCode
      : 500;
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'A server error occurred.'
    });
  }
}
