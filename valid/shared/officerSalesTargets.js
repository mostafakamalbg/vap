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

export function getOfficerSalesTarget(officer, session = 'ALL') {
  const code = normalizeOfficerCode(officer?.code, officer?.designation);
  const targets = OFFICER_SESSION_SALES_TARGETS[code] || {};
  const storedTargets = officer?.salesTargets || {};

  if (session === 'ALL') {
    return OFFICER_TARGET_SESSIONS.reduce((sum, targetSession) => (
      sum + Math.round(Number(storedTargets[targetSession] ?? targets[targetSession]) || 0)
    ), 0);
  }

  const storedTarget = storedTargets[session];
  const target = storedTarget
    ?? officer?.sessionSalesTarget
    ?? officer?.salesTarget
    ?? officer?.monthlyTarget
    ?? officer?.target
    ?? targets[session]
    ?? 0;
  return Math.round(Number(target) || 0);
}
