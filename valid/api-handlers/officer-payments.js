import { randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { createApprovalRequest } from '../lib/approvalRequests.js';
import { readImageDataUrl } from '../lib/imageData.js';
import {
  isDealerAssignedToOfficer,
  normalizeDealerAssignment,
  normalizeOfficerCode
} from '../shared/codes.js';
import { parseSessionDateRange } from '../shared/reportDateFilters.js';
import { normalizeSessionText } from '../shared/sessions.js';
import { roundCurrency } from '../shared/invoiceTotals.js';
import { HIERARCHY_ROLE_VALUES, isSalesOfficerRole } from '../shared/roles.js';

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
  const user = await authorize(req, res, HIERARCHY_ROLE_VALUES);
  if (!user) return;
  if (!isSalesOfficerRole(user.role) || !user.officerCode) {
    return res.status(403).json({ error: 'অফিসার পেমেন্ট জমা দেওয়ার অনুমতি নেই।' });
  }

  try {
    const dealerId = String(req.body?.dealerId || '').trim();
    const amount = Number(req.body?.amount);
    const date = String(req.body?.date || '');
    const session = normalizeSessionText(req.body?.session);
    const paymentMethod = String(req.body?.paymentMethod || 'cash').trim();
    const note = String(req.body?.note || '').trim().slice(0, 500);
    const proof = readImageDataUrl(req.body?.proofDataUrl);
    if (!dealerId || !Number.isFinite(amount) || amount <= 0 || roundCurrency(amount) <= 0 || !validDate(date)
      || !session || !parseSessionDateRange(session) || !proof
      || !['cash', 'bank', 'mobile_banking', 'cheque'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'ডিলার, সঠিক তারিখ/সেশন, পেমেন্টের পরিমাণ, মাধ্যম ও ছবির প্রমাণ দিন।' });
    }

    const [dealerRecord, officerRecords] = await Promise.all([
      Dealer.findOne({ id: dealerId }).lean(),
      BusinessRecord.find({ type: 'officers' }).select('data').lean()
    ]);
    if (!dealerRecord) return res.status(404).json({ error: 'ডিলার পাওয়া যায়নি।' });
    const officers = officerRecords.map((record) => record.data).filter(Boolean);
    const dealer = normalizeDealerAssignment(dealerRecord, officers);
    const officer = officers.find((entry) => (
      String(entry.id || entry.officerId || '') === String(user.officerId || '')
      || normalizeOfficerCode(entry.code, entry.designation) === normalizeOfficerCode(user.officerCode)
    ));
    if (!officer || !isDealerAssignedToOfficer(dealer, user.officerCode, officer.designation)) {
      return res.status(403).json({ error: 'এই ডিলারের পেমেন্ট জমা দেওয়ার অনুমতি নেই।' });
    }

    const id = `PAY-SUB-${randomUUID()}`;
    const proposed = {
      payment: {
        id: `PAY-${randomUUID()}`,
        date,
        session,
        paymentType: 'dealer_collection',
        amount: roundCurrency(amount),
        paymentMethod,
        dealerId: dealer.id,
        dealerName: dealer.shopName || '',
        officerId: user.officerId || officer.id || '',
        officerCode: user.officerCode,
        officerName: user.name,
        receivedBy: user.name,
        reference: id,
        note
      },
      proof: { dataUrl: proof.dataUrl, mimeType: proof.mimeType }
    };
    const request = await createApprovalRequest({
      requestType: 'officer_payment_submission',
      targetId: id,
      original: null,
      proposed,
      user
    });
    return res.status(202).json({
      pendingApproval: true,
      message: 'পেমেন্টের ছবি ও বিবরণ অ্যাডমিন অনুমোদনের জন্য জমা হয়েছে।',
      approvalRequest: request
    });
  } catch (error) {
    console.error('Officer payment submission failed:', error);
    return res.status(500).json({ error: 'পেমেন্টের অনুরোধ জমা করা যায়নি।' });
  }
}
