import { normalizeOfficerCode } from './codes.js';

export const OFFICER_SESSION_SALES_TARGETS = Object.freeze({
  'SO-05': Object.freeze({
    'জুলাই - ডিসেম্বর 2026': 2500000,
    'জানুয়ারি - জুন 2027': 9000000
  }),
  'SO-09': Object.freeze({
    'জুলাই - ডিসেম্বর 2026': 3000000,
    'জানুয়ারি - জুন 2027': 8000000
  }),
  'SO-07': Object.freeze({
    'জুলাই - ডিসেম্বর 2026': 1500000,
    'জানুয়ারি - জুন 2027': 3500000
  }),
  'SO-04': Object.freeze({
    'জুলাই - ডিসেম্বর 2026': 1000000,
    'জানুয়ারি - জুন 2027': 3000000
  })
});

export const OFFICER_TARGET_SESSIONS = Object.freeze([
  'জুলাই - ডিসেম্বর 2026',
  'জানুয়ারি - জুন 2027'
]);

export function mergeOfficerSalesTargets(existingTargets, updates) {
  return {
    ...(existingTargets && typeof existingTargets === 'object' && !Array.isArray(existingTargets)
      ? existingTargets
      : {}),
    ...(updates && typeof updates === 'object' && !Array.isArray(updates) ? updates : {})
  };
}

function getSessionTarget(officer, session) {
  const sessionText = String(session || '');
  const storedTargets = officer?.salesTargets || {};
  const year = sessionText.match(/\b(20\d{2})\b/)?.[1];
  const canonical = year
    ? /জানুয়ারি|january/i.test(sessionText)
      ? `জানুয়ারি - জুন ${year}`
      : /জুলাই|july/i.test(sessionText) ? `জুলাই - ডিসেম্বর ${year}` : ''
    : '';
  const stored = storedTargets[session] ?? storedTargets[canonical];
  if (stored != null) return Math.round(Number(stored) || 0);
  const isJanuaryJune2027 = /2027/.test(sessionText) && /জানুয়ারি|January/i.test(sessionText);
  const isJulyDecember2026 = /2026/.test(sessionText) && /জুলাই|July/i.test(sessionText);
  const targetField = isJanuaryJune2027
    ? 'salesTargetJanJune2027'
    : isJulyDecember2026 ? 'salesTargetJulyDec2026' : '';
  if (targetField && officer?.[targetField] != null) {
    return Math.round(Number(officer[targetField]) || 0);
  }
  const legacySession = isJanuaryJune2027
    ? OFFICER_TARGET_SESSIONS[1]
    : isJulyDecember2026 ? OFFICER_TARGET_SESSIONS[0] : '';
  if (legacySession && storedTargets[legacySession] != null) {
    return Math.round(Number(storedTargets[legacySession]) || 0);
  }
  const code = normalizeOfficerCode(officer?.code, officer?.designation);
  return Math.round(Number(OFFICER_SESSION_SALES_TARGETS[code]?.[legacySession || session]) || 0);
}

export function getOfficerSalesTarget(officer, session = 'ALL') {
  if (session === 'ALL') {
    return OFFICER_TARGET_SESSIONS.reduce(
      (sum, targetSession) => sum + getSessionTarget(officer, targetSession),
      0
    );
  }

  const target = getSessionTarget(officer, session);
  const sessionText = String(session || '');
  if (
    OFFICER_TARGET_SESSIONS.includes(sessionText)
    || (/2027/.test(sessionText) && /জানুয়ারি|January/i.test(sessionText))
    || (/2026/.test(sessionText) && /জুলাই|July/i.test(sessionText))
  ) return target;
  return Math.round(Number(
    officer?.sessionSalesTarget
    ?? officer?.salesTarget
    ?? officer?.monthlyTarget
    ?? officer?.target
  ) || 0);
}

export function hasOfficerSessionSalesTarget(officer, session) {
  return officer?.salesTargets?.[session] != null
    || getOfficerSalesTarget(officer, session) > 0;
}
