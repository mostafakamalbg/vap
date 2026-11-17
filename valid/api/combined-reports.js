import dashboardReports from '../api-handlers/dashboard-reports.js';
import reports from '../api-handlers/reports.js';
import salesOfficers from '../api-handlers/sales-officers.js';

const handlers = {
  'dashboard-reports': dashboardReports,
  reports,
  'sales-officers': salesOfficers
};

export default function handler(req, res) {
  const route = String(req.query?.route || '');
  const selectedHandler = Object.hasOwn(handlers, route) ? handlers[route] : null;
  if (!selectedHandler) return res.status(404).json({ error: 'Not Found' });
  return selectedHandler(req, res);
}
