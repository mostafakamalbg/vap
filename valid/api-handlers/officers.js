import dbConnect from '../lib/mongodb.js';
import { authorize } from '../lib/auth.js';
import { BusinessRecord, SalesOfficer, User } from '../lib/models.js';
import { ADMIN_ROLES, isAdminRole, LOGISTIC_OFFICER_ROLE } from '../shared/roles.js';
import { HIERARCHY_ROLE_VALUES } from '../shared/roles.js';
import { resolveHierarchyScope } from '../lib/hierarchy.js';
import { matchesOfficerScope } from '../shared/hierarchy.js';
import { mergeOfficerRecords } from '../shared/officerIdentity.js';

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
        .select('name role officerId officerCode phone territory asmId rsmId')
        .lean()
    ]);

    const officers = mergeOfficerRecords([
      ...businessRecords.map((record) => record.data),
      ...salesRecords.map((record) => ({
        id: record.officerId,
        officerId: record.officerId,
        code: record.officerCode,
        officerCode: record.officerCode,
        name: record.officerName,
        officerName: record.officerName,
        phone: record.mobileNo,
        mobileNo: record.mobileNo
      })),
      ...users.map((record) => ({
        id: record.officerId,
        officerId: record.officerId,
        code: record.officerCode,
        officerCode: record.officerCode,
        name: record.name,
        phone: record.phone,
        designation: record.role,
        territory: record.territory,
        role: record.role,
        asmId: record.asmId ? String(record.asmId) : '',
        rsmId: record.rsmId ? String(record.rsmId) : '',
        hierarchyUserId: String(record._id)
      }))
    ]).filter((officer) => officer.name);
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
