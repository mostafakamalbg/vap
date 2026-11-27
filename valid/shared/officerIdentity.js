import { normalizeOfficerCode } from './codes.js';

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function getIdentity(record) {
  const ids = [...new Set([
    record?._id,
    record?.id,
    record?.userId,
    record?.hierarchyUserId,
    record?.officerId
  ].map((value) => String(value || '').trim()).filter(Boolean))];
  const codes = [...new Set([
    record?.code,
    record?.officerCode
  ].map((value) => (
    normalizeOfficerCode(value, record?.designation)
    || String(value || '').trim().toUpperCase()
  )).filter(Boolean))];
  return {
    id: String(record?.id || record?.officerId || record?.userId || record?._id || '').trim(),
    ids,
    code: codes[0] || '',
    codes,
    name: normalizeName(record?.name || record?.officerName),
    displayName: String(record?.name || record?.officerName || '').trim()
  };
}

export function officerRecordsMatch(left, right) {
  const leftIdentity = getIdentity(left);
  const rightIdentity = getIdentity(right);
  if (leftIdentity.ids.some((id) => rightIdentity.ids.includes(id))) return true;
  if (leftIdentity.codes.some((code) => rightIdentity.codes.includes(code))) return true;
  if (!leftIdentity.name || leftIdentity.name !== rightIdentity.name) return false;
  if (leftIdentity.ids.length && rightIdentity.ids.length) return false;
  if (leftIdentity.codes.length && rightIdentity.codes.length) return false;
  return true;
}

function mergeRecords(previous, next) {
  const previousIdentity = getIdentity(previous);
  const nextIdentity = getIdentity(next);
  const merged = {
    ...previous,
    ...next,
    id: previousIdentity.id || nextIdentity.id,
    officerId: String(previous.officerId || next.officerId || previousIdentity.id || nextIdentity.id),
    code: previousIdentity.code || nextIdentity.code,
    officerCode: String(
      previous.officerCode || next.officerCode || previousIdentity.code || nextIdentity.code
    ),
    name: previousIdentity.displayName || nextIdentity.displayName,
    officerName: String(
      previous.officerName
      || next.officerName
      || previousIdentity.displayName
      || nextIdentity.displayName
    ),
    phone: String(previous.phone || previous.mobileNo || next.phone || next.mobileNo || ''),
    mobileNo: String(previous.mobileNo || previous.phone || next.mobileNo || next.phone || '')
  };
  if (previous.salesTargets || next.salesTargets) {
    merged.salesTargets = { ...(previous.salesTargets || {}), ...(next.salesTargets || {}) };
  }
  if (previous.salesTargetDates || next.salesTargetDates) {
    merged.salesTargetDates = { ...(previous.salesTargetDates || {}), ...(next.salesTargetDates || {}) };
  }
  return merged;
}

function areSameOfficer(left, right) {
  return officerRecordsMatch(left, right);
}

export function mergeOfficerRecords(records = []) {
  const merged = [];
  records.filter(Boolean).forEach((record) => {
    let matches = [];
    for (let index = 0; index < merged.length; index += 1) {
      if (areSameOfficer(merged[index], record)) matches.push(index);
    }
    if (!matches.length) {
      const identity = getIdentity(record);
      if (!identity.id && !identity.code && !identity.name) return;
      merged.push(mergeRecords({}, record));
      return;
    }

    const firstIndex = matches[0];
    let combined = mergeRecords(merged[firstIndex], record);
    for (let index = matches.length - 1; index > 0; index -= 1) {
      const matchedIndex = matches[index];
      combined = mergeRecords(merged[matchedIndex], combined);
      merged.splice(matchedIndex, 1);
    }
    merged[firstIndex] = combined;
  });
  return merged;
}
