import { createHash } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, User } from '../lib/models.js';
import {
  DEALER_ROLE,
  HIERARCHY_ROLE_VALUES,
  LEGACY_ACTIVE_STATUSES,
  LOGISTIC_OFFICER_ROLE
} from '../shared/roles.js';
import { normalizeOfficerCode } from '../shared/codes.js';

const ACTIVE_STATUSES = ['active', ...LEGACY_ACTIVE_STATUSES];

function publicOpinion(record) {
  const opinion = record.data || {};
  return {
    id: String(record.recordId),
    farmerName: opinion.showNamePublicly ? opinion.farmerName : '',
    district: opinion.district || '',
    opinion: opinion.opinion || '',
    photoDataUrl: opinion.photo?.dataUrl || '',
    approvedAt: opinion.approvedAt || null,
    isSavedToGallery: Boolean(opinion.isSavedToGallery)
  };
}

function staffIdentity(record, fallback = '') {
  const identity = normalizeOfficerCode(
    record.officerCode || record.code || record.officerId || record.id,
    record.designation
  );
  return identity || String(record.officerId || record.id || fallback || record.email || '').trim().toUpperCase();
}

export function getOrganizationCounts(users, dealerCount, officerRecords) {
  const staffIdentities = new Set();
  const officerIdentities = new Set();
  const logisticIdentities = new Set();
  users.forEach((user) => {
    const identity = staffIdentity(user, user._id);
    staffIdentities.add(identity);
    if (HIERARCHY_ROLE_VALUES.includes(user.role)) officerIdentities.add(identity);
    if (user.role === LOGISTIC_OFFICER_ROLE) logisticIdentities.add(identity);
  });
  officerRecords.forEach((record) => {
    const officer = record.data || {};
    const identity = staffIdentity(officer, record.recordId);
    staffIdentities.add(identity);
    if (officer.designation && /(?:\b(?:rsm|asm|sales officer|so|tso)\b|ফিল্ড|সেলস)/i.test(officer.designation)) {
      officerIdentities.add(identity);
    }
    if (/(?:logistic|লজিস্টিক)/i.test(String(officer.designation || ''))) {
      logisticIdentities.add(identity);
    }
  });

  return {
    employees: staffIdentities.size,
    officers: officerIdentities.size,
    dealers: dealerCount || 0,
    logisticOfficers: logisticIdentities.size
  };
}

async function getDashboard(res) {
  const [users, dealerCount, officerRecords, visitCount, approvedOpinions] = await Promise.all([
    User.find({ status: { $in: ACTIVE_STATUSES }, role: { $ne: DEALER_ROLE } })
      .select('role officerId officerCode email')
      .lean(),
    Dealer.countDocuments({}),
    BusinessRecord.find({ type: 'officers' }).select('recordId data').lean(),
    BusinessRecord.countDocuments({ type: 'publicEngagement', 'data.kind': 'visit' }),
    BusinessRecord.find({ type: 'farmerOpinions', 'data.status': 'approved' })
      .select('recordId data')
      .lean()
  ]);

  const farmersByKey = new Map();
  approvedOpinions.forEach((record) => {
    const opinion = record.data || {};
    const key = String(opinion.farmerKey || record.recordId);
    const district = String(opinion.district || 'জেলা উল্লেখ নেই').trim();
    const farmer = farmersByKey.get(key) || { district, name: '' };
    if (!farmer.name && opinion.showNamePublicly) farmer.name = String(opinion.farmerName || '');
    farmersByKey.set(key, farmer);
  });
  const districtGroups = new Map();
  farmersByKey.forEach(({ district, name }) => {
    const group = districtGroups.get(district) || { district, count: 0, farmers: [] };
    group.count += 1;
    if (name && !group.farmers.includes(name)) group.farmers.push(name);
    districtGroups.set(district, group);
  });

  return res.status(200).json({
    organization: getOrganizationCounts(users, dealerCount, officerRecords),
    engagement: {
      customerVisits: visitCount || 0,
      engagedFarmers: farmersByKey.size,
      districts: [...districtGroups.values()].sort((left, right) => left.district.localeCompare(right.district))
    }
  });
}

async function trackVisit(req, res) {
  const visitorId = String(req.body?.visitorId || '');
  if (!/^[a-zA-Z0-9_-]{20,100}$/.test(visitorId)) {
    return res.status(400).json({ error: 'ভিজিটর সেশনটি সঠিক নয়।' });
  }
  const date = new Date().toISOString().slice(0, 10);
  const visitorHash = createHash('sha256').update(visitorId).digest('hex');
  const recordId = `VIS-${date}-${visitorHash}`;
  try {
    await BusinessRecord.updateOne(
      { type: 'publicEngagement', recordId },
      { $setOnInsert: { data: { kind: 'visit', date } } },
      { upsert: true }
    );
    return res.status(200).json({ recorded: true });
  } catch (error) {
    if (error?.code === 11000) return res.status(200).json({ recorded: true });
    throw error;
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  try {
    if (req.method === 'POST') return await trackVisit(req, res);
    return await getDashboard(res);
  } catch (error) {
    console.error('Public dashboard request failed:', error);
    return res.status(500).json({ error: 'লাইভ ড্যাশবোর্ড ডেটা লোড করা যায়নি।' });
  }
}
