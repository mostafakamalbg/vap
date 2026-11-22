import { isDealerAssignedToOfficer, normalizeOfficerCode } from './codes.js';
import { parseSessionDateRange } from './reportDateFilters.js';
import { normalizeSessionText } from './sessions.js';

function getDueEntries(dealer) {
  if (Array.isArray(dealer?.previousDueHistory) && dealer.previousDueHistory.length) {
    return dealer.previousDueHistory;
  }

  const hasMetadata = dealer?.previousDueDate
    || dealer?.previousDueSession
    || dealer?.previousDueOfficerId;
  const previousDue = dealer?.previousDue;
  const amount = hasMetadata || Number(previousDue) !== 0
    ? previousDue ?? dealer?.lastSessionDue ?? dealer?.openingDue
    : dealer?.lastSessionDue ?? dealer?.openingDue ?? previousDue;
  if (amount == null || (!hasMetadata && Number(amount) === 0)) return [];

  return [{
    amount,
    date: dealer.previousDueDate,
    session: dealer.previousDueSession,
    officerId: dealer.previousDueOfficerId
  }];
}

function matchesOfficer(entry, dealer, identity) {
  const officerIds = new Set((identity.officerIds || [])
    .map((id) => String(id || '').trim())
    .filter(Boolean));
  const officerCode = normalizeOfficerCode(identity.officerCode, identity.designation);
  const entryOfficerId = String(entry.officerId || '').trim();

  if (entryOfficerId) {
    return officerIds.has(entryOfficerId)
      || Boolean(officerCode && normalizeOfficerCode(entryOfficerId) === officerCode);
  }
  return isDealerAssignedToOfficer(dealer, officerCode, identity.designation);
}

function matchesPeriod(entry, { session = 'ALL', month = 'ALL', date = 'ALL' } = {}) {
  const entryDate = String(entry.date || '');

  if (date !== 'ALL' && entryDate !== date) return false;
  if (month !== 'ALL' && !entryDate.startsWith(month)) return false;

  if (session !== 'ALL') {
    const selectedRange = parseSessionDateRange(session);
    if (selectedRange && entryDate) {
      if (entryDate < selectedRange.start || entryDate >= selectedRange.end) return false;
    } else {
      const entryRange = parseSessionDateRange(entry.session);
      if (selectedRange && entryRange) {
        if (selectedRange.start !== entryRange.start || selectedRange.end !== entryRange.end) return false;
      } else if (normalizeSessionText(entry.session).toLowerCase()
        !== normalizeSessionText(session).toLowerCase()) {
        return false;
      }
    }
  }

  return true;
}

function dueEntryTimestamp(entry) {
  const postedAt = Date.parse(entry.postedAt || '');
  if (Number.isFinite(postedAt)) return postedAt;
  const date = Date.parse(`${String(entry.date || '')}T00:00:00.000Z`);
  return Number.isFinite(date) ? date : 0;
}

export function dealerHasOfficerPreviousDue(dealer, identity) {
  return getDueEntries(dealer).some((entry) => matchesOfficer(entry, dealer, identity));
}

export function getOfficerPreviousDueByDealer(dealers, identity, filters) {
  const dueByDealer = new Map();

  dealers.forEach((dealer) => {
    const eligibleEntries = getDueEntries(dealer)
      .filter((entry) => matchesOfficer(entry, dealer, identity))
      .filter((entry) => matchesPeriod(entry, filters));
    const latestEntry = eligibleEntries.reduce((latest, entry) => (
      !latest || dueEntryTimestamp(entry) >= dueEntryTimestamp(latest) ? entry : latest
    ), null);

    if (!latestEntry) return;
    dueByDealer.set(String(dealer.id), {
      amount: Number(latestEntry.amount) || 0,
      date: String(latestEntry.date || ''),
      session: String(latestEntry.session || ''),
      officerId: String(latestEntry.officerId || '')
    });
  });

  return dueByDealer;
}
