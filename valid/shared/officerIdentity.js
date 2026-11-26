import { normalizeOfficerCode } from './codes.js';

function getIdentity(record) {
  return {
    id: String(record?.id || record?.officerId || '').trim(),
    code: normalizeOfficerCode(record?.code || record?.officerCode, record?.designation),
    name: String(record?.name || record?.officerName || '').trim()
  };
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
    name: previousIdentity.name || nextIdentity.name,
    officerName: String(previous.officerName || next.officerName || previousIdentity.name || nextIdentity.name),
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
  const leftIdentity = getIdentity(left);
  const rightIdentity = getIdentity(right);
  if (leftIdentity.id && rightIdentity.id && leftIdentity.id === rightIdentity.id) return true;
  if (leftIdentity.code && rightIdentity.code && leftIdentity.code === rightIdentity.code) return true;
  return !leftIdentity.id && !rightIdentity.id
    && !leftIdentity.code && !rightIdentity.code
    && Boolean(leftIdentity.name && leftIdentity.name === rightIdentity.name);
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
