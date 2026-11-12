import { BusinessRecord, Dealer } from './models.js';
import { normalizeDealerAssignment } from '../shared/codes.js';

const LEGACY_ASSIGNMENT_FIELDS = ['assignedOfficerId', 'assignedOfficerCode', 'officerId'];

export async function getDealersWithOfficerCodes() {
  const [officerRecords, dealerRecords] = await Promise.all([
    BusinessRecord.find({ type: 'officers' }).select('data').lean(),
    Dealer.find({}).sort({ code: 1 }).lean()
  ]);
  const officers = officerRecords.map((record) => record.data).filter(Boolean);
  const dealers = dealerRecords.map((dealer) => normalizeDealerAssignment(dealer, officers));
  const updates = dealerRecords.flatMap((dealer, index) => {
    const normalized = dealers[index];
    const hasLegacyFields = LEGACY_ASSIGNMENT_FIELDS.some((field) => dealer[field] !== undefined);
    const codeChanged = (dealer.officerCode || '') !== (normalized.officerCode || '');
    if (!hasLegacyFields && !codeChanged) return [];

    const update = {
      $unset: Object.fromEntries(LEGACY_ASSIGNMENT_FIELDS.map((field) => [field, 1]))
    };
    if (normalized.officerCode) update.$set = { officerCode: normalized.officerCode };
    return [{ updateOne: { filter: { _id: dealer._id }, update } }];
  });
  if (updates.length) await Dealer.bulkWrite(updates);
  return { officers, dealers };
}
