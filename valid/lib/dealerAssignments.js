import { BusinessRecord, Dealer } from './models.js';
import { normalizeDealerAssignment } from '../shared/codes.js';

export async function getDealersWithOfficerCodes() {
  const [officerRecords, dealerRecords] = await Promise.all([
    BusinessRecord.find({ type: 'officers' }).select('data').lean(),
    Dealer.find({}).sort({ code: 1 }).lean()
  ]);
  const officers = officerRecords.map((record) => record.data).filter(Boolean);
  const dealers = dealerRecords.map((dealer) => normalizeDealerAssignment(dealer, officers));
  return { officers, dealers };
}
