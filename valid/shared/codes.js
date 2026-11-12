export const OFFICER_DESIGNATIONS = [
  { value: 'ফিল্ড সেলস অফিসার (FSO)', prefix: 'FSO' },
  { value: 'সেলস অফিসার (SO)', prefix: 'SO' },
  { value: 'টেরিটরি সেলস অফিসার (TSO)', prefix: 'TSO' },
  { value: 'এরিয়া সেলস ম্যানেজার (ASM)', prefix: 'ASM' },
  { value: 'রিজিওনাল সেলস ম্যানেজার (RSM)', prefix: 'RSM' }
];

export function getOfficerCodePrefix(designation = '') {
  return OFFICER_DESIGNATIONS.find((entry) => entry.value === designation)?.prefix || 'SO';
}

export function formatOfficerCode(code, designation = '') {
  return normalizeOfficerCode(code, designation);
}

export function normalizeOfficerCode(code, designation = '') {
  const value = String(code || '').trim().toUpperCase();
  const match = value.match(/^(FSO|SO|TSO|ASM|RSM)-?(\d+)$/);
  if (match) return `${match[1] === 'FSO' ? 'SO' : match[1]}-${match[2].padStart(2, '0')}`;
  if (!/^\d+$/.test(value)) return '';
  return `${getOfficerCodePrefix(designation)}-${value.padStart(2, '0')}`;
}

export function normalizeDealerOfficerCode(dealer, officers = []) {
  const assignedId = String(dealer?.assignedOfficerId || dealer?.officerId || '');
  const rawDealerCode = dealer?.officerCode || dealer?.assignedOfficerCode || '';
  const officerById = assignedId && officers.find((entry) => (
    String(entry.id || entry.officerId || '') === assignedId
    || String(entry.officerId || '') === assignedId
  ));
  const normalizedDealerCode = normalizeOfficerCode(rawDealerCode);
  const officerByCode = officers.find((entry) => (
    normalizedDealerCode
    && normalizeOfficerCode(entry.code, entry.designation) === normalizedDealerCode
  ));
  const codeNumber = String(rawDealerCode || assignedId).match(/(\d+)$/)?.[1];
  const matchingOfficers = codeNumber
    ? officers.filter((entry) => (
      Number(normalizeOfficerCode(entry.code, entry.designation).match(/\d+$/)?.[0])
        === Number(codeNumber)
    ))
    : [];
  const officer = officerById
    || officerByCode
    || (matchingOfficers.length === 1 ? matchingOfficers[0] : null);
  const legacyCode = assignedId.match(/^OFF-?(\d+)$/i)?.[1];
  const rawCode = officer?.code || rawDealerCode || (legacyCode ? normalizeOfficerCode(legacyCode) : '');
  return normalizeOfficerCode(rawCode, officer?.designation)
    || String(rawCode || '').trim().toUpperCase();
}

export function normalizeDealerAssignment(dealer, officers = []) {
  const normalized = { ...dealer };
  const officerCode = normalizeDealerOfficerCode(dealer, officers);
  delete normalized.assignedOfficerId;
  delete normalized.assignedOfficerCode;
  delete normalized.officerId;
  if (officerCode) normalized.officerCode = officerCode;
  else delete normalized.officerCode;
  return normalized;
}

export function isDealerAssignedToOfficer(dealer, officerCode, designation = '') {
  const normalizedCode = normalizeOfficerCode(officerCode, designation);
  return Boolean(
    normalizedCode
    && normalizeOfficerCode(dealer?.officerCode, designation) === normalizedCode
  );
}

export function createOfficerCode(serial, designation) {
  const value = String(serial || '').trim().toUpperCase();
  const match = value.match(/^(?:FSO|SO|TSO|ASM|RSM)-?(\d+)$/);
  const number = match ? match[1] : value;
  if (!/^\d+$/.test(number)) return '';
  const prefix = match?.[0].startsWith('FSO') ? 'SO' : getOfficerCodePrefix(designation);
  return `${prefix}-${number.padStart(2, '0')}`;
}

export function getNextOfficerCode(officers, designation) {
  const prefix = getOfficerCodePrefix(designation);
  const maxSerial = officers.reduce((max, officer) => {
    const code = String(officer.code || '').toUpperCase();
    const match = code.match(new RegExp(`^(?:${prefix === 'SO' ? 'FSO|SO' : prefix})-(\\d+)$`));
    const legacyMatch = /^\d+$/.test(code)
      && getOfficerCodePrefix(officer.designation) === prefix
      ? code
      : '';
    return Math.max(max, Number(match?.[1] || 0), Number(legacyMatch || 0));
  }, 0);
  return `${prefix}-${String(maxSerial + 1).padStart(2, '0')}`;
}

export function formatDealerCode(code) {
  const value = String(code || '').trim().toUpperCase();
  const match = value.match(/^(?:(?:DL|DLR)-?)?(\d+)$/);
  return match ? `DL-${match[1].padStart(2, '0')}` : value;
}

export function formatInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber || '').replace(/^VAP-\d{4}-/i, '');
}

export function getNextDealerCode(dealers) {
  const maxSerial = dealers.reduce((max, dealer) => {
    const match = String(dealer.code || '').trim().match(/^(?:DL-?)?(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `DL-${String(maxSerial + 1).padStart(2, '0')}`;
}
