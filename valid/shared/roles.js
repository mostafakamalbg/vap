export const SUPER_ADMIN_ROLE = 'SuperAdmin';
export const ADMIN_ROLE = 'Admin';
export const OFFICER_ROLE = 'officer';
export const LEGACY_ADMIN_ROLE = 'admin';
export const MD_ROLE = 'MD';
export const CHAIRMAN_ROLE = 'Chairman';
export const GENERAL_ADMIN_ROLE = 'General Admin';
export const LOGISTIC_OFFICER_ROLE = 'Logistic Officer';
export const RSM_ROLE = 'RSM';
export const ASM_ROLE = 'ASM';
export const SO_ROLE = 'SO';
export const DEALER_ROLE = 'Dealer';

export const ADMIN_ROLES = Object.freeze([
  SUPER_ADMIN_ROLE,
  ADMIN_ROLE,
  GENERAL_ADMIN_ROLE,
  MD_ROLE,
  CHAIRMAN_ROLE
]);
export const ADMIN_ROLE_VALUES = Object.freeze([
  ...ADMIN_ROLES,
  LEGACY_ADMIN_ROLE
]);
export const HIERARCHY_ROLE_VALUES = Object.freeze([
  RSM_ROLE,
  ASM_ROLE,
  SO_ROLE,
  OFFICER_ROLE
]);
export const USER_ROLE_VALUES = Object.freeze([
  ...ADMIN_ROLE_VALUES,
  ...HIERARCHY_ROLE_VALUES,
  LOGISTIC_OFFICER_ROLE,
  DEALER_ROLE
]);
export const LEGACY_ACTIVE_STATUSES = Object.freeze([
  'একটিভ',
  'এডমিন',
  'সুপার এডমিন'
]);
export const USER_STATUS_VALUES = Object.freeze([
  'pending',
  'active',
  'rejected',
  ...LEGACY_ACTIVE_STATUSES
]);

export function isAdminRole(role) {
  return ADMIN_ROLE_VALUES.includes(role);
}

export function isHierarchyRole(role) {
  return HIERARCHY_ROLE_VALUES.includes(role);
}

export function isSalesOfficerRole(role) {
  return role === SO_ROLE || role === OFFICER_ROLE;
}

export function isCoreAdminRole(role) {
  return [SUPER_ADMIN_ROLE, ADMIN_ROLE, LEGACY_ADMIN_ROLE].includes(role);
}

export function isSuperAdminRole(role) {
  return role === SUPER_ADMIN_ROLE;
}

export function normalizeAdminRole(role, isSuperAdmin = false) {
  if (!isCoreAdminRole(role)) return role;
  return isSuperAdmin ? SUPER_ADMIN_ROLE : ADMIN_ROLE;
}

export function isActiveUserStatus(status) {
  return status === 'active' || LEGACY_ACTIVE_STATUSES.includes(status);
}

export function normalizeUserStatus(status) {
  return LEGACY_ACTIVE_STATUSES.includes(status) ? 'active' : status;
}

export function matchesExpectedRole(expectedRole, actualRole) {
  if (!expectedRole) return true;
  if (expectedRole === ADMIN_ROLE || expectedRole === LEGACY_ADMIN_ROLE) {
    return isAdminRole(actualRole);
  }
  if (expectedRole === OFFICER_ROLE) {
    return isHierarchyRole(actualRole) || actualRole === LOGISTIC_OFFICER_ROLE;
  }
  return expectedRole === actualRole;
}
