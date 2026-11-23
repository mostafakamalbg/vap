import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { BusinessRecord, SalesOfficer, User } from '../lib/models.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import { ADMIN_ROLES, isAdminRole, LOGISTIC_OFFICER_ROLE } from '../shared/roles.js';
import { HIERARCHY_ROLE_VALUES } from '../shared/roles.js';
import { resolveHierarchyScope } from '../lib/hierarchy.js';
import { matchesOfficerScope } from '../shared/hierarchy.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, [
    ...ADMIN_ROLES,
    ...HIERARCHY_ROLE_VALUES,
    LOGISTIC_OFFICER_ROLE
  ]);
  if (!user) return;

  try {
    const [businessRecords, salesRecords, users] = await Promise.all([
      BusinessRecord.find({ type: 'officers' }).select('data').lean(),
      SalesOfficer.find({}).sort({ slNo: 1 }).lean(),
      User.find({
        role: { $in: HIERARCHY_ROLE_VALUES },
        status: { $in: ['active', 'একটিভ', 'এডমিন', 'সুপার এডমিন'] }
      })
        .select('name role officerId officerCode phone territory')
        .lean()
    ]);

    const merged = new Map();
    const add = (record) => {
      if (!record) return;
      const code = normalizeOfficerCode(
        record.code || record.officerCode,
        record.designation
      );
      const id = String(record.id || record.officerId || (code ? `OFF-${code}` : '')).trim();
      if (!id && !code) return;
      const key = code || id;
      const previous = merged.get(key) || {};
      merged.set(key, {
        ...previous,
        ...record,
        id,
        code,
        name: String(record.name || record.officerName || record.fullName || previous.name || '').trim(),
        officerId: String(record.officerId || previous.officerId || id).trim(),
        phone: String(record.phone || record.mobileNo || previous.phone || '').trim(),
        designation: String(record.designation || previous.designation || '').trim()
      });
    };

    businessRecords.forEach((entry) => add(entry.data));
    salesRecords.forEach((record) => add({
      id: record.officerId,
      officerId: record.officerId,
      code: record.officerCode,
      officerCode: record.officerCode,
      name: record.officerName,
      officerName: record.officerName,
      phone: record.mobileNo,
      mobileNo: record.mobileNo
    }));
    users.forEach((record) => add({
      id: record.officerId,
      officerId: record.officerId,
      code: record.officerCode,
      officerCode: record.officerCode,
      name: record.name,
      phone: record.phone,
      designation: record.role,
      territory: record.territory
    }));

    const officers = [...merged.values()].filter((officer) => officer.name);
    if (isAdminRole(user.role) || user.role === LOGISTIC_OFFICER_ROLE) {
      return res.status(200).json(officers);
    }
    const scope = await resolveHierarchyScope(user);
    return res.status(200).json(officers.filter((officer) => matchesOfficerScope({
      officerId: officer.id,
      officerCode: officer.code,
      officerName: officer.name
    }, scope)));
  } catch (error) {
    console.error('Officer lookup failed:', error);
    return res.status(500).json({ error: 'অফিসারের তালিকা লোড করা যায়নি।' });
  }
}
