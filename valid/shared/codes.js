export const OFFICER_DESIGNATIONS = [
  { value: 'ফিল্ড সেলস অফিসার (FSO)', prefix: 'SO' },
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

export function isDealerAssignedToOfficer(dealer, officerIds, officerCode, designation = '') {
  const ids = officerIds instanceof Set ? officerIds : new Set(officerIds || []);
  const normalizedCode = normalizeOfficerCode(officerCode, designation);
  const assignedIds = [dealer?.assignedOfficerId, dealer?.officerId].filter(Boolean);
  const assignedCodes = [dealer?.assignedOfficerCode, dealer?.officerCode]
    .map((code) => normalizeOfficerCode(code, designation))
    .filter(Boolean);

  return assignedIds.some((id) => ids.has(id))
    || Boolean(normalizedCode && assignedCodes.includes(normalizedCode));
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
