import dashboardReports from './dashboard-reports.js';
import reports from './reports.js';
import salesOfficers from './sales-officers.js';

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
